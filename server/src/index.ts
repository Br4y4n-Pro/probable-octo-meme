import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  LeaderboardResponse,
  ServerToClientEvents,
} from '@battlenaval/shared';
import { registerHandlers } from './handlers.js';
import { flushScores, getTop, getTotalEntries } from './scores.js';

const PORT = Number(process.env.PORT) || 3001;
// In same-origin deploys CLIENT_ORIGIN is irrelevant (no CORS triggered).
// In split deploys, set it to the static-host URL (e.g. https://app.example.com).
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get('/leaderboard', (req, res) => {
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || 50),
    200,
  );
  const payload: LeaderboardResponse = {
    top: getTop(limit),
    total: getTotalEntries(),
  };
  res.json(payload);
});

// ─── Serve built client (same-origin deploy) ───────────────────────────────
// When client/dist exists (production), serve it from this server and fall back
// to index.html for unknown GETs so deep links work.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/health') ||
      req.path.startsWith('/leaderboard') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
  console.log(`[server] serving client from ${CLIENT_DIST}`);
} else {
  console.log(
    `[server] client dist not found at ${CLIENT_DIST} — running API-only`,
  );
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    flushScores();
    process.exit(0);
  });
}

const httpServer = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  { cors: { origin: CLIENT_ORIGIN } },
);

registerHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] cors origin: ${CLIENT_ORIGIN}`);
});
