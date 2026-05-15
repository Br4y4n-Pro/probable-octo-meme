import {
  autoPlace,
  buildBoardFromInputs,
  cellKey,
  getFleet,
  otherPlayer,
  shoot as engineShoot,
  NICKNAME_REGEX,
  PLACEMENT_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  type BoardSize,
  type Cell,
  type ClientToServerEvents,
  type CreateRoomRes,
  type EmoteRes,
  type JoinRoomRes,
  type PlaceShipsRes,
  type Player,
  type Powerup,
  type QuickPlaceRes,
  type ReadyRes,
  type ReconnectRes,
  type RematchRes,
  type ServerToClientEvents,
  type ShootRes,
  type ShipPlacementInput,
  type ShotInfo,
  type SunkShipInfo,
  ROOM_CODE_REGEX,
} from '@battlenaval/shared';
import { incrementWin } from './scores.js';
import type { Server, Socket } from 'socket.io';
import { generateRoomCode, generateSessionToken } from './codes.js';
import {
  attachGuest,
  bindSocket,
  clearDisconnectTimer,
  clearPlacementTimer,
  clearTurnTimer,
  createRoom,
  deleteRoom,
  getRoom,
  getRoomBySocket,
  isCodeTaken,
  resetGame,
  setDisconnectTimer,
  setPlacementTimer,
  setTurnTimer,
  snapshotForReconnect,
  unbindSocket,
  type Room,
} from './rooms.js';

