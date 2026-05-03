const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EZPASS_PROMPT = `Extract all EZ-Pass toll transactions from this document.
Return ONLY a raw JSON array, no markdown, no explanation.
The document has columns including: Transponder/Plate, Agency, Entry Plaza, Exit Plaza, Entry Date and Time, Exit Date and Time, Plaza Facility, Amount.
Each object must have exactly these fields:
- transponder_id: the value in the Transponder or Transponder/Plate column (string)
- entry_datetime: ISO 8601 from Entry Date and Time column, null if the cell is blank
- exit_datetime: ISO 8601 from Exit Date and Time column, null if the cell is blank
- agency: the short agency code in the Agency column (e.g. "MdTA", "VDOT", "NJTP", "GSP"), null if blank
- entry_plaza: the code or name in the Entry Plaza column, null if blank
- exit_plaza: the code or name in the Exit Plaza column, null if blank
- plaza_facility: the text in the Plaza Facility column (e.g. "I66 OUTSIDE BELTWAY", "495 EXPRESS LANES"), null if blank
- amount: positive dollar amount, strip any minus sign
Exclude rows where Transaction contains "CREDIT CARD PAYMENT" or "REPLENISHMENT".`;

function getTripsPrompt() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `Extract all car rental trip records from this file.
Return ONLY a raw JSON array, no markdown, no explanation.
Each object must have:
- renter_name (string)
- vehicle (string - make/model/year ONLY if explicitly written as text; do NOT visually guess from car photos, return null if not found as text)
- start_datetime (ISO 8601)
- end_datetime (ISO 8601)
- trip_id (string or null)

IMPORTANT: Today is ${year}-${String(month).padStart(2,'0')}. The current year is ${year}.
If the screenshot does not show a year, you MUST use ${year} — never guess an older year like 2020, 2021, etc.
Double-check: all dates must have year ${year} unless the file explicitly states a different year.`;
}

async function parseFileWithAI(fileBuffer, mimeType, type) {
  const prompt = type === 'trips' ? getTripsPrompt() : EZPASS_PROMPT;
  const b64 = fileBuffer.toString('base64');
  if (!b64) throw new Error('File is empty or could not be read');

  let content;
  if (mimeType === 'application/pdf') {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
      { type: 'text', text: prompt }
    ];
  } else if (mimeType.startsWith('image/')) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
      { type: 'text', text: prompt }
    ];
  } else {
    // CSV and any other text-based format
    const text = fileBuffer.toString('utf-8');
    content = `${prompt}\n\nFile content:\n${text.slice(0, 25000)}`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [{ role: 'user', content }]
  });

  const raw = response.content.map(b => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();

  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in AI response');
  return JSON.parse(clean.slice(start, end + 1));
}

// Deterministic code-based matching using vehicle_id → transponder, with plate fallback
function matchTollsToTrips(vehicles, trips, tolls) {
  // Index vehicles by id for fast lookup
  const vehicleById = {};
  for (const v of vehicles) vehicleById[v.id] = v;

  const tripResults = trips.map(t => ({
    ...t,
    total_tolls: 0,
    toll_count: 0,
    toll_items: [],
  }));

  // Track which tolls have already been assigned so no toll is double-counted
  const assignedTollIds = new Set();

  // Process trips in chronological order — earlier trips get priority when
  // two trips for the same vehicle overlap in time.
  const orderedTrips = [...tripResults].sort(
    (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)
  );

  for (const trip of orderedTrips) {
    const vehicle = vehicleById[trip.vehicle_id];
    if (!vehicle) continue;

    const transponder = (vehicle.transponder || '').replace(/\D/g, ''); // digits only
    const plate = (vehicle.plate || '').replace(/\s/g, '').toUpperCase();
    if (!transponder && !plate) continue; // vehicle has no identifiers yet

    const tripStart = new Date(trip.start_datetime).getTime();
    const tripEnd = new Date(trip.end_datetime).getTime();
    if (isNaN(tripStart) || isNaN(tripEnd)) continue;

    for (const toll of tolls) {
      if (assignedTollIds.has(toll.toll_db_id)) continue;

      const matchTime = toll.exit_datetime || toll.entry_datetime;
      if (!matchTime) continue;
      const tollMs = new Date(matchTime).getTime();
      if (isNaN(tollMs) || tollMs < tripStart || tollMs > tripEnd) continue;

      // Normalize toll transponder to digits only — handles dashes, spaces, etc.
      const tollKey = (toll.transponder_id || '').replace(/\D/g, '');
      const byTransponder = transponder && tollKey && (() => {
        if (transponder === tollKey) return true;
        // Suffix match: toll files sometimes strip leading digits
        // e.g. vehicle "01010504474" → toll shows "10504474"
        const shorter = transponder.length < tollKey.length ? transponder : tollKey;
        const longer  = transponder.length < tollKey.length ? tollKey : transponder;
        if (shorter.length >= 4 && longer.endsWith(shorter)) return true;
        // Zero-pad the shorter one to the longer's length and compare
        // handles cases where exactly N leading zeros/digits are stripped
        return shorter.padStart(longer.length, '0') === longer;
      })();
      const byPlate = plate && tollKey.toUpperCase() === plate;
      if (!byTransponder && !byPlate) continue;

      assignedTollIds.add(toll.toll_db_id);
      const result = tripResults.find(r => r.trip_db_id === trip.trip_db_id);
      result.toll_items.push({
        toll_db_id: toll.toll_db_id,
        entry_datetime: toll.entry_datetime,
        exit_datetime: toll.exit_datetime,
        location: toll.location,
        amount: toll.amount,
        transponder_id: toll.transponder_id,
      });
      result.total_tolls = +(result.total_tolls + toll.amount).toFixed(2);
      result.toll_count++;
    }
  }

  const unmatchedTolls = tolls.filter(t => !assignedTollIds.has(t.toll_db_id));
  const total_matched = tripResults.reduce((s, t) => s + t.total_tolls, 0);
  const total_unmatched = unmatchedTolls.reduce((s, t) => s + t.amount, 0);

  return {
    trips: tripResults,
    unmatched_tolls: unmatchedTolls,
    total_matched: +total_matched.toFixed(2),
    total_unmatched: +total_unmatched.toFixed(2),
  };
}

