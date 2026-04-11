const express = require('express');
const auth = require('../middleware/auth');
const { store, uid } = require('../db/store');
const { matchTollsToTrips } = require('../services/ai');

const router = express.Router();
router.use(auth);

// POST /api/results/calculate
router.post('/calculate', async (req, res) => {
  try {
    const vehicles = store.vehicles.filter(v => v.host_id === req.hostId);
    const trips = store.trips
      .filter(t => t.host_id === req.hostId)
      .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
    const tolls = store.toll_transactions
      .filter(t => t.host_id === req.hostId)
      .sort((a, b) => new Date(a.exit_datetime || a.entry_datetime) - new Date(b.exit_datetime || b.entry_datetime));

    if (!trips.length) return res.status(400).json({ error: 'No trips found. Upload trip data first.' });
    if (!tolls.length) return res.status(400).json({ error: 'No toll transactions found. Upload EZ-Pass data first.' });

    const vehiclesMapped = vehicles.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder: v.transponder_id }));
    const tripsMapped = trips.map(t => ({
      trip_db_id: t.id,
      renter_name: t.renter_name,
      vehicle: t.vehicle,
      plate: t.plate,
      vehicle_id: t.vehicle_id,
      start_datetime: t.start_datetime,
      end_datetime: t.end_datetime,
      trip_id: t.trip_id,
    }));
    const tollsMapped = tolls.map(t => ({
      toll_db_id: t.id,
      transponder_id: t.transponder_id,
      entry_datetime: t.entry_datetime,
      exit_datetime: t.exit_datetime,
      location: t.location,
      amount: parseFloat(t.amount),
    }));

    const matched = matchTollsToTrips(vehiclesMapped, tripsMapped, tollsMapped);

    // Persist results in memory
    store.trip_results = store.trip_results.filter(r => r.host_id !== req.hostId);
    for (const trip of matched.trips) {
      for (const item of (trip.toll_items || [])) {
        if (!item.toll_db_id || !trip.trip_db_id) continue;
        store.trip_results.push({
          id: uid(),
          host_id: req.hostId,
          trip_id: trip.trip_db_id,
          toll_transaction_id: item.toll_db_id,
          amount: item.amount,
        });
      }
    }

    const reportRange = store.ezpass_report_range[req.hostId] || null;
    res.json({ ...matched, report_range: reportRange });
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: err.message || 'Matching failed' });
  }
});

// GET /api/results — last saved results
router.get('/', (req, res) => {
  const trips = store.trips.filter(t => t.host_id === req.hostId);
  const results = store.trip_results.filter(r => r.host_id === req.hostId);
  const tolls = store.toll_transactions.filter(t => t.host_id === req.hostId);

  const matchedTollIds = new Set(results.map(r => r.toll_transaction_id));

  const tripRows = trips
    .map(trip => {
      const tripResults = results.filter(r => r.trip_id === trip.id);
      const toll_items = tripResults.map(r => {
        const toll = tolls.find(t => t.id === r.toll_transaction_id);
        if (!toll) return null;
        return {
          toll_db_id: toll.id,
          location: toll.location,
          entry_datetime: toll.entry_datetime,
          exit_datetime: toll.exit_datetime,
          match_datetime: toll.match_datetime,
          amount: r.amount,
          transponder_id: toll.transponder_id,
        };
      }).filter(Boolean);

      const total_tolls = tripResults.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      return {
        trip_db_id: trip.id,
        renter_name: trip.renter_name,
        vehicle: trip.vehicle,
        start_datetime: trip.start_datetime,
        end_datetime: trip.end_datetime,
        trip_id: trip.trip_id,
        total_tolls,
        toll_count: toll_items.length,
        toll_items: toll_items.length ? toll_items : null,
      };
    })
    .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));

  const unmatched_tolls = tolls.filter(t => !matchedTollIds.has(t.id));
  const total_matched = tripRows.reduce((sum, t) => sum + t.total_tolls, 0);
  const total_unmatched = unmatched_tolls.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  res.json({ trips: tripRows, unmatched_tolls, total_matched, total_unmatched });
});

module.exports = router;
