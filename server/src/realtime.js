'use strict';

const { WebSocketServer, WebSocket } = require('ws');
const { verifyToken, getUserById } = require('./auth');
const { visibleOwnerIds, approvedAdvisorIds } = require('./permissions');

const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_PATH = '/api/ws';

let wss = null;
let heartbeat = null;
const clients = new Set();

function sendJson(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    console.error('[ws] send failed:', error.message);
  }
}

async function refreshSubscriptions(ws) {
  if (!ws.user) return;
  try {
    ws.owners = new Set(await visibleOwnerIds(ws.user));
  } catch (error) {
    console.error('[ws] subscription refresh failed:', error.message);
  }
}

async function deny(socket) {
  socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  socket.destroy();
}

function initRealtime(server) {
  if (wss) return wss;
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url || '', 'http://localhost');
    } catch (_) {
      socket.destroy();
      return;
    }
    if (url.pathname !== WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }

    const payload = verifyToken(url.searchParams.get('token'));
    if (!payload) {
      await deny(socket);
      return;
    }
    let user;
    try {
      user = await getUserById(payload.sub);
    } catch (error) {
      console.error('[ws] authentication lookup failed:', error.message);
      await deny(socket);
      return;
    }
    if (!user) {
      await deny(socket);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = String(user.id);
      ws.user = user;
      ws.owners = new Set([String(user.id)]);
      ws.isAlive = true;
      clients.add(ws);

      refreshSubscriptions(ws).catch(() => {});
      sendJson(ws, {
        type: 'ready',
        serverTime: new Date().toISOString(),
        user: { id: user.id, role: user.role },
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });
      ws.on('message', async (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.type === 'ping') {
            sendJson(ws, { type: 'pong', serverTime: new Date().toISOString() });
          } else if (message.type === 'subscribe') {
            await refreshSubscriptions(ws);
            sendJson(ws, { type: 'subscribed', owners: [...ws.owners] });
          }
        } catch (_) {
          sendJson(ws, { type: 'error', error: 'invalid message' });
        }
      });
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
    });
  });

  heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (_) {
        ws.terminate();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  console.log(`[ws] WebSocket endpoint ready at ${WS_PATH}?token=...`);
  return wss;
}

/** Broadcast a committed change to its owner and all approved advisors. */
async function publish(event) {
  if (!wss || clients.size === 0 || !event) return;
  const ownerId = String(event.ownerId || '');
  const advisorIds = await approvedAdvisorIds(ownerId);
  const recipients = new Set([ownerId, ...advisorIds]);
  const message = JSON.stringify({
    type: 'change',
    table: event.table,
    id: event.id,
    op: event.op,
    updated: event.updated,
    data: event.data,
  });
  for (const ws of clients) {
    if (recipients.has(String(ws.userId)) && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('[ws] broadcast failed:', error.message);
      }
    }
  }
}

/** Call after approving/creating a link so connected advisors refresh their sets. */
async function refreshAllSubscriptions() {
  await Promise.all([...clients].map((ws) => refreshSubscriptions(ws)));
}

function clientCount() {
  return clients.size;
}

function closeRealtime() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const ws of clients) ws.terminate();
  clients.clear();
  if (wss) wss.close();
  wss = null;
}

module.exports = {
  initRealtime,
  publish,
  refreshAllSubscriptions,
  clientCount,
  closeRealtime,
  WS_PATH,
};
