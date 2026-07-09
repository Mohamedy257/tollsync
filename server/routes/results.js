const express = require('express');
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const TripResult = require('../models/TripResult');
const EzpassReportRange = require('../models/EzpassReportRange');
const Vehicle = require('../models/Vehicle');
const { matchTollsToTrips } = require('../services/ai');

const router = express.Router();
router.use(auth);

// POST /api/results/calculate
router.post('/calculate', async (req, res) => {
  try {
    const [vehicles, trips, tolls] = await Promise.all([
      Vehicle.find({ host_id: req.hostId }),
      Trip.find({ host_id: req.hostId }).sort({ start_datetime: 1 }),
      TollTransaction.find({ host_id: req.hostId }).sort({ exit_datetime: 1 }),
    ]);

    if (!trips.length) return res.status(400).json({ error: 'No trips found. Upload trip data first.' });
    if (!tolls.length) return res.status(400).json({ error: 'No toll transactions found. Upload toll data first.' });

    const vehiclesMapped = vehicles.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder: v.transponder_id }));
    const tripsMapped = trips.map(t => ({
      trip_db_id: t.id,
      renter_name: t.renter_name,
      vehicle: t.vehicle,
      plate: t.plate,
      vehicle_id: t.vehicle_id?.toString() || null,
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

    // Preserve paid status using a content fingerprint (transponder + exit_datetime + amount)
    // so paid state survives re-uploads of the same toll file (which create new _ids)
    const existingPaid = await TripResult.find({ host_id: req.hostId, paid: true }).lean();
    const paidFingerprints = new Set();
    if (existingPaid.length) {
      const paidTollDocs = await TollTransaction.find({
        _id: { $in: existingPaid.map(r => r.toll_transaction_id).filter(Boolean) },
      }).lean();
      paidTollDocs.forEach(t => {
        paidFingerprints.add(`${t.transponder_id || ''}|${t.exit_datetime ? new Date(t.exit_datetime).toISOString() : ''}|${parseFloat(t.amount).toFixed(2)}`);
      });
    }

    // Build fingerprint lookup for current tolls
    const tollFingerprint = {};
    tolls.forEach(t => {
      tollFingerprint[t.id] = `${t.transponder_id || ''}|${t.exit_datetime ? new Date(t.exit_datetime).toISOString() : ''}|${parseFloat(t.amount).toFixed(2)}`;
    });

    await TripResult.deleteMany({ host_id: req.hostId });
    const toInsert = [];
    for (const trip of matched.trips) {
      for (const item of (trip.toll_items || [])) {
        if (!item.toll_db_id || !trip.trip_db_id) continue;
        const fp = tollFingerprint[item.toll_db_id];
        toInsert.push({
          host_id: req.hostId,
          trip_id: trip.trip_db_id,
          toll_transaction_id: item.toll_db_id,
          amount: item.amount,
          paid: !!(fp && paidFingerprints.has(fp)),
        });
      }
    }
    if (toInsert.length) await TripResult.insertMany(toInsert);

    const reportRange = await EzpassReportRange.findOne({ host_id: req.hostId });
    res.json({ ...matched, report_range: reportRange ? { from: reportRange.from, to: reportRange.to } : null });
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: err.message || 'Matching failed' });
  }
});

// GET /api/results — last saved results
router.get('/', async (req, res) => {
  const [trips, results, tolls] = await Promise.all([
    Trip.find({ host_id: req.hostId }),
    TripResult.find({ host_id: req.hostId }),
    TollTransaction.find({ host_id: req.hostId }),
  ]);

  const matchedTollIds = new Set(results.map(r => r.toll_transaction_id?.toString()));

  const tripRows = trips
    .map(trip => {
      const tripResults = results.filter(r => r.trip_id?.toString() === trip.id);
      const toll_items = tripResults.map(r => {
        const toll = tolls.find(t => t.id === r.toll_transaction_id?.toString());
        if (!toll) return null;
        return {
          result_id: r.id,
          toll_db_id: toll.id,
          location: toll.location,
          entry_datetime: toll.entry_datetime,
          exit_datetime: toll.exit_datetime,
          amount: r.amount,
          paid: r.paid || false,
          transponder_id: toll.transponder_id,
        };
      }).filter(Boolean);

      const total_tolls = tripResults.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      return {
        trip_db_id: trip.id,
        renter_name: trip.renter_name,
        vehicle: trip.vehicle,
        vehicle_id: trip.vehicle_id?.toString() || null,
        start_datetime: trip.start_datetime,
        end_datetime: trip.end_datetime,
        trip_id: trip.trip_id,
        total_tolls,
        toll_count: toll_items.length,
        toll_items: toll_items.length ? toll_items : null,
      };
    })
    .sort((a, b) => new Date(b.end_datetime) - new Date(a.end_datetime));

  const unmatched_tolls = tolls.filter(t => !matchedTollIds.has(t.id));
  const total_matched = tripRows.reduce((sum, t) => sum + t.total_tolls, 0);
  const total_unmatched = unmatched_tolls.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  res.json({ trips: tripRows, unmatched_tolls, total_matched, total_unmatched });
});

// PATCH /api/results/:resultId/paid — toggle paid status
router.patch('/:resultId/paid', async (req, res) => {
  try {
    const result = await TripResult.findOne({ _id: req.params.resultId, host_id: req.hostId });
    if (!result) return res.status(404).json({ error: 'Not found' });
    result.paid = !!req.body.paid;
    await result.save();
    res.json({ ok: true, paid: result.paid });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
