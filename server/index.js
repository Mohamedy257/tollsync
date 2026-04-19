require('dotenv').config();
// Polyfills for Node < 18 (googleapis requires these globals)
if (typeof Headers === 'undefined') {
  const { Headers, Request, Response, fetch, Blob } = require('node-fetch');
  global.Headers = Headers;
  global.Request = Request;
  global.Response = Response;
  global.fetch = fetch;
  global.Blob = Blob;
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./db/mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure upload dirs exist
['uploads/trips', 'uploads/ezpass', 'uploads/auto'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const allowedOrigins = IS_PROD
  ? (process.env.CLIENT_URL ? [process.env.CLIENT_URL] : true)
  : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
// Stripe webhook needs raw body — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/ezpass', require('./routes/ezpass'));
app.use('/api/results', require('./routes/results'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/contact', require('./routes/contact'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React build in production
if (IS_PROD) {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });
