import {
  createGame,
  emptyBoard,
  otherPlayer,
  type BoardSize,
  type GameState,
  type OpenRoom,
  type PlaybackState,
  type Player,
  type PlaylistSnapshot,
  type Powerup,
  type Song,
} from '@battlenaval/shared';

export type RoomPhase = 'waiting' | 'placement' | 'playing' | 'finished';

export type RoomPlayer = {
  role: Player;
  socketId: string | null;
  sessionToken: string;
  nickname: string;
  ready: boolean;
  /** Set when the player has submitted a valid full-fleet placement. */
  placed: boolean;
  /** True after this player has requested a rematch from the gameover screen. */
  wantsRematch: boolean;
};

export type Room = {
  code: string;
  size: BoardSize;
  game: GameState;
  phase: RoomPhase;
  players: { A: RoomPlayer | null; B: RoomPlayer | null };
  createdAt: number;
  /** Timer that fires if a player who left doesn't reconnect within the grace period. */
  disconnectTimers: { A: NodeJS.Timeout | null; B: NodeJS.Timeout | null };
  /** Active turn's deadline (epoch ms). Null when not in play. */
  turnDeadline: number | null;
  turnTimer: NodeJS.Timeout | null;
  /** Fires if placement drags on past PLACEMENT_TIMEOUT_MS. */
  placementTimer: NodeJS.Timeout | null;
  /** Powerups placed on each player's water cells at game start. */
  powerups: Record<Player, Powerup[]>;
  /** Cell keys ("x,y") of powerups that have already been collected. */
  consumedPowerups: Record<Player, Set<string>>;
  /** Shared YouTube playlist for the room. Persists across rematches. */
  playlist: Song[];
  /** Host-controlled playback state mirrored to both clients. */
  playback: PlaybackState;
};

const rooms = new Map<string, Room>();
/** socketId → room code + role, for fast lookup on disconnect / cleanup. */
const socketIndex = new Map<string, { code: string; role: Player }>();

export function isCodeTaken(code: string): boolean {
  return rooms.has(code);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

/**
 * Rooms still waiting for a second player — what the lobby browser shows.
 * Sorted newest-first so the freshest rooms appear at the top.
 */
export function listOpenRooms(): OpenRoom[] {
  const open: OpenRoom[] = [];
  for (const room of rooms.values()) {
    if (room.phase !== 'waiting' || room.players.B) continue;
    const host = room.players.A;
    if (!host) continue;
    open.push({
      code: room.code,
      hostNickname: host.nickname,
      size: room.size,
      createdAt: room.createdAt,
    });
  }
  return open.sort((a, b) => b.createdAt - a.createdAt);
}

export function getRoomBySocket(socketId: string): { room: Room; role: Player } | undefined {
  const entry = socketIndex.get(socketId);
  if (!entry) return undefined;
  const room = rooms.get(entry.code);
  if (!room) return undefined;
  return { room, role: entry.role };
}

export function createRoom(
  code: string,
  size: BoardSize,
  hostSocketId: string,
  hostToken: string,
  hostNickname: string,
): Room {
  const room: Room = {
    code,
    size,
    game: createGame(size),
    phase: 'waiting',
    players: {
      A: {
        role: 'A',
        socketId: hostSocketId,
        sessionToken: hostToken,
        nickname: hostNickname,
        ready: false,
        placed: false,
        wantsRematch: false,
      },
      B: null,
    },
    createdAt: Date.now(),
    disconnectTimers: { A: null, B: null },
    turnDeadline: null,
    turnTimer: null,
    placementTimer: null,
    powerups: { A: [], B: [] },
    consumedPowerups: { A: new Set(), B: new Set() },
    playlist: [],
    playback: { currentIndex: -1, playing: false, rev: 0, startedAt: 0 },
  };
  rooms.set(code, room);
  socketIndex.set(hostSocketId, { code, role: 'A' });
  return room;
}

export function attachGuest(
  room: Room,
  socketId: string,
  token: string,
  nickname: string,
): RoomPlayer {
  const guest: RoomPlayer = {
    role: 'B',
    socketId,
    sessionToken: token,
    nickname,
    ready: false,
    placed: false,
    wantsRematch: false,
  };
  room.players.B = guest;
  room.phase = 'placement';
  socketIndex.set(socketId, { code: room.code, role: 'B' });
  return guest;
}

export function bindSocket(room: Room, role: Player, socketId: string): void {
  const player = room.players[role];
  if (!player) return;
  if (player.socketId && player.socketId !== socketId) {
    socketIndex.delete(player.socketId);
  }
  player.socketId = socketId;
  socketIndex.set(socketId, { code: room.code, role });
}

export function unbindSocket(socketId: string): void {
  const entry = socketIndex.get(socketId);
  if (!entry) return;
  socketIndex.delete(socketId);
  const room = rooms.get(entry.code);
  if (!room) return;
  const player = room.players[entry.role];
  if (player && player.socketId === socketId) {
    player.socketId = null;
  }
}

export function clearDisconnectTimer(room: Room, role: Player): void {
  const t = room.disconnectTimers[role];
  if (t) {
    clearTimeout(t);
    room.disconnectTimers[role] = null;
  }
}

export function clearTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  room.turnDeadline = null;
}

