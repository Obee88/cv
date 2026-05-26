const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./db/migrate');
const authRoutes = require('./routes/auth');
const cvRoutes = require('./routes/cv');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // allow base64 photo uploads

// Health check — used by Docker HEALTHCHECK and dashboard
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cv', cvRoutes);

// Serve compiled React app (written here by Dockerfile)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
