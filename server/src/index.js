'use strict';

const http = require('node:http');
const path = require('node:path');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { migrate, closePool } = require('./db');
const auth = require('./auth');
const routes = require('./routes');
const realtime = require('./realtime');

const PORT = Number.parseInt(process.env.PORT, 10) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || '*';
const allowedOrigins = WEB_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function maskedDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.toString();
  } catch (_) {
    return '(invalid DATABASE_URL)';
  }
}

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.json({ limit: '2mb' }));

app.use(auth.router);
app.use(routes.router);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((error, _req, res, _next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'request body too large' });
  }
  console.error('[http]', error.stack || error.message);
  if (res.headersSent) return res.end();
  const status = Number.isInteger(error.status) ? error.status : 500;
  return res.status(status).json({
    error: status === 500 ? 'internal server error' : error.message,
  });
});

async function start() {
  await migrate();
  try {
    auth.loadSmsProviderFromEnv();
  } catch (error) {
    console.error('[auth] cannot load SMS provider:', error.message);
  }

  const server = http.createServer(app);
  realtime.initRealtime(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, resolve);
  });

  console.log(`[server] Masir sync API listening on http://localhost:${PORT}`);
  console.log('[server] health: GET /api/health');
  console.log(`[server] websocket: ${realtime.WS_PATH}?token=...`);
  console.log(`[server] database: ${maskedDatabaseUrl(process.env.DATABASE_URL || '')}`);
  console.log(`[server] WEB_ORIGIN: ${WEB_ORIGIN}`);
  console.log(`[server] OTP_DEV_PRINT: ${/^(1|true|yes|on)$/i.test(process.env.OTP_DEV_PRINT || 'false')}`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);
    realtime.closeRealtime();
    await new Promise((resolve) => server.close(resolve));
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('[server] startup failed:', error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
