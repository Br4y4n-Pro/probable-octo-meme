import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  LeaderboardResponse,
  ServerToClientEvents,
} from '@battlenaval/shared';
import { registerHandlers } from './handlers.js';
import { flushScores, getTop, getTotalEntries } from './scores.js';

const PORT = Number(process.env.PORT) || 3001;
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
