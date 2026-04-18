const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const EzpassReportRange = require('../models/EzpassReportRange');
const { parseFileAutoDetect, parseMultipleImagesAutoDetect } = require('../services/ai');

const router = express.Router();
router.use(auth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Mobile browsers (iOS Files app, Android Chrome) often send PDFs and CSVs
// as application/octet-stream. Use file extension as the authoritative source.
function resolveMimeType(file) {
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.csv')) return 'text/csv';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/jpeg'; // should be converted client-side already
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return file.mimetype || 'application/octet-stream';
}

// ── Earnings CSV parser ─────────────────────────────────────────────────────
// Parses CSV exports with header: "Reservation ID","Guest","Vehicle",...
// Returns null if the file doesn't match this format.
function parseEarningsCSV(buffer) {
  const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return null;

  // Detect format
  const header = lines[0];
  if (!header.includes('Reservation ID') || !header.includes('Total earnings')) return null;

  // Simple CSV row parser — handles quoted fields
  function parseRow(line) {
    const fields = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur);
    return fields;
  }

  const headers = parseRow(lines[0]);
  const idx = (name) => headers.findIndex(h => h.trim().replace(/^"|"$/g, '') === name);

  const iReservation = idx('Reservation ID');
  const iGuest       = idx('Guest');
  const iVehicleCol  = idx('Vehicle');       // "Moe's Honda (MD #3GH6268)"
  const iVehicleName = idx('Vehicle name'); // "Honda Accord 2014"
  const iStart       = idx('Trip start');
  const iEnd         = idx('Trip end');
  const iStatus      = idx('Trip status');

  if (iReservation === -1 || iGuest === -1 || iStart === -1 || iEnd === -1) return null;

  // Convert "2025-11-14 09:30 PM" → ISO string
  function toISO(str) {
    if (!str) return null;
    str = str.trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str;
    // "YYYY-MM-DD HH:MM AM/PM"
    const m = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let [, date, h, min, ap] = m;
    h = parseInt(h, 10);
    if (ap.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ap.toUpperCase() === 'AM' && h === 12) h = 0;
    return `${date}T${String(h).padStart(2, '0')}:${min}:00`;
  }

  // Extract plate from "Name (STATE #PLATE)" → "PLATE"
  function extractPlate(vehicleCol) {
    const m = (vehicleCol || '').match(/\(\s*[A-Z]{1,3}\s*#([A-Z0-9]+)\s*\)/i);
    return m ? m[1].toUpperCase() : '';
  }

  const SKIP_STATUSES = new Set(['Guest cancellation', 'Host cancellation']);
  const trips = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (!row.length || !row[0]) continue;

    const status = iStatus !== -1 ? row[iStatus]?.trim() : '';
    if (SKIP_STATUSES.has(status)) continue;

    const start = toISO(row[iStart]?.trim());
    const end   = toISO(row[iEnd]?.trim());
    if (!start || !end) continue;

    const vehicleCol  = row[iVehicleCol]?.trim() || '';
    const vehicleName = iVehicleName !== -1 ? row[iVehicleName]?.trim() : '';
    const plate       = extractPlate(vehicleCol);

    trips.push({
      trip_id:      row[iReservation]?.trim() || '',
      renter_name:  row[iGuest]?.trim() || '',
      vehicle:      vehicleName || vehicleCol,
      plate,
      start_datetime: start,
      end_datetime:   end,
    });
  }

  return { type: 'trips', data: trips, skipTimeCheck: true };
}
// ────────────────────────────────────────────────────────────────────────────

// POST /api/upload/auto
router.post('/auto', upload.array('files', 20), async (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  // Resolve reliable MIME types before any processing
  files.forEach(f => { f.mimetype = resolveMimeType(f); });

  const results = [];

  // If ALL uploaded files are images, process them together in one AI call
  // so multi-page documents (e.g. EZPass spanning several screenshots) share full context.
  const allImages = files.every(f => f.mimetype.startsWith('image/'));

  let parsed;
  if (allImages && files.length > 1) {
    try {
      const result = await parseMultipleImagesAutoDetect(
        files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype }))
      );
      // Treat the combined result as if it came from the first file
      parsed = [{ file: files[0], result, error: null }];
      // Mark remaining files as skipped (data already included in combined result)
      for (let i = 1; i < files.length; i++) {
        parsed.push({ file: files[i], result: null, error: null, skip: true });
      }
    } catch (err) {
      parsed = [{ file: files[0], result: null, error: err }];
      for (let i = 1; i < files.length; i++) {
        parsed.push({ file: files[i], result: null, error: null, skip: true });
      }
    }
  } else {
    // Parse all files in parallel — AI calls are independent
    // CSVs that match the earnings export format are parsed natively (no AI)
    parsed = await Promise.all(
      files.map(file => {
        if (file.mimetype === 'text/csv') {
          const csvResult = parseEarningsCSV(file.buffer);
          if (csvResult) return Promise.resolve({ file, result: csvResult, error: null });
        }
        return parseFileAutoDetect(file.buffer, file.mimetype)
          .then(result => ({ file, result, error: null }))
          .catch(err => ({ file, result: null, error: err }));
      })
    );
  }

  // Insert results sequentially to avoid race conditions
  for (const { file, result, error, skip } of parsed) {
    if (skip) continue; // already included in combined multi-image result
    if (error) {
      console.error('Auto-detect error:', error.message);
      results.push({ file: file.originalname, error: error.message });
      continue;
    }
    try {
      const { type, data, skipTimeCheck } = result;

      if (type === 'trips') {
        // Reject AI-parsed files where trips are missing time (AI defaults to 00:00 when no time visible)
        if (!skipTimeCheck) {
          const hasTime = dt => dt && /T\d{2}:\d{2}/.test(dt) && !/T00:00(:\d{2})?$/.test(dt);
          const missingTime = data.filter(t => t.start_datetime || t.end_datetime)
            .some(t => !hasTime(t.start_datetime) || !hasTime(t.end_datetime));
          if (missingTime) {
            results.push({ file: file.originalname, error: 'Trip times are missing from this screenshot. Please upload a screenshot that shows the exact start and end times for each trip.' });
            continue;
          }
        }

        const inserted = [];
        const unmatched = []; // trips where no registered vehicle matched by plate
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
          const myVehicles = await Vehicle.find({ host_id: req.hostId });

          // 1. Exact plate match against registered vehicles (with transponder)
          if (plate) {
            const plateMatch = myVehicles.find(v => v.plate && v.plate.toUpperCase() === plate && v.transponder_id);
            if (plateMatch) vehicle_id = plateMatch.id;
          }

          // 2. Name match if no plate match
          if (!vehicle_id && vehicleName) {
            const registeredMatches = myVehicles.filter(
              v => v.name.toLowerCase() === vehicleName.toLowerCase() && v.transponder_id
            );
            if (registeredMatches.length === 1) {
              const existing = registeredMatches[0];
              const existingPlate = (existing.plate || '').toUpperCase();
              if (!plate || !existingPlate || plate === existingPlate) {
                vehicle_id = existing.id;
              }
            }
          }

          // 3. If CSV trip (has plate) but no match found — insert without vehicle_id, flag for UI resolution
          const needsResolution = !vehicle_id && plate;
          if (needsResolution) {
            // No auto_added vehicle — user must pick from existing or add new
          } else if (!vehicle_id && !plate && !vehicleName) {
            // No info at all — create blank placeholder
            const newVehicle = await Vehicle.create({
              host_id: req.hostId, name: '',
              plate: '', transponder_id: '', auto_added: true,
            });
            vehicle_id = newVehicle.id;
          } else if (!vehicle_id && vehicleName) {
            // Non-CSV or unmatched name — create auto_added placeholder
            const newVehicle = await Vehicle.create({
              host_id: req.hostId, name: vehicleName,
              plate: plate || '', transponder_id: '', auto_added: true,
              candidates: myVehicles.filter(v => v.transponder_id)
                .map(v => ({ id: v.id, name: v.name, plate: v.plate, transponder_id: v.transponder_id })),
            });
            vehicle_id = newVehicle.id;
          }

          const record = await Trip.create({
            host_id: req.hostId,
            renter_name: trip.renter_name, vehicle: vehicleName,
            plate: plate || '', vehicle_id,
            start_datetime: trip.start_datetime, end_datetime: trip.end_datetime,
            trip_id: trip.trip_id, source_file: file.originalname,
          });
          inserted.push(record);

          if (needsResolution) {
            unmatched.push({
              trip_id: record.id,
              renter_name: trip.renter_name,
              vehicle: vehicleName,
              plate,
            });
          }
        }
        results.push({
          file: file.originalname, type: 'trips',
          count: inserted.length,
          unmatched: unmatched.length ? unmatched : undefined,
        });

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
  try {
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
  const orClauses = [
    ...(cleanPlate ? [{ plate: cleanPlate }] : []),
    ...(cleanTransponder ? [{ transponder_id: cleanTransponder }] : []),
  ];
  const duplicate = orClauses.length > 0 ? await Vehicle.findOne({
    _id: { $ne: vehicleId },
    host_id: req.hostId,
    $or: orClauses,
  }) : null;

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
  } catch (err) {
    console.error('resolve-vehicle error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
