import { io as createIo, type Socket } from 'socket.io-client';
import type {
  BoardSize,
  Cell,
  ClientToServerEvents,
  CreateRoomRes,
  EmoteReq,
  EmoteRes,
  JoinRoomRes,
  LeaderboardResponse,
  PlaceShipsRes,
  Player,
  QuickPlaceRes,
  ReadyRes,
  ReconnectRes,
  RematchRes,
  ServerToClientEvents,
  ShipPlacementInput,
  ShootRes,
} from '@battlenaval/shared';

// Resolve the server URL:
//   1. VITE_SERVER_URL build-time override (split deploys)
//   2. In dev (Vite serves on :5173, server on :3001), point at :3001
//   3. In prod assume same-origin (server also serves this static bundle)
export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ??
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : window.location.origin);

export type ServerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function openConnection(): ServerSocket {
  return createIo(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
}

// ─── Typed ack-emit wrappers ───────────────────────────────────────────────
// Socket.IO's typed signatures don't play nicely with generic ack helpers,
// so we cast to a loose shape and assert the response type at the call site.

type LooseEmit = {
  emit: (event: string, payload: unknown, cb: (res: unknown) => void) => void;
};

function emitAck<TRes>(
  socket: ServerSocket,
  event: keyof ClientToServerEvents,
  payload: unknown,
  timeoutMs = 5000,
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Ack timeout: ${String(event)}`)),
      timeoutMs,
    );
    (socket as unknown as LooseEmit).emit(event, payload, (res: unknown) => {
      clearTimeout(timer);
      resolve(res as TRes);
    });
  });
}

export const api = {
  createRoom(
    socket: ServerSocket,
    size: BoardSize,
    nickname: string,
  ): Promise<CreateRoomRes> {
    return emitAck<CreateRoomRes>(socket, 'create_room', { size, nickname });
  },
  joinRoom(
    socket: ServerSocket,
    code: string,
    nickname: string,
  ): Promise<JoinRoomRes> {
    return emitAck<JoinRoomRes>(socket, 'join_room', { code, nickname });
  },
  reconnect(
    socket: ServerSocket,
    code: string,
    role: Player,
    sessionToken: string,
  ): Promise<ReconnectRes> {
    return emitAck<ReconnectRes>(socket, 'reconnect_session', {
      code,
      role,
      sessionToken,
    });
  },
  placeShips(
    socket: ServerSocket,
    ships: ShipPlacementInput[],
  ): Promise<PlaceShipsRes> {
    return emitAck<PlaceShipsRes>(socket, 'place_ships', { ships });
  },
  quickPlace(socket: ServerSocket): Promise<QuickPlaceRes> {
    return emitAck<QuickPlaceRes>(socket, 'quick_place', {});
  },
  ready(socket: ServerSocket): Promise<ReadyRes> {
    return emitAck<ReadyRes>(socket, 'ready', {});
  },
  shoot(socket: ServerSocket, cell: Cell): Promise<ShootRes> {
    return emitAck<ShootRes>(socket, 'shoot', { cell });
  },
  sendEmote(socket: ServerSocket, req: EmoteReq): Promise<EmoteRes> {
    return emitAck<EmoteRes>(socket, 'send_emote', req);
  },
  rematch(socket: ServerSocket): Promise<RematchRes> {
    return emitAck<RematchRes>(socket, 'rematch', {});
  },
  leave(socket: ServerSocket): void {
    socket.emit('leave', {});
  },
};

// ─── localStorage session persistence ──────────────────────────────────────

const SESSION_KEY = 'battlenaval:session:v1';

export type StoredSession = {
  code: string;
  role: Player;
  sessionToken: string;
  size: BoardSize;
  nickname: string;
};

export function saveSession(s: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // ignored
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.code || !parsed.role || !parsed.sessionToken) return null;
    if (typeof parsed.nickname !== 'string') {
      parsed.nickname = '';
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignored
  }
}

// ─── Nickname persistence ──────────────────────────────────────────────────

const NICKNAME_KEY = 'battlenaval:nickname:v1';

export function saveNickname(nickname: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // ignored
  }
}

export function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

// ─── Leaderboard REST ──────────────────────────────────────────────────────

export async function fetchLeaderboard(
  limit = 50,
): Promise<LeaderboardResponse> {
  const url = `${SERVER_URL}/leaderboard?limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as LeaderboardResponse;
}
