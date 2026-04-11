const express = require('express');
const multer = require('multer');
const fs = require('fs');
const auth = require('../middleware/auth');
const { store, uid } = require('../db/store');
const { parseFileAutoDetect } = require('../services/ai');

const router = express.Router();
router.use(auth);

const upload = multer({
  dest: 'uploads/auto/',
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/upload/auto
router.post('/auto', upload.array('files', 20), async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  const results = [];

  // Parse all files in parallel — AI calls are independent and this is the main bottleneck
  const parsed = await Promise.all(
    files.map(file =>
      parseFileAutoDetect(file.path, file.mimetype)
        .then(result => ({ file, result, error: null }))
        .catch(err => ({ file, result: null, error: err }))
        .finally(() => fs.unlink(file.path, () => {}))
    )
  );

  // Insert results sequentially to avoid store race conditions
  for (const { file, result, error } of parsed) {
    if (error) {
      console.error('Auto-detect error:', error.message);
      results.push({ file: file.originalname, error: error.message });
      continue;
    }
    try {
      const { type, data } = result;

      if (type === 'trips') {
        // Reject files where any trip is missing a time component (date-only screenshots)
        const hasTime = dt => dt && /T\d{2}:\d{2}/.test(dt) && !/T00:00(:\d{2})?$/.test(dt);
        const missingTime = data.filter(t => t.start_datetime || t.end_datetime)
          .some(t => !hasTime(t.start_datetime) || !hasTime(t.end_datetime));
        if (missingTime) {
          results.push({ file: file.originalname, error: 'Trip times are missing from this screenshot. Please upload a screenshot that shows the exact start and end times for each trip.' });
          continue;
        }

        const inserted = [];
        for (const trip of data) {
          if (!trip.start_datetime || !trip.end_datetime) continue;

          const vehicleName = (trip.vehicle || '').trim();
          const plate = (trip.plate || '').trim().toUpperCase();

          // Deduplicate first
          const alreadyExists = store.trips.find(existing =>
            existing.host_id === req.hostId && (
              (trip.trip_id && existing.trip_id === trip.trip_id) ||
              (existing.renter_name === trip.renter_name &&
               existing.start_datetime === trip.start_datetime &&
               existing.end_datetime === trip.end_datetime)
            )
          );
          if (alreadyExists) continue;

          let vehicle_id = null;

          if (vehicleName) {
            const myVehicles = store.vehicles.filter(v => v.host_id === req.hostId);

            // 1. Exact plate match against registered vehicles only (not blanks)
            if (plate) {
              const plateMatch = myVehicles.find(v => v.plate && v.plate.toUpperCase() === plate && v.transponder_id);
              if (plateMatch) vehicle_id = plateMatch.id;
            }

            if (!vehicle_id) {
              // Only consider fully-registered vehicles (with transponder) as candidates.
              // Blank auto-added vehicles are ignored so each trip gets its own blank,
              // preventing multiple trips from being grouped under one unknown vehicle.
              const registeredMatches = myVehicles.filter(
                v => v.name.toLowerCase() === vehicleName.toLowerCase() && v.transponder_id
              );

              if (registeredMatches.length === 0) {
                // No registered car matches — create a fresh blank for this trip
                const newVehicle = {
                  id: uid(), host_id: req.hostId, name: vehicleName,
                  plate: plate || '', transponder_id: '',
                  created_at: new Date().toISOString(), auto_added: true,
                };
                store.vehicles.push(newVehicle);
                vehicle_id = newVehicle.id;

              } else if (registeredMatches.length === 1) {
                const existing = registeredMatches[0];
                const existingPlate = (existing.plate || '').toUpperCase();

                if (plate && existingPlate && plate === existingPlate) {
                  // Same plate — definitely same car
                  vehicle_id = existing.id;
                } else if (plate && existingPlate && plate !== existingPlate) {
                  // Different plates — new car, create blank with no candidates
                  const newVehicle = {
                    id: uid(), host_id: req.hostId, name: vehicleName,
                    plate, transponder_id: '',
                    created_at: new Date().toISOString(), auto_added: true,
                  };
                  store.vehicles.push(newVehicle);
                  vehicle_id = newVehicle.id;
                } else {
                  // Can't confirm — create blank per trip with registered cars as candidates
                  const newVehicle = {
                    id: uid(), host_id: req.hostId, name: vehicleName,
                    plate: plate || '', transponder_id: '',
                    created_at: new Date().toISOString(), auto_added: true,
                    candidates: registeredMatches.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder_id: v.transponder_id })),
                  };
                  store.vehicles.push(newVehicle);
                  vehicle_id = newVehicle.id;
                }

              } else {
                // Multiple registered same-name vehicles — create blank per trip with all as candidates
                const newVehicle = {
                  id: uid(), host_id: req.hostId, name: vehicleName,
                  plate: plate || '', transponder_id: '',
                  created_at: new Date().toISOString(), auto_added: true,
                  candidates: registeredMatches.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder_id: v.transponder_id })),
                };
                store.vehicles.push(newVehicle);
                vehicle_id = newVehicle.id;
              }
            }
          }

          const record = {
            id: uid(), host_id: req.hostId,
            renter_name: trip.renter_name, vehicle: vehicleName,
            plate: plate || '', vehicle_id,
            start_datetime: trip.start_datetime, end_datetime: trip.end_datetime,
            trip_id: trip.trip_id, source_file: file.originalname,
          };
          store.trips.push(record);
          inserted.push(record);
        }
        results.push({ file: file.originalname, type: 'trips', count: inserted.length });

      } else if (type === 'ezpass') {
        // Expand report range to cover all uploaded files
        if (parsed.report_from || parsed.report_to) {
          const existing = store.ezpass_report_range[req.hostId] || {};
          const newFrom = parsed.report_from || null;
          const newTo = parsed.report_to || null;
          store.ezpass_report_range[req.hostId] = {
            from: (!existing.from || (newFrom && newFrom < existing.from)) ? newFrom : existing.from,
            to: (!existing.to || (newTo && newTo > existing.to)) ? newTo : existing.to,
          };
        }
        const inserted = [];
        for (const toll of data) {
          if (!toll.entry_datetime && !toll.exit_datetime) continue;
          if (!toll.amount) continue;
          const amount = Math.abs(parseFloat(toll.amount));
          const transponder = (toll.transponder_id || '').trim();
          const entryDt = toll.entry_datetime || null;
          const exitDt = toll.exit_datetime || null;
          // Deduplicate: same transponder + same datetime + same amount
          const alreadyExists = store.toll_transactions.find(t =>
            t.host_id === req.hostId &&
            t.transponder_id === transponder &&
            t.entry_datetime === entryDt &&
            t.exit_datetime === exitDt &&
            Math.abs(parseFloat(t.amount) - amount) < 0.001
          );
          if (alreadyExists) continue;
          const record = {
            id: uid(), host_id: req.hostId,
            transponder_id: transponder,
            entry_datetime: entryDt,
            exit_datetime: exitDt,
            location: toll.location,
            amount,
            source_file: file.originalname,
          };
          store.toll_transactions.push(record);
          inserted.push(record);
        }
        results.push({ file: file.originalname, type: 'ezpass', count: inserted.length });
      }
    } catch (err) {
      console.error('Insert error:', err.message);
      results.push({ file: file.originalname, error: err.message });
    }
  }

  res.json({ results });
});

// POST /api/upload/resolve-vehicle
// Resolves a blank auto-added vehicle with candidates:
// - If targetVehicleId: reassign all trips to that vehicle, delete blank
// - If plate+transponder: save to the blank vehicle (making it a real one)
router.post('/resolve-vehicle', (req, res) => {
  const { vehicleId, targetVehicleId, plate, transponder_id } = req.body;
  const vehicle = store.vehicles.find(v => v.id === vehicleId && v.host_id === req.hostId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  if (targetVehicleId) {
    // User picked an existing vehicle — reassign all trips and delete blank
    const target = store.vehicles.find(v => v.id === targetVehicleId && v.host_id === req.hostId);
    if (!target) return res.status(404).json({ error: 'Target vehicle not found' });
    store.trips
      .filter(t => t.host_id === req.hostId && t.vehicle_id === vehicleId)
      .forEach(t => { t.vehicle_id = targetVehicleId; });
    // Update plate and transponder on target if provided and missing
    if (plate && !target.plate) target.plate = plate.toUpperCase();
    if (transponder_id && !target.transponder_id) target.transponder_id = transponder_id.replace(/\s/g, '');
    // Remove blank vehicle
    store.vehicles = store.vehicles.filter(v => v.id !== vehicleId);
    return res.json({ vehicle: target });
  }

  // User entered new plate+transponder — check if an existing vehicle already matches
  const cleanPlate = plate ? plate.toUpperCase() : '';
  const cleanTransponder = transponder_id ? transponder_id.replace(/\s/g, '') : '';
  const duplicate = store.vehicles.find(v =>
    v.id !== vehicleId &&
    v.host_id === req.hostId &&
    ((cleanPlate && v.plate && v.plate.toUpperCase() === cleanPlate) ||
     (cleanTransponder && v.transponder_id && v.transponder_id.replace(/\s/g, '') === cleanTransponder))
  );
  if (duplicate) {
    // Reuse the existing vehicle — reassign trips and delete the blank
    store.trips
      .filter(t => t.host_id === req.hostId && t.vehicle_id === vehicleId)
      .forEach(t => { t.vehicle_id = duplicate.id; });
    store.vehicles = store.vehicles.filter(v => v.id !== vehicleId);
    return res.json({ vehicle: duplicate });
  }

  // No duplicate — save to the blank vehicle
  if (cleanPlate) vehicle.plate = cleanPlate;
  if (cleanTransponder) vehicle.transponder_id = cleanTransponder;
  delete vehicle.candidates; // no longer ambiguous
  res.json({ vehicle });
});

module.exports = router;
