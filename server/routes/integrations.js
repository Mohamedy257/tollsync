const express = require('express');
const { google } = require('googleapis');
const auth = require('../middleware/auth');
const { store, uid } = require('../db/store');
const { parseTextAsTrips } = require('../services/ai');

const router = express.Router();

const DEFAULT_CONFIG = {
  query: 'from:noreply@mail.turo.com',
  subjectRegex: "trip with your .+ is booked|has changed their trip with your",
  maxResults: 50,
  afterDate: '',
};

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/gmail/callback'
  );
}

// GET /api/integrations/gmail/auth — get OAuth URL
router.get('/gmail/auth', auth, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Gmail integration not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: String(req.hostId),
    prompt: 'consent',
  });
  res.json({ url });
});

// GET /api/integrations/gmail/callback — OAuth callback from Google (no auth middleware)
router.get('/gmail/callback', async (req, res) => {
  const { code, state: hostId, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (error) return res.redirect(`${clientUrl}/integrations?gmail=error&reason=${error}`);
  if (!code || !hostId) return res.redirect(`${clientUrl}/integrations?gmail=error&reason=missing_params`);

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    store.gmail_tokens[hostId] = tokens;
    res.redirect(`${clientUrl}/integrations?gmail=connected`);
  } catch (err) {
    console.error('Gmail OAuth callback error:', err.message, err.response?.data);
    const reason = encodeURIComponent(err.response?.data?.error_description || err.response?.data?.error || err.message || 'token_exchange');
    res.redirect(`${clientUrl}/integrations?gmail=error&reason=${reason}`);
  }
});

// GET /api/integrations/gmail/status
router.get('/gmail/status', auth, (req, res) => {
  const tokens = store.gmail_tokens[req.hostId];
  const config = store.gmail_config[req.hostId] || DEFAULT_CONFIG;
  res.json({ connected: !!tokens, config });
});

// DELETE /api/integrations/gmail/disconnect
router.delete('/gmail/disconnect', auth, (req, res) => {
  delete store.gmail_tokens[req.hostId];
  res.json({ success: true });
});

// PUT /api/integrations/gmail/config
router.put('/gmail/config', auth, (req, res) => {
  const { query, subjectRegex, maxResults, afterDate } = req.body;
  // Validate regex
  if (subjectRegex) {
    try { new RegExp(subjectRegex); } catch {
      return res.status(400).json({ error: 'Invalid subject regex' });
    }
  }
  store.gmail_config[req.hostId] = {
    query: (query || DEFAULT_CONFIG.query).trim(),
    subjectRegex: (subjectRegex || '').trim(),
    maxResults: Math.max(1, Math.min(parseInt(maxResults) || 50, 10000)),
    afterDate: (afterDate || '').trim(),
  };
  res.json({ config: store.gmail_config[req.hostId] });
});

