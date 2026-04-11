const express = require('express');
const multer = require('multer');
const fs = require('fs');
const auth = require('../middleware/auth');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const EzpassReportRange = require('../models/EzpassReportRange');
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

  // Insert results sequentially to avoid race conditions
  for (const { file, result, error } of parsed) {
    if (error) {
      console.error('Auto-detect error:', error.message);
      results.push({ file: file.originalname, error: error.message });
      continue;
    }
    try {
      const { type, data } = result;

      if (type === 'trips') {
        // Reject files where any trip is missing a time component
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

          // Deduplicate
          const alreadyExists = await Trip.findOne({
            host_id: req.hostId,
            $or: [
              ...(trip.trip_id ? [{ trip_id: trip.trip_id }] : []),
              {
                renter_name: trip.renter_name,
                start_datetime: trip.start_datetime,
                end_datetime: trip.end_datetime,
              },
            ],
          });
          if (alreadyExists) continue;

          let vehicle_id = null;

          if (!vehicleName) {
            // No vehicle name detected — create a blank vehicle to prompt user for YMM
            const newVehicle = await Vehicle.create({
              host_id: req.hostId, name: '',
              plate: plate || '', transponder_id: '',
              auto_added: true,
            });
            vehicle_id = newVehicle.id;
          } else if (vehicleName) {
            const myVehicles = await Vehicle.find({ host_id: req.hostId });

            // 1. Exact plate match against registered vehicles only
            if (plate) {
              const plateMatch = myVehicles.find(v => v.plate && v.plate.toUpperCase() === plate && v.transponder_id);
              if (plateMatch) vehicle_id = plateMatch.id;
            }

            if (!vehicle_id) {
              // Only consider fully-registered vehicles (with transponder) as candidates
              const registeredMatches = myVehicles.filter(
                v => v.name.toLowerCase() === vehicleName.toLowerCase() && v.transponder_id
              );

              if (registeredMatches.length === 0) {
                // No registered car matches — create a fresh blank for this trip
                const newVehicle = await Vehicle.create({
                  host_id: req.hostId, name: vehicleName,
                  plate: plate || '', transponder_id: '',
                  auto_added: true,
                });
                vehicle_id = newVehicle.id;

              } else if (registeredMatches.length === 1) {
                const existing = registeredMatches[0];
                const existingPlate = (existing.plate || '').toUpperCase();

                if (plate && existingPlate && plate === existingPlate) {
                  vehicle_id = existing.id;
                } else if (plate && existingPlate && plate !== existingPlate) {
                  const newVehicle = await Vehicle.create({
                    host_id: req.hostId, name: vehicleName,
                    plate, transponder_id: '',
                    auto_added: true,
                  });
                  vehicle_id = newVehicle.id;
                } else {
                  const newVehicle = await Vehicle.create({
                    host_id: req.hostId, name: vehicleName,
                    plate: plate || '', transponder_id: '',
                    auto_added: true,
                    candidates: registeredMatches.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder_id: v.transponder_id })),
                  });
                  vehicle_id = newVehicle.id;
                }

              } else {
                const newVehicle = await Vehicle.create({
                  host_id: req.hostId, name: vehicleName,
                  plate: plate || '', transponder_id: '',
                  auto_added: true,
                  candidates: registeredMatches.map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder_id: v.transponder_id })),
                });
                vehicle_id = newVehicle.id;
              }
            }
          } // end else if (vehicleName)

          const record = await Trip.create({
            host_id: req.hostId,
            renter_name: trip.renter_name, vehicle: vehicleName,
            plate: plate || '', vehicle_id,
            start_datetime: trip.start_datetime, end_datetime: trip.end_datetime,
            trip_id: trip.trip_id, source_file: file.originalname,
          });
          inserted.push(record);
        }
        results.push({ file: file.originalname, type: 'trips', count: inserted.length });

      } else if (type === 'ezpass') {
        // Expand report range to cover all uploaded files
        if (result.report_from || result.report_to) {
          const existing = await EzpassReportRange.findOne({ host_id: req.hostId });
          const newFrom = result.report_from || null;
          const newTo = result.report_to || null;
          const updatedFrom = (!existing?.from || (newFrom && newFrom < existing.from)) ? newFrom : existing.from;
          const updatedTo = (!existing?.to || (newTo && newTo > existing.to)) ? newTo : existing.to;
          await EzpassReportRange.findOneAndUpdate(
            { host_id: req.hostId },
            { from: updatedFrom, to: updatedTo },
            { upsert: true }
          );
        }

        const inserted = [];
        for (const toll of data) {
          if (!toll.entry_datetime && !toll.exit_datetime) continue;
          if (!toll.amount) continue;
          const amount = Math.abs(parseFloat(toll.amount));
          const transponder = (toll.transponder_id || '').trim();
          const entryDt = toll.entry_datetime || null;
          const exitDt = toll.exit_datetime || null;

          // Deduplicate: same transponder + same datetimes + same amount
          const alreadyExists = await TollTransaction.findOne({
            host_id: req.hostId,
            transponder_id: transponder,
            entry_datetime: entryDt,
            exit_datetime: exitDt,
            amount: { $gte: amount - 0.001, $lte: amount + 0.001 },
          });
          if (alreadyExists) continue;

          const record = await TollTransaction.create({
            host_id: req.hostId,
            transponder_id: transponder,
            entry_datetime: entryDt,
            exit_datetime: exitDt,
            location: toll.location,
            amount,
            source_file: file.originalname,
          });
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
router.post('/resolve-vehicle', async (req, res) => {
  const { vehicleId, targetVehicleId, plate, transponder_id, name } = req.body;
  const vehicle = await Vehicle.findOne({ _id: vehicleId, host_id: req.hostId });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  if (targetVehicleId) {
    const target = await Vehicle.findOne({ _id: targetVehicleId, host_id: req.hostId });
    if (!target) return res.status(404).json({ error: 'Target vehicle not found' });
    await Trip.updateMany({ host_id: req.hostId, vehicle_id: vehicleId }, { vehicle_id: targetVehicleId });
    if (plate && !target.plate) target.plate = plate.toUpperCase();
    if (transponder_id && !target.transponder_id) target.transponder_id = transponder_id.replace(/\s/g, '');
    await target.save();
    await Vehicle.deleteOne({ _id: vehicleId });
    return res.json({ vehicle: target });
  }

  const cleanPlate = plate ? plate.toUpperCase() : '';
  const cleanTransponder = transponder_id ? transponder_id.replace(/\s/g, '') : '';
  const cleanName = (name || '').trim();

  // Check if another vehicle already has this plate or transponder
  const duplicate = await Vehicle.findOne({
    _id: { $ne: vehicleId },
    host_id: req.hostId,
    $or: [
      ...(cleanPlate ? [{ plate: cleanPlate }] : []),
      ...(cleanTransponder ? [{ transponder_id: cleanTransponder }] : []),
    ],
  });

  if (duplicate) {
    await Trip.updateMany({ host_id: req.hostId, vehicle_id: vehicleId }, { vehicle_id: duplicate.id });
    await Vehicle.deleteOne({ _id: vehicleId });
    return res.json({ vehicle: duplicate });
  }

  if (cleanName) {
    vehicle.name = cleanName;
    // Also update the vehicle string on all linked trips
    await Trip.updateMany({ host_id: req.hostId, vehicle_id: vehicleId }, { vehicle: cleanName });
  }
  if (cleanPlate) vehicle.plate = cleanPlate;
  if (cleanTransponder) vehicle.transponder_id = cleanTransponder;
  vehicle.candidates = null;
  await vehicle.save();
  res.json({ vehicle });
});

module.exports = router;