function buildAutoDetectPrompt() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `Look at this file and determine what type it is, then extract the data.

If it is a car rental trip receipt/reservation/screenshot (shows renter name, vehicle, trip dates):
Return: { "type": "trips", "data": [ { "renter_name", "vehicle", "plate", "start_datetime", "end_datetime", "trip_id" } ] }

If it is an EZ-Pass toll statement/transaction history (shows toll transactions, transponder IDs, amounts):
Return: { "type": "ezpass", "report_from": "<ISO 8601 date or null>", "report_to": "<ISO 8601 date or null>", "data": [ { "transponder_id": "...", "entry_datetime": "...", "exit_datetime": "...", "agency": "...", "entry_plaza": "...", "exit_plaza": "...", "plaza_facility": "...", "amount": 0.00 } ] }

Rules:
- Return ONLY raw JSON, no markdown, no explanation.
- For trips: Today is ${year}-${String(month).padStart(2,'0')}. Use year ${year} for all dates if the year is not shown. Never use an older year like 2020.
- For trips: "plate" is the license plate number that is explicitly written as text in the screenshot (e.g. "ABC1234"), or null if not found as text.
- For trips: "vehicle" is the make/model/year string ONLY if it is explicitly written as text (e.g. "Nissan Altima 2020"). Do NOT visually identify the vehicle from photos or images of cars — if the vehicle name is not written as readable text, return null.
- For ezpass: entry_datetime and exit_datetime must be ISO 8601 (null if blank). amount must be positive, strip minus signs. Exclude CREDIT CARD PAYMENT and REPLENISHMENT rows.
- For ezpass: agency = the short code in the Agency column (e.g. "MdTA", "VDOT", "NJTP"). entry_plaza = Entry Plaza column value. exit_plaza = Exit Plaza column value. plaza_facility = Plaza Facility column text (e.g. "I66 OUTSIDE BELTWAY"). Return null for any field whose cell is blank.
- For ezpass: "report_from" and "report_to" are the statement's date range (e.g. "From: 3/2/2026 To: 4/1/2026" → report_from: "2026-03-02", report_to: "2026-04-01"). Use null if not found.`;
}

async function parseFileAutoDetect(fileBuffer, mimeType) {
  const prompt = buildAutoDetectPrompt();
  const b64 = fileBuffer.toString('base64');
  if (!b64) throw new Error('File is empty or could not be read');

  let content;
  if (mimeType === 'application/pdf') {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
      { type: 'text', text: prompt }
    ];
  } else if (mimeType.startsWith('image/')) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
      { type: 'text', text: prompt }
    ];
  } else {
    // CSV and any other text-based format
    const text = fileBuffer.toString('utf-8');
    content = `${prompt}\n\nFile content:\n${text.slice(0, 25000)}`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [{ role: 'user', content }]
  });

  const raw = response.content.map(b => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response');
  const result = JSON.parse(clean.slice(start, end + 1));
  if (!result.type || !Array.isArray(result.data)) throw new Error('Unexpected AI response structure');
  return result;
}

// Process multiple image files in a single AI call so multi-page documents
// (e.g. EZPass statements spanning several screenshots) share full context.
async function parseMultipleImagesAutoDetect(fileItems) {
  const prompt = buildAutoDetectPrompt();
  const content = [];
  for (const { buffer, mimeType } of fileItems) {
    const b64 = buffer.toString('base64');
    content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } });
  }
  content.push({ type: 'text', text: prompt });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [{ role: 'user', content }]
  });

  const raw = response.content.map(b => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response');
  const result = JSON.parse(clean.slice(start, end + 1));
  if (!result.type || !Array.isArray(result.data)) throw new Error('Unexpected AI response structure');
  return result;
}

// Parse plain text (e.g. email body) as trip data
async function parseTextAsTrips(text) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prompt = `Extract all car rental trip records from this email or text.
Return ONLY a raw JSON array, no markdown, no explanation.
Each object must have:
- renter_name (string)
- vehicle (string - make/model/year ONLY if explicitly written as text, or null)
- plate (string - license plate ONLY if explicitly written as text, or null)
- start_datetime (ISO 8601 with time)
- end_datetime (ISO 8601 with time)
- trip_id (string or null — look for a numeric ID in the subject like "(55545268)" or in the email body)

IMPORTANT: Today is ${year}-${String(month).padStart(2,'0')}. Use year ${year} if not shown.
If start or end time is not present in the text, return null for that trip (do not guess times).
For trip modification/extension emails: extract the updated end_datetime and the trip_id.
Return [] if no trips found.

Text:
${text.slice(0, 25000)}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content.map(b => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(clean.slice(start, end + 1));
}

module.exports = { parseFileWithAI, parseFileAutoDetect, parseMultipleImagesAutoDetect, matchTollsToTrips, parseTextAsTrips };
