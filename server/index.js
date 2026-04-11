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
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/ezpass', require('./routes/ezpass'));
app.use('/api/results', require('./routes/results'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/integrations', require('./routes/integrations'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React build in production
if (IS_PROD) {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
