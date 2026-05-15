import type {
  BoardSize,
  Cell,
  PieceKind,
  PlacedShip,
  Player,
  Rotation,
  ShotOutcome,
} from './types.js';

// All payloads here cross the network as JSON. No Sets or Maps allowed.
// Request/response pairs are paired via Socket.IO ack callbacks.

// ─── Lobby / session ───────────────────────────────────────

/** Allowed nickname shape: 2–20 chars of letters, digits, spaces, .,_,',- */
export const NICKNAME_REGEX = /^[\p{L}\p{N} ._'-]{2,20}$/u;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_MIN_LENGTH = 2;

export type CreateRoomReq = { size: BoardSize; nickname: string };
export type CreateRoomReason = 'invalid-size' | 'invalid-nickname' | 'already-in-room' | 'internal';
export type CreateRoomRes =
  | {
      ok: true;
      code: string;
      role: Player;
      sessionToken: string;
      size: BoardSize;
      nickname: string;
    }
  | { ok: false; reason: CreateRoomReason };

export type JoinRoomReason =
  | 'invalid-code'
  | 'not-found'
  | 'full'
  | 'in-progress'
  | 'invalid-nickname'
  | 'already-in-room';
export type JoinRoomReq = { code: string; nickname: string };
export type JoinRoomRes =
  | {
      ok: true;
      role: Player;
      sessionToken: string;
      size: BoardSize;
      opponentPresent: boolean;
      nickname: string;
      opponentNickname: string;
    }
  | { ok: false; reason: JoinRoomReason };

// ─── Open-room listing (lobby browser) ─────────────────────
// Rooms still in the 'waiting' phase (host present, no guest yet) are
// listed so players can join with a click instead of typing a code.

export type OpenRoom = {
  code: string;
  hostNickname: string;
  size: BoardSize;
  /** Epoch ms the room was created — used for sorting newest-first. */
  createdAt: number;
};
export type ListRoomsReq = Record<string, never>;
export type ListRoomsRes = { ok: true; rooms: OpenRoom[] };
/** Pushed to everyone in the lobby whenever the open-room set changes. */
export type RoomsUpdatedEvent = { rooms: OpenRoom[] };

export type ShotInfo = {
  cell: Cell;
  outcome: ShotOutcome;
  /** Present iff outcome === 'sunk'. */
  sunkShipId?: string;
};

export type ReconnectSnapshot = {
  size: BoardSize;
  phase: 'placement' | 'playing' | 'finished';
  yourBoard: PlacedShip[];
  /** Shots you fired at the opponent (keys "x,y"). */
  shotsByMe: Record<string, ShotInfo>;
  /** Shots fired at your board by the opponent. */
  shotsAtMe: Record<string, ShotInfo>;
  turn: Player | null;
  yourReady: boolean;
  opponentReady: boolean;
  opponentPresent: boolean;
  winner: Player | null;
  yourNickname: string;
  opponentNickname: string;
};
export type ReconnectReason = 'not-found' | 'invalid-token';
export type ReconnectReq = { code: string; role: Player; sessionToken: string };
export type ReconnectRes =
  | { ok: true; snapshot: ReconnectSnapshot }
  | { ok: false; reason: ReconnectReason };

// ─── Placement ─────────────────────────────────────────────

export type ShipPlacementInput = {
  pieceId: string;
  origin: Cell;
  rotation: Rotation;
};

export type PlaceShipsReason =
  | 'wrong-phase'
  | 'incomplete-fleet'
  | 'duplicate-piece'
  | 'unknown-piece'
  | 'placement-invalid';
export type PlaceShipsReq = { ships: ShipPlacementInput[] };
export type PlaceShipsRes = { ok: true } | { ok: false; reason: PlaceShipsReason };

export type QuickPlaceReq = Record<string, never>;
export type QuickPlaceRes =
  | { ok: true; ships: ShipPlacementInput[] }
  | { ok: false; reason: string };

export type ReadyReason = 'not-placed' | 'wrong-phase';
export type ReadyReq = Record<string, never>;
export type ReadyRes = { ok: true } | { ok: false; reason: ReadyReason };

// ─── Combat ────────────────────────────────────────────────

export type ShootReason = 'not-your-turn' | 'wrong-phase' | 'already-shot' | 'out-of-bounds';
export type ShootReq = { cell: Cell };
export type ShootRes = { ok: true } | { ok: false; reason: ShootReason };

export type EmoteReq = { code: string; label: string };
export type EmoteRes = { ok: true };

export type RematchReq = Record<string, never>;
export type RematchReason = 'wrong-phase' | 'already-requested';
export type RematchRes = { ok: true } | { ok: false; reason: RematchReason };

export type LeaveReq = Record<string, never>;

// ─── Server → Client push events ───────────────────────────

export type SunkShipInfo = {
  pieceId: string;
  kind: PieceKind;
  name: string;
  cells: Cell[];
};

export type OpponentJoinedEvent = { nickname: string };
export type OpponentLeftEvent = { graceSeconds: number };
export type OpponentReconnectedEvent = Record<string, never>;
export type OpponentReadyEvent = Record<string, never>;
export type RematchRequestedEvent = { by: Player };
export type RematchStartedEvent = Record<string, never>;
// ─── Powerups (prototype: Radar only) ──────────────────────

export type PowerupKind = 'radar';
export type Powerup = { kind: PowerupKind; cell: Cell };

export type GameStartedEvent = {
  firstTurn: Player;
  /** Epoch ms when the first turn's clock runs out. */
  turnDeadline: number;
  /**
   * Powerups placed on each player's water cells. Both players receive both
   * arrays so each can render the opponent's powerups on their attack view.
   */
  powerups: Record<Player, Powerup[]>;
};
export type ShotResultEvent = {
  byPlayer: Player;
  cell: Cell;
  outcome: ShotOutcome;
  sunkShip?: SunkShipInfo;
  /** Whose turn it is after this shot. */
  nextTurn: Player;
  /** Epoch ms when nextTurn's clock runs out. Absent if game just ended. */
  turnDeadline?: number;
  /** Set if this shot also collected a powerup at the same cell. */
  consumedPowerup?: Powerup;
};
/** Sent privately to the shooter when they collect a radar powerup. */
export type RadarRevealEvent = {
  /** A previously-unshot ship cell on the opponent's board. */
  cell: Cell;
};
export type GameOverReason = 'normal' | 'turn-timeout';
export type GameOverEvent = { winner: Player; reason: GameOverReason };
export type EmoteEvent = { code: string; label: string; from: Player };
export type RoomClosedReason =
  | 'host-left'
  | 'opponent-timeout'
  | 'guest-left'
  | 'manual'
  | 'placement-timeout';
export type RoomClosedEvent = { reason: RoomClosedReason };

/** How long each player has to shoot per turn (server-enforced). */
export const TURN_TIMEOUT_MS = 60_000;
/** How long the placement phase can last before the room is cancelled. */
export const PLACEMENT_TIMEOUT_MS = 5 * 60_000;

// ─── Leaderboard (REST-fetched, not socket) ────────────────

export type LeaderboardEntry = { nickname: string; wins: number };
export type LeaderboardResponse = { top: LeaderboardEntry[]; total: number };

// ─── Music playlist ────────────────────────────────────────
// A shared, host-controlled YouTube playlist scoped to a room. The playlist
// persists across rematches played in the same room.

export const MAX_PLAYLIST_SONGS = 30;

export type Song = {
  /** Stable id used for list keys and removal. */
  id: string;
  /** Canonical 11-char YouTube video id. */
  videoId: string;
  /** Display title; '' server-side — the client resolves it. */
  title: string;
  /** Which player added the song. */
  addedBy: Player;
};

/** Host-controlled playback state, mirrored to every client. */
export type PlaybackState = {
  /** Index into the playlist's songs[]; -1 when nothing is selected. */
  currentIndex: number;
  playing: boolean;
  /** Monotonic counter, bumped on every host control action (sync signal). */
  rev: number;
  /** Epoch ms when `playing` last became true (coarse position estimate). */
  startedAt: number;
};

export type PlaylistSnapshot = { songs: Song[]; playback: PlaybackState };

export type AddSongReason =
  | 'invalid-url'
  | 'not-in-room'
  | 'playlist-full'
  | 'duplicate';
export type AddSongReq = { url: string };
export type AddSongRes =
  | { ok: true; song: Song }
  | { ok: false; reason: AddSongReason };

export type RemoveSongReq = { songId: string };
export type RemoveSongRes =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'not-in-room' };

export type MusicControlAction =
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'select'; index: number }
  | { kind: 'next' }
  | { kind: 'prev' };
export type MusicControlReq = { action: MusicControlAction };
export type MusicControlRes =
  | { ok: true }
  | { ok: false; reason: 'not-host' | 'not-in-room' | 'empty' };

export type ImportPlaylistReq = { urls: string[] };
export type ImportPlaylistRes =
  | { ok: true; added: number }
  | { ok: false; reason: 'not-host' | 'not-in-room' };

/** Full playlist + playback snapshot pushed whenever either changes. */
export type PlaylistUpdatedEvent = PlaylistSnapshot;

// ─── Socket.IO typed event maps ────────────────────────────

export interface ClientToServerEvents {
  create_room: (req: CreateRoomReq, cb: (res: CreateRoomRes) => void) => void;
  join_room: (req: JoinRoomReq, cb: (res: JoinRoomRes) => void) => void;
  list_rooms: (req: ListRoomsReq, cb: (res: ListRoomsRes) => void) => void;
  reconnect_session: (req: ReconnectReq, cb: (res: ReconnectRes) => void) => void;
  place_ships: (req: PlaceShipsReq, cb: (res: PlaceShipsRes) => void) => void;
  quick_place: (req: QuickPlaceReq, cb: (res: QuickPlaceRes) => void) => void;
  ready: (req: ReadyReq, cb: (res: ReadyRes) => void) => void;
  shoot: (req: ShootReq, cb: (res: ShootRes) => void) => void;
  send_emote: (req: EmoteReq, cb: (res: EmoteRes) => void) => void;
  rematch: (req: RematchReq, cb: (res: RematchRes) => void) => void;
  leave: (req: LeaveReq) => void;
  add_song: (req: AddSongReq, cb: (res: AddSongRes) => void) => void;
  remove_song: (req: RemoveSongReq, cb: (res: RemoveSongRes) => void) => void;
  music_control: (req: MusicControlReq, cb: (res: MusicControlRes) => void) => void;
  import_playlist: (
    req: ImportPlaylistReq,
    cb: (res: ImportPlaylistRes) => void,
  ) => void;
}

export interface ServerToClientEvents {
  opponent_joined: (e: OpponentJoinedEvent) => void;
  opponent_left: (e: OpponentLeftEvent) => void;
  opponent_reconnected: (e: OpponentReconnectedEvent) => void;
  opponent_ready: (e: OpponentReadyEvent) => void;
  game_started: (e: GameStartedEvent) => void;
  shot_result: (e: ShotResultEvent) => void;
  radar_reveal: (e: RadarRevealEvent) => void;
  emote: (e: EmoteEvent) => void;
  game_over: (e: GameOverEvent) => void;
  rematch_requested: (e: RematchRequestedEvent) => void;
  rematch_started: (e: RematchStartedEvent) => void;
  room_closed: (e: RoomClosedEvent) => void;
  playlist_updated: (e: PlaylistUpdatedEvent) => void;
  rooms_updated: (e: RoomsUpdatedEvent) => void;
}

export const ROOM_CODE_REGEX = /^[A-HJ-NP-Z]{3}-[2-9]{3}$/;
