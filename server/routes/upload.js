const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const EzpassReportRange = require('../models/EzpassReportRange');
const { parseFileAutoDetect, parseMultipleImagesAutoDetect } = require('../services/ai');

const router = express.Router();
router.use(auth);

// In-memory job store — entries expire after 1 hour
const jobs = new Map();
let jobSeq = 0;
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [id, job] of jobs) if (job.createdAt < cutoff) jobs.delete(id);
}, 300_000).unref();

const PLACEHOLDER = /^[-_\s.]+$|^n\/?a$/i;
function sanitizeLocation(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) return null;
  return trimmed;
}

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

// ── E-ZPass PDF parser ──────────────────────────────────────────────────────
// Parses E-ZPass transaction history PDFs (Virginia and other states).
// pdf-parse concatenates columns with no separator, so we rely on the
// fixed line structure emitted by this report type:
//
// IAG TOLL row (single datetime):
//   "DATE IAG TOLL INCOMING "  ← line i
//   "TRANSACTIONS"              ← line i+1
//   "TRANSPONDER AGENCY PLAZAS DATE "  ← line i+2 (data line)
//   "H:MM AM/PM"                ← line i+3 (entry time)
//   "-AMOUNT BALANCE"           ← line i+4 (amount line)
//
// IAG TOLL row (entry + exit):
//   same as above but lines i+4 = "EXIT_DATE ", i+5 = "H:MM AM/PM", i+6 = amount
//
// INTRA AGENCY TOLL row:
//   "DATE INTRA AGENCY "   ← line i
//   "TOLL "                 ← line i+1
//   "TRANSACTIONS"          ← line i+2
//   data line at i+3, then same structure, possibly followed by facility lines
//
// Returns null if the buffer doesn't look like this format.
async function parseEzpassPDF(buffer) {
  let text;
  try {
    const data = await pdfParse(buffer);
    text = data.text;
  } catch (e) {
    return null;
  }

  if (!text.includes('E-ZPass') || !text.includes('Transaction')) return null;

  // ── helpers ──
  function dateToISO(s) {
    const m = (s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : null;
  }
  function toISO(dateStr, timeStr) {
    const d = (dateStr || '').trim();
    const t = (timeStr || '').trim();
    const dm = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const tm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!dm || !tm) return null;
    let h = parseInt(tm[1], 10);
    if (tm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (tm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${dm[3]}-${dm[1].padStart(2,'0')}-${dm[2].padStart(2,'0')}T${String(h).padStart(2,'0')}:${tm[2]}:00`;
  }
  const isTime = s => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test((s || '').trim());
  const isDate = s => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((s || '').trim());
  // Amount line: "-4.00241.57" or "-22.8050.28"
  const amountVal = s => { const m = (s || '').trim().match(/^-(\d+\.\d{2})\d*\.?\d*$/); return m ? parseFloat(m[1]) : null; };

  // Extract report range from header
  let report_from = null, report_to = null;
  const rm = text.match(/From:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+To:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (rm) { report_from = dateToISO(rm[1]); report_to = dateToISO(rm[2]); }

  // Transponder is the first alphanumeric token on the data line (before the agency code)
  // Agency codes seen in the wild:
  const AGENCY_RE = /^([A-Z0-9]{5,12})(MdTA|VDOT|NJTP|GSP|ACE|FTE|CFX|DRBA|DRPA|NYSTA|PTC|DelDOT|NFBC|WVTA|CATA|NYSTA)/i;

  const lines = text.split('\n').map(l => l.trim());
  const tolls = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip credit card payments and other non-toll lines
    if (/CREDIT CARD|REPLENISHMENT/.test(line)) { i++; continue; }

    // Transaction start: date immediately followed by IAG TOLL or INTRA AGENCY
    const isIAG   = /^\d{1,2}\/\d{1,2}\/\d{4}IAG TOLL/.test(line);
    const isIntra = /^\d{1,2}\/\d{1,2}\/\d{4}INTRA AGENCY/.test(line);
    if (!isIAG && !isIntra) { i++; continue; }

    // Offset to the data line (transponder + agency + plazas + entry date)
    // IAG:   DATE|IAG TOLL INCOMING → TRANSACTIONS → data
    // INTRA: DATE|INTRA AGENCY → TOLL → TRANSACTIONS → data
    const dataOffset = isIntra ? 3 : 2;
    const dataLine = lines[i + dataOffset] || '';

    // Extract transponder from data line
    const trMatch = dataLine.match(AGENCY_RE);
    if (!trMatch) { i++; continue; }
    const transponder_id = trMatch[1].toUpperCase();

    // Extract the entry date from the data line.
    // Plaza codes are pure alphanumeric (no slashes) and run directly into the date,
    // e.g. "4825479MdTA9511/4/2026" → plaza 951 + date 1/4/2026.
    // The greedy \d{1,2} can grab the plaza's trailing digit(s) as the month.
    // Disambiguation: use the Date Posted (from the header line) — entry date must be ≤ posted date.
    const postedDateStr = (line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/) || [])[1];
    function parseDayMs(s) {
      const p = (s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return p ? Date.UTC(+p[3], +p[1] - 1, +p[2]) : NaN;
    }
    const postedMs = postedDateStr ? parseDayMs(postedDateStr) : Infinity;

    // Try extracting a date starting 1 or 2 chars before the first slash.
    function tryDateAt(str, startBack) {
      const slashIdx = str.indexOf('/');
      if (slashIdx < startBack) return null;
      const candidate = str.slice(slashIdx - startBack);
      const m = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!m) return null;
      const mo = +m[1], d = +m[2];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return m[0];
    }
    const afterAgency = dataLine.slice(trMatch[0].length);
    const c1 = tryDateAt(afterAgency, 1); // 1-digit month
    const c2 = tryDateAt(afterAgency, 2); // 2-digit month
    let entryDateStr = null;
    if (c1 && c2) {
      const ms1 = parseDayMs(c1), ms2 = parseDayMs(c2);
      // Pick the candidate whose date is ≤ posted date (entry always posted after it happens)
      const ok1 = ms1 <= postedMs, ok2 = ms2 <= postedMs;
      if (ok1 && !ok2) entryDateStr = c1;
      else if (ok2 && !ok1) entryDateStr = c2;
      else entryDateStr = c1; // both ok or both not: prefer 1-digit (smaller/earlier)
    } else {
      entryDateStr = c1 || c2;
    }

    // Walk forward from data line to collect time / exit date / exit time / amount
    let j = i + dataOffset + 1;
    const entryTime = isTime(lines[j]) ? lines[j++] : null;

    let exitDateStr = null, exitTime = null;
    if (isDate(lines[j])) {
      exitDateStr = lines[j++].trim();
      if (isTime(lines[j])) exitTime = lines[j++];
    }

    // Skip any plaza facility lines until we hit the amount line
    const MAX_LOOK = 6;
    let amt = null;
    for (let k = 0; k < MAX_LOOK; k++) {
      amt = amountVal(lines[j]);
      if (amt !== null) { j++; break; }
      j++;
    }
    if (amt === null) { i++; continue; }

    const entry_datetime = toISO(entryDateStr, entryTime);
    const exit_datetime  = toISO(exitDateStr, exitTime);
    if (!entry_datetime && !exit_datetime) { i++; continue; }

    tolls.push({ transponder_id, entry_datetime, exit_datetime, location: '', amount: amt });
    i = j; // resume after the amount line
  }

  if (!tolls.length) return null;
  return { type: 'ezpass', report_from, report_to, data: tolls };
}
// ────────────────────────────────────────────────────────────────────────────

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

// ── Background job processor ─────────────────────────────────────────────────
async function processUploadJob(jobId, files, hostId) {
  const job = jobs.get(jobId);
  const results = [];

  try {
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
        files.map(async file => {
          // 1. Earnings CSV — native parse, no AI
          if (file.mimetype === 'text/csv') {
            const csvResult = parseEarningsCSV(file.buffer);
            if (csvResult) return { file, result: csvResult, error: null };
          }
          // 2. PDF — try native EZPass parser first (avoids AI token limit on large statements)
          if (file.mimetype === 'application/pdf') {
            try {
              const ezpassResult = await parseEzpassPDF(file.buffer);
              if (ezpassResult) return { file, result: ezpassResult, error: null };
            } catch (e) { /* fall through to AI */ }
          }
          // 3. AI fallback for everything else
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
          for (const trip of data) {
            if (!trip.start_datetime || !trip.end_datetime) continue;

            const vehicleName = (trip.vehicle || '').trim();
            const plate = (trip.plate || '').trim().toUpperCase();

            // Deduplicate
            const alreadyExists = await Trip.findOne({
              host_id: hostId,
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
            const myVehicles = await Vehicle.find({ host_id: hostId });

            // 1. Plate match against any existing vehicle (with or without transponder)
            if (plate) {
              const plateMatch = myVehicles.find(v => v.plate && v.plate.toUpperCase() === plate);
              if (plateMatch) {
                vehicle_id = plateMatch.id;
                // Fill in name from CSV if the existing vehicle has none
                if (vehicleName && !plateMatch.name) {
                  plateMatch.name = vehicleName;
                  await plateMatch.save();
                }
              }
            }

            // 2. Name match if no plate match
            if (!vehicle_id && vehicleName) {
              const nameMatches = myVehicles.filter(
                v => v.name.toLowerCase() === vehicleName.toLowerCase()
              );
              if (nameMatches.length === 1) {
                const existing = nameMatches[0];
                const existingPlate = (existing.plate || '').toUpperCase();
                if (!plate || !existingPlate || plate === existingPlate) {
                  vehicle_id = existing.id;
                  // Fill in plate from CSV if missing
                  if (plate && !existing.plate) {
                    existing.plate = plate;
                    await existing.save();
                  }
                }
              }
            }

            // 3. If still no match and we have a plate — auto-create the vehicle
            //    User will be prompted to add transponder later if needed
            if (!vehicle_id && plate) {
              const newVehicle = await Vehicle.create({
                host_id: hostId,
                name: vehicleName || plate,
                plate,
                transponder_id: '',
                auto_added: true,
              });
              vehicle_id = newVehicle.id;
            } else if (!vehicle_id && !plate && !vehicleName) {
              // No info at all — create blank placeholder
              const newVehicle = await Vehicle.create({
                host_id: hostId, name: '',
                plate: '', transponder_id: '', auto_added: true,
              });
              vehicle_id = newVehicle.id;
            } else if (!vehicle_id && vehicleName) {
              // Name only (AI parsed, no plate) — create placeholder
              const newVehicle = await Vehicle.create({
                host_id: hostId, name: vehicleName,
                plate: '', transponder_id: '', auto_added: true,
              });
              vehicle_id = newVehicle.id;
            }

            const record = await Trip.create({
              host_id: hostId,
              renter_name: trip.renter_name, vehicle: vehicleName,
              plate: plate || '', vehicle_id,
              start_datetime: trip.start_datetime, end_datetime: trip.end_datetime,
              trip_id: trip.trip_id, source_file: file.originalname,
            });
            inserted.push(record);
          }
          results.push({
            file: file.originalname, type: 'trips',
            count: inserted.length,
          });

        } else if (type === 'ezpass') {
          // Expand report range to cover all uploaded files
          if (result.report_from || result.report_to) {
            const existing = await EzpassReportRange.findOne({ host_id: hostId });
            const newFrom = result.report_from || null;
            const newTo = result.report_to || null;
            const updatedFrom = (!existing?.from || (newFrom && newFrom < existing.from)) ? newFrom : existing.from;
            const updatedTo = (!existing?.to || (newTo && newTo > existing.to)) ? newTo : existing.to;
            await EzpassReportRange.findOneAndUpdate(
              { host_id: hostId },
              { from: updatedFrom, to: updatedTo },
              { upsert: true }
            );
          }

          // Normalize ISO datetime string to "YYYY-MM-DDTHH:MM:SS" (no Z, no ms)
          // so strings from AI ("...Z" or "....000Z") match those from the native parser.
          function normDt(s) {
            if (!s) return null;
            return s.replace(/\.\d+Z?$/, '').replace(/Z$/, '');
          }

          const inserted = [];
          for (const toll of data) {
            if (!toll.entry_datetime && !toll.exit_datetime) continue;
            if (!toll.amount) continue;
            const amount = Math.abs(parseFloat(toll.amount));
            const transponder = (toll.transponder_id || '').trim();
            const entryDt = normDt(toll.entry_datetime);
            const exitDt  = normDt(toll.exit_datetime);

            // Deduplicate: same transponder + same amount + same datetime(s).
            // Use minute-level prefix matching to handle format differences ("Z", ".000Z", etc.).
            // Also check both entry and exit fields — AI and native parser may swap them
            // for single-datetime rows (one stores it as entry, the other as exit).
            function dtPrefixQuery(val) {
              return { $regex: `^${val.slice(0, 16)}` };
            }
            // Collect the non-null datetimes we're about to insert
            const dts = [entryDt, exitDt].filter(Boolean);
            // A duplicate is any record with same transponder+amount where every one of
            // our datetimes appears somewhere in the record (either field).
            const dtConditions = dts.map(dt => ({
              $or: [
                { entry_datetime: dtPrefixQuery(dt) },
                { exit_datetime:  dtPrefixQuery(dt) },
              ],
            }));
            const alreadyExists = dts.length > 0 && await TollTransaction.findOne({
              host_id: hostId,
              transponder_id: transponder,
              amount: { $gte: amount - 0.001, $lte: amount + 0.001 },
              ...(dtConditions.length > 0 ? { $and: dtConditions } : {}),
            });
            if (alreadyExists) continue;

            const agency = sanitizeLocation(toll.agency);
            const entryPlaza = sanitizeLocation(toll.entry_plaza);
            const exitPlaza = sanitizeLocation(toll.exit_plaza);
            const plazaFacility = sanitizeLocation(toll.plaza_facility);
            const location = [agency, entryPlaza, exitPlaza, plazaFacility].filter(Boolean).join(' - ') || null;
            const record = await TollTransaction.create({
              host_id: hostId,
              transponder_id: transponder,
              entry_datetime: entryDt,
              exit_datetime: exitDt,
              agency,
              entry_plaza: entryPlaza,
              exit_plaza: exitPlaza,
              plaza_facility: plazaFacility,
              location,
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

    job.status = 'done';
    job.results = results;
  } catch (err) {
    console.error('Background upload job error:', err.message);
    job.status = 'error';
    job.error = err.message;
  }
}
// ────────────────────────────────────────────────────────────────────────────

// POST /api/upload/auto — receive files, start background job, return jobId immediately
router.post('/auto', upload.array('files', 20), (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).json({ error: 'No files uploaded' });

  // Resolve reliable MIME types before any processing
  files.forEach(f => { f.mimetype = resolveMimeType(f); });

  const jobId = `j${Date.now()}${++jobSeq}`;
  jobs.set(jobId, { status: 'processing', createdAt: Date.now() });
  processUploadJob(jobId, files, req.hostId); // fire-and-forget
  res.json({ jobId });
});

// GET /api/upload/status/:jobId — poll for job result
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json({ status: job.status, results: job.results || null, error: job.error || null });
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