export function setTurnTimer(
  room: Room,
  ms: number,
  onExpire: () => void,
): number {
  clearTurnTimer(room);
  room.turnDeadline = Date.now() + ms;
  room.turnTimer = setTimeout(onExpire, ms);
  return room.turnDeadline;
}

export function clearPlacementTimer(room: Room): void {
  if (room.placementTimer) {
    clearTimeout(room.placementTimer);
    room.placementTimer = null;
  }
}

export function setPlacementTimer(
  room: Room,
  ms: number,
  onExpire: () => void,
): void {
  clearPlacementTimer(room);
  room.placementTimer = setTimeout(onExpire, ms);
}

export function setDisconnectTimer(
  room: Room,
  role: Player,
  graceMs: number,
  onTimeout: () => void,
): void {
  clearDisconnectTimer(room, role);
  room.disconnectTimers[role] = setTimeout(onTimeout, graceMs);
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  clearDisconnectTimer(room, 'A');
  clearDisconnectTimer(room, 'B');
  clearTurnTimer(room);
  clearPlacementTimer(room);
  for (const role of ['A', 'B'] as const) {
    const p = room.players[role];
    if (p?.socketId) socketIndex.delete(p.socketId);
  }
  rooms.delete(code);
}

export function snapshotForReconnect(
  room: Room,
  role: Player,
):
  | {
      size: BoardSize;
      phase: 'placement' | 'playing' | 'finished';
      yourBoard: GameState['boards'][Player]['ships'];
      shotsByMe: GameState['shots'][Player];
      shotsAtMe: GameState['shots'][Player];
      turn: Player | null;
      yourReady: boolean;
      opponentReady: boolean;
      opponentPresent: boolean;
      winner: Player | null;
      yourNickname: string;
      opponentNickname: string;
    }
  | null {
  if (room.phase === 'waiting') return null;
  const me = room.players[role];
  const opp = room.players[otherPlayer(role)];
  if (!me) return null;
  return {
    size: room.size,
    phase: room.phase,
    yourBoard: room.game.boards[role].ships,
    shotsByMe: room.game.shots[role],
    shotsAtMe: room.game.shots[otherPlayer(role)],
    turn: room.phase === 'playing' ? room.game.turn : null,
    yourReady: me.ready,
    opponentReady: opp?.ready ?? false,
    opponentPresent: !!(opp && opp.socketId),
    winner: room.game.winner,
    yourNickname: me.nickname,
    opponentNickname: opp?.nickname ?? '',
  };
}

/** Build a JSON-safe playlist + playback snapshot for the network. */
export function buildPlaylistSnapshot(room: Room): PlaylistSnapshot {
  return { songs: room.playlist, playback: room.playback };
}

/**
 * Reset the room's game state for a rematch — keeps players and sockets.
 * NOTE: room.playlist and room.playback are intentionally NOT reset — the
 * music carries over between games played in the same room.
 */
export function resetGame(room: Room): void {
  room.game = createGame(room.size);
  room.phase = 'placement';
  clearTurnTimer(room);
  clearPlacementTimer(room);
  room.powerups = { A: [], B: [] };
  room.consumedPowerups = { A: new Set(), B: new Set() };
  if (room.players.A) {
    room.players.A.ready = false;
    room.players.A.placed = false;
    room.players.A.wantsRematch = false;
  }
  if (room.players.B) {
    room.players.B.ready = false;
    room.players.B.placed = false;
    room.players.B.wantsRematch = false;
  }
}

/** Test-only helper — clears all in-memory state. */
export function _resetAllRoomsForTest(): void {
  for (const t of rooms.values()) {
    clearDisconnectTimer(t, 'A');
    clearDisconnectTimer(t, 'B');
    clearTurnTimer(t);
    clearPlacementTimer(t);
  }
  rooms.clear();
  socketIndex.clear();
}

// Re-export for type usage elsewhere
export { emptyBoard };