const VALID_SIZES: BoardSize[] = [8, 10, 12, 15, 30];
const DISCONNECT_GRACE_MS = 30_000;

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`[io] connected ${socket.id}`);

    socket.on('create_room', (req, cb) => {
      try {
        if (!VALID_SIZES.includes(req.size)) {
          cb({ ok: false, reason: 'invalid-size' });
          return;
        }
        const nickname = (req.nickname ?? '').trim();
        if (!NICKNAME_REGEX.test(nickname)) {
          cb({ ok: false, reason: 'invalid-nickname' });
          return;
        }
        if (getRoomBySocket(socket.id)) {
          cb({ ok: false, reason: 'already-in-room' });
          return;
        }
        const code = generateRoomCode(isCodeTaken);
        const token = generateSessionToken();
        const room = createRoom(code, req.size, socket.id, token, nickname);
        socket.join(code);
        const res: CreateRoomRes = {
          ok: true,
          code: room.code,
          role: 'A',
          sessionToken: token,
          size: room.size,
          nickname,
        };
        cb(res);
      } catch (err) {
        console.error('[create_room] error', err);
        cb({ ok: false, reason: 'internal' });
      }
    });

    socket.on('join_room', (req, cb) => {
      try {
        if (!ROOM_CODE_REGEX.test(req.code)) {
          cb({ ok: false, reason: 'invalid-code' });
          return;
        }
        const nickname = (req.nickname ?? '').trim();
        if (!NICKNAME_REGEX.test(nickname)) {
          cb({ ok: false, reason: 'invalid-nickname' });
          return;
        }
        const room = getRoom(req.code);
        if (!room) {
          cb({ ok: false, reason: 'not-found' });
          return;
        }
        if (room.players.B) {
          cb({ ok: false, reason: 'full' });
          return;
        }
        if (room.phase !== 'waiting') {
          cb({ ok: false, reason: 'in-progress' });
          return;
        }
        if (getRoomBySocket(socket.id)) {
          cb({ ok: false, reason: 'already-in-room' });
          return;
        }
        const token = generateSessionToken();
        attachGuest(room, socket.id, token, nickname);
        socket.join(room.code);
        socket.to(room.code).emit('opponent_joined', { nickname });
        setPlacementTimer(room, PLACEMENT_TIMEOUT_MS, () => {
          if (room.phase === 'placement') {
            closeRoomAndNotify(io, room, 'placement-timeout');
          }
        });
        const res: JoinRoomRes = {
          ok: true,
          role: 'B',
          sessionToken: token,
          size: room.size,
          opponentPresent: !!room.players.A?.socketId,
          nickname,
          opponentNickname: room.players.A?.nickname ?? '',
        };
        cb(res);
      } catch (err) {
        console.error('[join_room] error', err);
        cb({ ok: false, reason: 'not-found' });
      }
    });

    socket.on('reconnect_session', (req, cb) => {
      try {
        if (!ROOM_CODE_REGEX.test(req.code)) {
          cb({ ok: false, reason: 'not-found' });
          return;
        }
        const room = getRoom(req.code);
        if (!room) {
          cb({ ok: false, reason: 'not-found' });
          return;
        }
        const player = room.players[req.role];
        if (!player || player.sessionToken !== req.sessionToken) {
          cb({ ok: false, reason: 'invalid-token' });
          return;
        }
        bindSocket(room, req.role, socket.id);
        socket.join(room.code);
        clearDisconnectTimer(room, req.role);
        socket.to(room.code).emit('opponent_reconnected', {});
        const snap = snapshotForReconnect(room, req.role);
        if (!snap) {
          cb({ ok: false, reason: 'not-found' });
          return;
        }
        const res: ReconnectRes = { ok: true, snapshot: snap };
        cb(res);
      } catch (err) {
        console.error('[reconnect_session] error', err);
        cb({ ok: false, reason: 'not-found' });
      }
    });

    socket.on('place_ships', (req, cb) => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const { room, role } = entry;
      if (room.phase !== 'placement') {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const result = buildBoardFromInputs(room.size, req.ships);
      if (!result.ok) {
        cb({ ok: false, reason: result.reason });
        return;
      }
      room.game = {
        ...room.game,
        boards: { ...room.game.boards, [role]: result.board },
      };
      const player = room.players[role];
      if (player) {
        player.placed = true;
        // If they were already "ready" and they replaced placement (edge case), reset ready.
        player.ready = false;
        room.game = {
          ...room.game,
          ready: { ...room.game.ready, [role]: false },
        };
      }
      const res: PlaceShipsRes = { ok: true };
      cb(res);
    });

    socket.on('quick_place', (_req, cb) => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const { room, role } = entry;
      if (room.phase !== 'placement') {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const fleet = getFleet(room.size);
      const board = autoPlace(room.size, fleet);
      room.game = {
        ...room.game,
        boards: { ...room.game.boards, [role]: board },
      };
      const player = room.players[role];
      if (player) {
        player.placed = true;
        player.ready = false;
      }
      const ships: ShipPlacementInput[] = board.ships.map((s) => ({
        pieceId: s.pieceId,
        origin: s.origin,
        rotation: s.rotation,
      }));
      const res: QuickPlaceRes = { ok: true, ships };
      cb(res);
    });

    socket.on('ready', (_req, cb) => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const { room, role } = entry;
      if (room.phase !== 'placement') {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const player = room.players[role];
      if (!player || !player.placed) {
        cb({ ok: false, reason: 'not-placed' });
        return;
      }
      player.ready = true;
      room.game = {
        ...room.game,
        ready: { ...room.game.ready, [role]: true },
      };
      const opp = room.players[otherPlayer(role)];
      if (opp?.ready) {
        // Both ready — kick off the game
        const firstTurn: Player = Math.random() < 0.5 ? 'A' : 'B';
        room.game = { ...room.game, phase: 'playing', turn: firstTurn };
        room.phase = 'playing';
        clearPlacementTimer(room);
        const turnDeadline = setTurnTimer(room, TURN_TIMEOUT_MS, () =>
          handleTurnTimeout(io, room),
        );
        // Place 1 radar powerup on each player's water cells.
        room.powerups = {
          A: placePowerups(room.game.boards.A.width, room.game.boards.A.ships, 1),
          B: placePowerups(room.game.boards.B.width, room.game.boards.B.ships, 1),
        };
        room.consumedPowerups = { A: new Set(), B: new Set() };
        io.to(room.code).emit('game_started', {
          firstTurn,
          turnDeadline,
          powerups: { A: room.powerups.A, B: room.powerups.B },
        });
      } else {
        socket.to(room.code).emit('opponent_ready', {});
      }
      const res: ReadyRes = { ok: true };
      cb(res);
    });

    socket.on('shoot', (req, cb) => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const { room, role } = entry;
      if (room.phase !== 'playing') {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      // Player took a valid action — clear the turn timer before applying
      clearTurnTimer(room);

      const { state: nextGame, result } = engineShoot(room.game, role, req.cell);
      if (!result.ok) {
        // shouldn't happen — phase/turn already checked — but be safe and restart timer
        const turnDeadline = setTurnTimer(room, TURN_TIMEOUT_MS, () =>
          handleTurnTimeout(io, room),
        );
        cb({ ok: false, reason: result.reason });
        return;
      }
      room.game = nextGame;

      const opp = otherPlayer(role);
      let sunkShip: SunkShipInfo | undefined;
      if (result.sunkShipId) {
        const ship = nextGame.boards[opp].ships.find(
          (s) => s.pieceId === result.sunkShipId,
        );
        if (ship) {
          sunkShip = {
            pieceId: ship.pieceId,
            kind: ship.kind,
            name: ship.name,
            cells: ship.cells,
          };
        }
      }

      const gameContinues = !result.gameOver;
      const turnDeadline = gameContinues
        ? setTurnTimer(room, TURN_TIMEOUT_MS, () => handleTurnTimeout(io, room))
        : undefined;

      // Did this shot collect a powerup on the opponent's board?
      const oppPowerups = room.powerups[opp];
      const cellK = cellKey(req.cell);
      const matchingPowerup = oppPowerups.find(
        (p) =>
          p.cell.x === req.cell.x &&
          p.cell.y === req.cell.y &&
          !room.consumedPowerups[opp].has(cellK),
      );
      if (matchingPowerup) {
        room.consumedPowerups[opp].add(cellK);
      }

      const payload = {
        byPlayer: role,
        cell: req.cell,
        outcome: result.outcome,
        ...(sunkShip ? { sunkShip } : {}),
        nextTurn: nextGame.turn,
        ...(turnDeadline !== undefined ? { turnDeadline } : {}),
        ...(matchingPowerup ? { consumedPowerup: matchingPowerup } : {}),
      };
      io.to(room.code).emit('shot_result', payload);

      // Radar payoff: reveal a random unshot opponent ship cell to the shooter.
      if (matchingPowerup && matchingPowerup.kind === 'radar') {
        const revealed = pickUnshotShipCell(room, role, opp);
        if (revealed) {
          io.to(socket.id).emit('radar_reveal', { cell: revealed });
        }
      }

      if (result.gameOver) {
        room.phase = 'finished';
        const winnerPlayer = room.players[result.gameOver];
        if (winnerPlayer) incrementWin(winnerPlayer.nickname);
        io.to(room.code).emit('game_over', {
          winner: result.gameOver,
          reason: 'normal',
        });
      }

      const res: ShootRes = { ok: true };
      cb(res);
    });

    socket.on('send_emote', (req, cb) => {
      const entry = getRoomBySocket(socket.id);
      const res: EmoteRes = { ok: true };
      if (!entry) {
        cb(res);
        return;
      }
      const { room, role } = entry;
      socket
        .to(room.code)
        .emit('emote', { code: req.code, label: req.label, from: role });
      cb(res);
    });

    socket.on('rematch', (_req, cb) => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const { room, role } = entry;
      if (room.phase !== 'finished') {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      const player = room.players[role];
      if (!player) {
        cb({ ok: false, reason: 'wrong-phase' });
        return;
      }
      if (player.wantsRematch) {
        cb({ ok: false, reason: 'already-requested' });
        return;
      }
      player.wantsRematch = true;
      const opp = room.players[otherPlayer(role)];

      if (opp?.wantsRematch) {
        // Both agreed — reset the room for a new game
        resetGame(room);
        setPlacementTimer(room, PLACEMENT_TIMEOUT_MS, () => {
          if (room.phase === 'placement') {
            closeRoomAndNotify(io, room, 'placement-timeout');
          }
        });
        io.to(room.code).emit('rematch_started', {});
      } else {
        // Notify the other player that someone wants to rematch
        socket.to(room.code).emit('rematch_requested', { by: role });
      }

      const res: RematchRes = { ok: true };
      cb(res);
    });

    socket.on('leave', () => {
      const entry = getRoomBySocket(socket.id);
      if (!entry) return;
      closeRoomAndNotify(
        io,
        entry.room,
        entry.role === 'A' ? 'host-left' : 'guest-left',
      );
    });

    socket.on('disconnect', (reason) => {
      console.log(`[io] disconnected ${socket.id} (${reason})`);
      const entry = getRoomBySocket(socket.id);
      unbindSocket(socket.id);
      if (!entry) return;
      const { room, role } = entry;
      if (room.phase === 'waiting') {
        // Host left before guest joined — destroy the room
        deleteRoom(room.code);
        return;
      }
      // Inform opponent and start a grace timer
      io.to(room.code).emit('opponent_left', {
        graceSeconds: DISCONNECT_GRACE_MS / 1000,
      });
      setDisconnectTimer(room, role, DISCONNECT_GRACE_MS, () => {
        closeRoomAndNotify(io, room, 'opponent-timeout');
      });
    });
  });
}

