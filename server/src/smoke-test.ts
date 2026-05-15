/**
 * End-to-end smoke test of the Socket.IO protocol.
 *
 * Spins up two clients, walks through the room lifecycle: create → join →
 * place → ready → shoot → emote → disconnect. Asserts the right events fire
 * to the right peer. Run with:
 *   npm run smoke      (server must already be running on :3001)
 */
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  CreateRoomRes,
  EmoteEvent,
  GameStartedEvent,
  JoinRoomRes,
  OpponentLeftEvent,
  PlaceShipsRes,
  QuickPlaceRes,
  ReadyRes,
  RematchRes,
  ServerToClientEvents,
  ShootRes,
  ShotResultEvent,
} from '@battlenaval/shared';

type TS = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const URL = process.env.SMOKE_URL ?? 'http://localhost:3001';

function connect(): Promise<TS> {
  return new Promise((resolve, reject) => {
    const socket: TS = ioClient(URL, { transports: ['websocket'] });
    const timer = setTimeout(() => reject(new Error('connect timeout')), 3000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function emit<E extends keyof ClientToServerEvents, TRes>(
  socket: TS,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
  timeoutMs = 3000,
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`ack timeout: ${String(event)}`)),
      timeoutMs,
    );
    // The Socket.IO types model ack callbacks but the variadic signature
    // makes generic forwarding awkward — use `any` to dispatch.
    (socket as unknown as { emit: (e: string, p: unknown, cb: (r: TRes) => void) => void })
      .emit(event as string, payload, (res: TRes) => {
        clearTimeout(timer);
        resolve(res);
      });
  });
}

