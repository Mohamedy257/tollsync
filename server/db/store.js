// In-memory store replacing PostgreSQL
let nextId = 1;
const uid = () => nextId++;

const store = {
  hosts: [],
  vehicles: [],
  trips: [],
  toll_transactions: [],
  trip_results: [],
  ezpass_report_range: {}, // keyed by hostId → { from, to }
  gmail_tokens: {},        // keyed by hostId → { access_token, refresh_token, expiry_date }
  gmail_config: {},        // keyed by hostId → { query, maxResults, afterDate }
};

module.exports = { store, uid };