function closeRoomAndNotify(
  io: TypedServer,
  room: Room,
  reason:
    | 'host-left'
    | 'guest-left'
    | 'opponent-timeout'
    | 'manual'
    | 'placement-timeout',
): void {
  io.to(room.code).emit('room_closed', { reason });
  // Detach any remaining sockets from the channel
  io.in(room.code).socketsLeave(room.code);
  deleteRoom(room.code);
}

/**
 * Place `count` powerups on random water cells (not on any ship) of a board.
 * Returns an empty array if there's not enough free space.
 */
function placePowerups(
  size: number,
  ships: { cells: Cell[] }[],
  count: number,
): Powerup[] {
  const occupied = new Set<string>();
  for (const s of ships) for (const c of s.cells) occupied.add(`${c.x},${c.y}`);
  const free: Cell[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  const placed: Powerup[] = [];
  for (let i = 0; i < count && free.length > 0; i++) {
    const idx = Math.floor(Math.random() * free.length);
    const [cell] = free.splice(idx, 1);
    if (cell) placed.push({ kind: 'radar', cell });
  }
  return placed;
}

/** Pick a random opponent ship cell that the shooter has not yet shot. */
function pickUnshotShipCell(
  room: Room,
  shooter: Player,
  target: Player,
): Cell | null {
  const shotKeys = new Set(Object.keys(room.game.shots[shooter]));
  const candidates: Cell[] = [];
  for (const ship of room.game.boards[target].ships) {
    for (const c of ship.cells) {
      if (!shotKeys.has(`${c.x},${c.y}`)) candidates.push(c);
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function handleTurnTimeout(io: TypedServer, room: Room): void {
  if (room.phase !== 'playing') return;
  const loser = room.game.turn;
  const winner = otherPlayer(loser);
  room.game = { ...room.game, phase: 'finished', winner };
  room.phase = 'finished';
  clearTurnTimer(room);
  const winnerPlayer = room.players[winner];
  if (winnerPlayer) incrementWin(winnerPlayer.nickname);
  io.to(room.code).emit('game_over', { winner, reason: 'turn-timeout' });
}

// Silence unused-import warning for cellKey (kept for future logging utilities)
void cellKey;