function once<E extends keyof ServerToClientEvents>(
  socket: TS,
  event: E,
  timeoutMs = 3000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${String(event)}`)),
      timeoutMs,
    );
    // socket.once signature is loose for typed events; bridge it.
    (socket as unknown as {
      once: (e: string, h: (p: Parameters<ServerToClientEvents[E]>[0]) => void) => void;
    }).once(event as string, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`✗ ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✓ ${msg}`);
}

async function main(): Promise<void> {
  console.log(`[smoke] connecting to ${URL}`);

  const A = await connect();
  const B = await connect();
  console.log(`[smoke] both sockets connected`);

  // ─── 1. Create room ──────────────────────────────────────
  const created = await emit<'create_room', CreateRoomRes>(A, 'create_room', {
    size: 8,
    nickname: 'TesterA',
  });
  assert(created.ok === true, 'create_room ok');
  if (!created.ok) throw new Error('unreachable');
  const code = created.code;
  assert(/^[A-HJ-NP-Z]{3}-[2-9]{3}$/.test(code), `code looks valid: ${code}`);
  assert(created.role === 'A', 'host role is A');

  // ─── 2. Join room (A should be notified) ─────────────────
  const opponentJoinedAtA = once(A, 'opponent_joined');
  const joined = await emit<'join_room', JoinRoomRes>(B, 'join_room', {
    code,
    nickname: 'TesterB',
  });
  assert(joined.ok === true, 'join_room ok');
  if (!joined.ok) throw new Error('unreachable');
  assert(joined.role === 'B', 'guest role is B');
  assert(joined.size === 8, 'size echoed back');
  await opponentJoinedAtA;
  console.log('✓ A received opponent_joined');

  // 2b. Trying to join with a bogus code rejects cleanly
  const bogus = await emit<'join_room', JoinRoomRes>(A, 'join_room', {
    code: 'ZZZ-999',
    nickname: 'Anyone',
  });
  assert(bogus.ok === false, 'bogus code rejected');

  // 2c. join_room echoes back nicknames
  if (joined.ok) {
    assert(joined.nickname === 'TesterB', 'guest nickname echoed');
    assert(joined.opponentNickname === 'TesterA', 'host nickname visible to guest');
  }

  // ─── 3. Both quick_place ─────────────────────────────────
  const aPlace = await emit<'quick_place', QuickPlaceRes>(A, 'quick_place', {});
  const bPlace = await emit<'quick_place', QuickPlaceRes>(B, 'quick_place', {});
  assert(aPlace.ok && bPlace.ok, 'both auto-placed');
  if (!aPlace.ok || !bPlace.ok) throw new Error('unreachable');
  assert(aPlace.ships.length >= 3, `A fleet placed (${aPlace.ships.length} ships)`);

  // ─── 4. Both ready → game_started ────────────────────────
  const opponentReadyAtB = once(B, 'opponent_ready');
  const startA = once(A, 'game_started');
  const startB = once(B, 'game_started');
  const aReady = await emit<'ready', ReadyRes>(A, 'ready', {});
  assert(aReady.ok, 'A ready');
  await opponentReadyAtB;
  console.log('✓ B received opponent_ready');
  const bReady = await emit<'ready', ReadyRes>(B, 'ready', {});
  assert(bReady.ok, 'B ready');
  const [startedA, startedB] = (await Promise.all([startA, startB])) as [
    GameStartedEvent,
    GameStartedEvent,
  ];
  assert(startedA.firstTurn === startedB.firstTurn, 'both see same firstTurn');
  assert(
    typeof startedA.turnDeadline === 'number' && startedA.turnDeadline > Date.now(),
    'game_started includes turnDeadline in the future',
  );
  console.log(`✓ game_started, firstTurn=${startedA.firstTurn}`);

  // ─── 5. First shot is broadcast to both ──────────────────
  const firstTurn = startedA.firstTurn;
  const shooter = firstTurn === 'A' ? A : B;
  const aSR = once(A, 'shot_result');
  const bSR = once(B, 'shot_result');
  const fired = await emit<'shoot', ShootRes>(shooter, 'shoot', { cell: { x: 0, y: 0 } });
  assert(fired.ok, 'shoot accepted');
  const [srA, srB] = (await Promise.all([aSR, bSR])) as [ShotResultEvent, ShotResultEvent];
  assert(srA.byPlayer === firstTurn, 'A sees correct byPlayer');
  assert(srB.byPlayer === firstTurn, 'B sees correct byPlayer');
  assert(srA.cell.x === 0 && srA.cell.y === 0, 'cell echoed');
  assert(
    typeof srA.turnDeadline === 'number' && srA.turnDeadline > Date.now(),
    'shot_result carries a fresh turnDeadline while game continues',
  );

  // 5b. Wrong-turn shoot is rejected (use server-reported nextTurn — not firstTurn,
  // since the first shot may have changed who's up).
  const nextTurn = srA.nextTurn;
  const offTurnShooter = nextTurn === 'A' ? B : A;
  const rejected = await emit<'shoot', ShootRes>(offTurnShooter, 'shoot', {
    cell: { x: 1, y: 1 },
  });
  assert(rejected.ok === false, `off-turn shoot rejected (nextTurn=${nextTurn})`);

  // ─── 6. Emote — only the other player receives it ────────
  const sender = firstTurn === 'A' ? B : A;
  const receiver = firstTurn === 'A' ? A : B;
  const emoteAtReceiver = once(receiver, 'emote');
  await emit(sender, 'send_emote', { code: '🎯', label: 'Buen tiro' });
  const emoted = (await emoteAtReceiver) as EmoteEvent;
  assert(emoted.code === '🎯', 'emote code passed through');
  assert(emoted.from === (firstTurn === 'A' ? 'B' : 'A'), 'emote from correct player');

  // ─── 7. Rematch before game over → rejected ──────────────
  const earlyRematch = await emit<'rematch', RematchRes>(A, 'rematch', {});
  assert(earlyRematch.ok === false, 'rematch before game over rejected');

  // ─── 8. Disconnect — opponent gets opponent_left ─────────
  const remaining = sender === A ? B : A;
  const leftEvent = once(remaining, 'opponent_left');
  sender.disconnect();
  const left = (await leftEvent) as OpponentLeftEvent;
  assert(left.graceSeconds === 30, `opponent_left graceSeconds=${left.graceSeconds}`);

  // Cleanup
  remaining.disconnect();
  console.log('\n🎉 Smoke test PASSED');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Smoke test FAILED:', err.message ?? err);
    process.exit(1);
  });

// Touch types to satisfy unused-import checks
void ({} as PlaceShipsRes);