// POST /api/integrations/gmail/sync — fetch emails and parse trips
router.post('/gmail/sync', auth, async (req, res) => {
  const tokens = store.gmail_tokens[req.hostId];
  if (!tokens) return res.status(401).json({ error: 'Gmail not connected' });

  const config = store.gmail_config[req.hostId] || DEFAULT_CONFIG;

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Save refreshed tokens automatically
    oauth2Client.on('tokens', (newTokens) => {
      store.gmail_tokens[req.hostId] = { ...tokens, ...newTokens };
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let query = config.query;
    if (config.afterDate) query += ` after:${config.afterDate.replace(/-/g, '/')}`;

    // Paginate to collect up to maxResults messages (Gmail API max 500/page)
    const messages = [];
    let pageToken;
    do {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(500, config.maxResults - messages.length),
        ...(pageToken ? { pageToken } : {}),
      });
      const batch = listRes.data.messages || [];
      messages.push(...batch);
      pageToken = listRes.data.nextPageToken;
    } while (pageToken && messages.length < config.maxResults);

    if (!messages.length) return res.json({ synced: 0, skipped: 0, errors: [], total: 0 });

    // Fetch all email bodies in parallel
    const messageDetails = await Promise.all(
      messages.map(m =>
        gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
          .then(r => ({ id: m.id, data: r.data, error: null }))
          .catch(err => ({ id: m.id, data: null, error: err.message }))
      )
    );

    // Apply subject regex filter if configured
    const subjectRegex = config.subjectRegex ? new RegExp(config.subjectRegex, 'i') : null;
    const filtered = subjectRegex
      ? messageDetails.filter(({ data, error }) => {
          if (error || !data) return true; // keep errored ones to report
          const subject = getHeader(data, 'Subject') || '';
          return subjectRegex.test(subject);
        })
      : messageDetails;

    let synced = 0, skipped = 0;
    const errors = [];

    // Parse emails — AI calls in parallel
    const parseJobs = await Promise.all(
      filtered.map(async ({ id, data, error }) => {
        if (error) return { id, trips: null, error };
        try {
          const subject = getHeader(data, 'Subject') || '';
          const body = extractEmailBody(data);
          if (!body) return { id, trips: null, error: 'No body' };
          const text = `Subject: ${subject}\n\n${body}`;
          const trips = await parseTextAsTrips(text);
          return { id, trips, error: null };
        } catch (err) {
          return { id, trips: null, error: err.message };
        }
      })
    );

    for (const { id, trips, error } of parseJobs) {
      if (error || !trips || !trips.length) {
        skipped++;
        if (error && error !== 'No body') errors.push({ id, error });
        continue;
      }

      let insertedAny = false;
      for (const trip of trips) {
        if (!trip.start_datetime || !trip.end_datetime) continue;

        // Validate has time component
        const hasTime = dt => /T\d{2}:\d{2}/.test(dt) && !/T00:00(:\d{2})?Z?$/.test(dt);
        if (!hasTime(trip.start_datetime) || !hasTime(trip.end_datetime)) continue;

        // If same trip_id exists, update end date (trip extension) and skip insert
        if (trip.trip_id) {
          const existing = store.trips.find(t => t.host_id === req.hostId && t.trip_id === trip.trip_id);
          if (existing) {
            if (trip.end_datetime && trip.end_datetime !== existing.end_datetime) {
              existing.end_datetime = trip.end_datetime;
              insertedAny = true;
            }
            continue;
          }
        }

        // Deduplicate by renter + dates
        const duplicate = store.trips.find(t =>
          t.host_id === req.hostId &&
          t.renter_name === trip.renter_name &&
          t.start_datetime === trip.start_datetime &&
          t.end_datetime === trip.end_datetime
        );
        if (duplicate) continue;

        const vehicleName = (trip.vehicle || '').trim();
        const plate = (trip.plate || '').trim().toUpperCase();

        // Vehicle matching — same logic as upload route (registered only)
        let vehicle_id = null;
        if (vehicleName || plate) {
          const myVehicles = store.vehicles.filter(v => v.host_id === req.hostId);
          if (plate) {
            const plateMatch = myVehicles.find(v => v.plate && v.plate.toUpperCase() === plate && v.transponder_id);
            if (plateMatch) vehicle_id = plateMatch.id;
          }
          if (!vehicle_id) {
            const registeredMatches = myVehicles.filter(
              v => vehicleName && v.name.toLowerCase() === vehicleName.toLowerCase() && v.transponder_id
            );
            if (registeredMatches.length === 0 && vehicleName) {
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
              if (!plate || !existingPlate || plate === existingPlate) {
                vehicle_id = existing.id;
              } else {
                const newVehicle = {
                  id: uid(), host_id: req.hostId, name: vehicleName,
                  plate, transponder_id: '',
                  created_at: new Date().toISOString(), auto_added: true,
                };
                store.vehicles.push(newVehicle);
                vehicle_id = newVehicle.id;
              }
            } else if (registeredMatches.length > 1) {
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

        store.trips.push({
          id: uid(), host_id: req.hostId,
          renter_name: trip.renter_name, vehicle: vehicleName,
          plate: plate || '', vehicle_id,
          start_datetime: trip.start_datetime, end_datetime: trip.end_datetime,
          trip_id: trip.trip_id || null, source_file: 'Gmail',
        });
        insertedAny = true;
      }

      if (insertedAny) synced++; else skipped++;
    }

    res.json({ synced, skipped, errors, total: messages.length });
  } catch (err) {
    console.error('Gmail sync error:', err);
    // Handle token expiry
    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      delete store.gmail_tokens[req.hostId];
      return res.status(401).json({ error: 'Gmail session expired. Please reconnect.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- Helpers ---

function getHeader(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractEmailBody(message) {
  const parts = [];
  collectParts(message.payload, parts);

  // Prefer plain text, fall back to HTML stripped of tags
  const plain = parts.find(p => p.mimeType === 'text/plain');
  if (plain?.body?.data) return decodeBase64(plain.body.data);

  const html = parts.find(p => p.mimeType === 'text/html');
  if (html?.body?.data) return stripHtml(decodeBase64(html.body.data));

  return null;
}

function collectParts(part, out) {
  if (!part) return;
  if (part.body?.data) out.push(part);
  if (part.parts) part.parts.forEach(p => collectParts(p, out));
}

function decodeBase64(data) {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = router;
