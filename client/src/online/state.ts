import {
  cellKey,
  emptyBoard,
  getFleet,
  otherPlayer,
  placeShip,
  removeShip,
  validatePlacement,
  type Board,
  type BoardSize,
  type Cell,
  type GameOverReason,
  type OpenRoom,
  type PieceDef,
  type PlacedShip,
  type PlaybackState,
  type Player,
  type Powerup,
  type Rotation,
  type ShipPlacementInput,
  type ShotInfo,
  type ShotOutcome,
  type Song,
  type SunkShipInfo,
} from '@battlenaval/shared';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export type OnlineSession = {
  code: string;
  role: Player;
  sessionToken: string;
  size: BoardSize;
  nickname: string;
};

export type LastShot = {
  byPlayer: Player;
  cell: Cell;
  outcome: ShotOutcome;
  sunkShipName?: string;
};

export type OnlineView =
  | { kind: 'lobby'; pendingError: string | null; pendingCode: string }
  | { kind: 'waiting' }
  | {
      kind: 'placement';
      selectedPieceId: string | null;
      rotation: Rotation;
      submitted: boolean; // place_ships ack received
    }
  | { kind: 'placement_waiting' } // ready ack received, waiting for opponent
  | { kind: 'playing'; lastShot: LastShot | null }
  | { kind: 'gameover'; winner: Player; reason: GameOverReason }
  | { kind: 'room_closed'; reason: string };

export type IncomingEmote = {
  code: string;
  label: string;
  from: Player;
  receivedAt: number;
};

export type OnlineState = {
  connection: ConnectionStatus;
  session: OnlineSession | null;
  view: OnlineView;
  // Mini game-state mirror — local view of authoritative server state
  myBoard: Board;
  oppBoard: Board; // only contains sunk ships
  shotsByMe: Record<string, ShotInfo>;
  shotsAtMe: Record<string, ShotInfo>;
  turn: Player | null;
  /** Epoch ms when the current turn's clock runs out. Null when not in play. */
  turnDeadline: number | null;
  opponentPresent: boolean;
  /** Total grace seconds when the opponent disconnected (e.g. 30). */
  opponentLeftGrace: number | null;
  /** Epoch ms when the opponent_left event arrived (for tick-down UI). */
  opponentLeftAt: number | null;
  opponentReady: boolean;
  opponentNickname: string;
  /** True after this client has requested a rematch. */
  meWantsRematch: boolean;
  /** True after the opponent has requested a rematch. */
  opponentWantsRematch: boolean;
  incomingEmote: IncomingEmote | null;
  /** Powerups placed on each player's board, keyed by player role. */
  powerups: Record<Player, Powerup[]>;
  /** Cell keys ("x,y") of powerups that were already collected, per board. */
  consumedPowerupKeys: Record<Player, Set<string>>;
  /** Opponent ship cells revealed to me by my radar. */
  radarReveals: Cell[];
  /** Increments on each new radar reveal — drives the popup/sound feedback. */
  radarPing: number;
  /** Shared room playlist — mirrored from the server. */
  playlist: Song[];
  /** Host-controlled playback state — mirrored from the server. */
  playback: PlaybackState;
  /** Open rooms waiting for a second player — shown in the lobby browser. */
  openRooms: OpenRoom[];
};

export const initialOnlineState: OnlineState = {
  connection: 'connecting',
  session: null,
  view: { kind: 'lobby', pendingError: null, pendingCode: '' },
  myBoard: emptyBoard(10),
  oppBoard: emptyBoard(10),
  shotsByMe: {},
  shotsAtMe: {},
  turn: null,
  turnDeadline: null,
  opponentPresent: false,
  opponentLeftGrace: null,
  opponentLeftAt: null,
  opponentReady: false,
  opponentNickname: '',
  meWantsRematch: false,
  opponentWantsRematch: false,
  incomingEmote: null,
  powerups: { A: [], B: [] },
  consumedPowerupKeys: { A: new Set(), B: new Set() },
  radarReveals: [],
  radarPing: 0,
  playlist: [],
  playback: { currentIndex: -1, playing: false, rev: 0, startedAt: 0 },
  openRooms: [],
};

export type OnlineAction =
  // Connection
  | { type: 'connection_status'; status: ConnectionStatus }
  // Lobby form
  | { type: 'lobby_code_input'; value: string }
  | { type: 'lobby_error'; reason: string }
  | { type: 'lobby_clear_error' }
  // Session lifecycle
  | { type: 'session_created'; session: OnlineSession }
  | {
      type: 'session_joined';
      session: OnlineSession;
      opponentPresent: boolean;
      opponentNickname: string;
    }
  | { type: 'opponent_joined'; nickname: string }
  | { type: 'opponent_left'; graceSeconds: number }
  | { type: 'opponent_reconnected' }
  | { type: 'opponent_ready' }
  | { type: 'rematch_local' }
  | { type: 'rematch_requested_by_opponent' }
  | { type: 'rematch_started' }
  | {
      type: 'game_started';
      firstTurn: Player;
      turnDeadline: number;
      powerups: Record<Player, Powerup[]>;
    }
  | {
      type: 'shot_result';
      byPlayer: Player;
      cell: Cell;
      outcome: ShotOutcome;
      sunkShip?: SunkShipInfo;
      nextTurn: Player;
      turnDeadline?: number;
      consumedPowerup?: Powerup;
    }
  | { type: 'radar_reveal'; cell: Cell }
  | { type: 'game_over'; winner: Player; reason: GameOverReason }
  | { type: 'room_closed'; reason: string }
  | { type: 'emote_received'; code: string; label: string; from: Player }
  | { type: 'emote_clear' }
  | { type: 'playlist_updated'; songs: Song[]; playback: PlaybackState }
  | { type: 'rooms_updated'; rooms: OpenRoom[] }
  | { type: 'song_title_resolved'; songId: string; title: string }
  // Local placement
  | { type: 'select_piece'; pieceId: string | null }
  | { type: 'rotate_selection' }
  | { type: 'place_local'; cell: Cell }
  | { type: 'remove_local'; pieceId: string }
  | { type: 'rotate_placed_local'; pieceId: string }
  | { type: 'move_placed_local'; pieceId: string; newOrigin: Cell }
  | { type: 'auto_place_local'; ships: ShipPlacementInput[] }
  | { type: 'reset_local_board' }
  // Submitted states
  | { type: 'placement_submitted' }
  | { type: 'ready_submitted' }
  // Reconnect with snapshot
  | {
      type: 'reconnect_snapshot';
      session: OnlineSession;
      phase: 'placement' | 'playing' | 'finished';
      myShips: PlacedShip[];
      shotsByMe: Record<string, ShotInfo>;
      shotsAtMe: Record<string, ShotInfo>;
      turn: Player | null;
      yourReady: boolean;
      opponentReady: boolean;
      opponentPresent: boolean;
      opponentNickname: string;
      winner: Player | null;
    }
  // Leave / reset
  | { type: 'reset_to_lobby' };

function findPiece(size: BoardSize, pieceId: string): PieceDef | undefined {
  return getFleet(size).find((p) => p.id === pieceId);
}

function firstUnplacedId(size: BoardSize, board: Board): string | null {
  const placed = new Set(board.ships.map((s) => s.pieceId));
  for (const p of getFleet(size)) {
    if (!placed.has(p.id)) return p.id;
  }
  return null;
}

function applyShotToBoard(
  board: Board,
  cell: Cell,
  outcome: ShotOutcome,
  sunkShip?: SunkShipInfo,
): Board {
  if (outcome === 'miss') return board;
  const key = cellKey(cell);
  return {
    ...board,
    ships: board.ships.map((s) => {
      if (s.cells.some((c) => c.x === cell.x && c.y === cell.y)) {
        const newHits = [...s.hits, key];
        const isSunk =
          outcome === 'sunk' ||
          s.cells.every((c) => newHits.includes(cellKey(c)));
        return { ...s, hits: newHits, sunk: isSunk };
      }
      return s;
    }),
  };
}

function appendSunkShipToOpponentBoard(
  oppBoard: Board,
  sunkShip: SunkShipInfo,
): Board {
  if (oppBoard.ships.some((s) => s.pieceId === sunkShip.pieceId)) {
    return oppBoard;
  }
  const ship: PlacedShip = {
    pieceId: sunkShip.pieceId,
    kind: sunkShip.kind,
    name: sunkShip.name,
    origin: sunkShip.cells[0] ?? { x: 0, y: 0 },
    rotation: 0,
    cells: sunkShip.cells,
    hits: sunkShip.cells.map(cellKey),
    sunk: true,
  };
  return { ...oppBoard, ships: [...oppBoard.ships, ship] };
}

export function onlineReducer(
  state: OnlineState,
  action: OnlineAction,
): OnlineState {
  switch (action.type) {
    case 'connection_status':
      return { ...state, connection: action.status };

    case 'lobby_code_input':
      if (state.view.kind !== 'lobby') return state;
      return {
        ...state,
        view: { ...state.view, pendingCode: action.value, pendingError: null },
      };

    case 'lobby_error':
      if (state.view.kind !== 'lobby') return state;
      return { ...state, view: { ...state.view, pendingError: action.reason } };

    case 'lobby_clear_error':
      if (state.view.kind !== 'lobby') return state;
      return { ...state, view: { ...state.view, pendingError: null } };

    case 'session_created':
      return {
        ...state,
        session: action.session,
        myBoard: emptyBoard(action.session.size),
        oppBoard: emptyBoard(action.session.size),
        shotsByMe: {},
        shotsAtMe: {},
        view: { kind: 'waiting' },
      };

    case 'session_joined': {
      const fleet = getFleet(action.session.size);
      return {
        ...state,
        session: action.session,
        myBoard: emptyBoard(action.session.size),
        oppBoard: emptyBoard(action.session.size),
        shotsByMe: {},
        shotsAtMe: {},
        opponentPresent: action.opponentPresent,
        opponentNickname: action.opponentNickname,
        view: {
          kind: 'placement',
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
          submitted: false,
        },
      };
    }

    case 'opponent_joined': {
      if (!state.session) return state;
      const fleet = getFleet(state.session.size);
      return {
        ...state,
        opponentPresent: true,
        opponentNickname: action.nickname,
        view: {
          kind: 'placement',
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
          submitted: false,
        },
      };
    }

    case 'opponent_left':
      return {
        ...state,
        opponentPresent: false,
        opponentLeftGrace: action.graceSeconds,
        opponentLeftAt: Date.now(),
      };

    case 'opponent_reconnected':
      return {
        ...state,
        opponentPresent: true,
        opponentLeftGrace: null,
        opponentLeftAt: null,
      };

    case 'opponent_ready':
      return { ...state, opponentReady: true };

    case 'rematch_local':
      return { ...state, meWantsRematch: true };

    case 'rematch_requested_by_opponent':
      return { ...state, opponentWantsRematch: true };

    case 'rematch_started': {
      if (!state.session) return state;
      const fleet = getFleet(state.session.size);
      return {
        ...state,
        myBoard: emptyBoard(state.session.size),
        oppBoard: emptyBoard(state.session.size),
        shotsByMe: {},
        shotsAtMe: {},
        turn: null,
        turnDeadline: null,
        opponentReady: false,
        meWantsRematch: false,
        opponentWantsRematch: false,
        powerups: { A: [], B: [] },
        consumedPowerupKeys: { A: new Set(), B: new Set() },
        radarReveals: [],
        radarPing: 0,
        view: {
          kind: 'placement',
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
          submitted: false,
        },
      };
    }

    case 'game_started':
      return {
        ...state,
        turn: action.firstTurn,
        turnDeadline: action.turnDeadline,
        opponentReady: true,
        powerups: action.powerups,
        consumedPowerupKeys: { A: new Set(), B: new Set() },
        radarReveals: [],
        radarPing: 0,
        view: { kind: 'playing', lastShot: null },
      };

    case 'shot_result': {
      if (!state.session) return state;
      const me = state.session.role;
      const opp = otherPlayer(me);
      let myBoard = state.myBoard;
      let oppBoard = state.oppBoard;
      const newShotsByMe = { ...state.shotsByMe };
      const newShotsAtMe = { ...state.shotsAtMe };
      const key = cellKey(action.cell);

      // Mark the powerup consumed on whichever board it lived (the opponent
      // of the shooter — same as the "target" board for this shot).
      let consumedPowerupKeys = state.consumedPowerupKeys;
      let radarReveals = state.radarReveals;
      if (action.consumedPowerup) {
        const target = otherPlayer(action.byPlayer);
        consumedPowerupKeys = {
          ...state.consumedPowerupKeys,
          [target]: new Set([
            ...state.consumedPowerupKeys[target],
            cellKey(action.consumedPowerup.cell),
          ]),
        };
      }

      // Once we actually shoot a cell revealed by radar, drop the radar marker
      // so we don't render two overlays on the same cell.
      if (action.byPlayer === me) {
        radarReveals = state.radarReveals.filter(
          (c) => c.x !== action.cell.x || c.y !== action.cell.y,
        );
      }
      // (we'll use opp below for shot bookkeeping)
      void opp;
      const shotEntry: ShotInfo = action.sunkShip
        ? { cell: action.cell, outcome: action.outcome, sunkShipId: action.sunkShip.pieceId }
        : { cell: action.cell, outcome: action.outcome };

      if (action.byPlayer === me) {
        // I fired at opponent's board
        newShotsByMe[key] = shotEntry;
        if (action.sunkShip) {
          oppBoard = appendSunkShipToOpponentBoard(oppBoard, action.sunkShip);
        }
      } else {
        // Opponent fired at my board
        newShotsAtMe[key] = shotEntry;
        myBoard = applyShotToBoard(myBoard, action.cell, action.outcome, action.sunkShip);
      }

      const lastShot: LastShot = {
        byPlayer: action.byPlayer,
        cell: action.cell,
        outcome: action.outcome,
        ...(action.sunkShip?.name ? { sunkShipName: action.sunkShip.name } : {}),
      };

      return {
        ...state,
        myBoard,
        oppBoard,
        shotsByMe: newShotsByMe,
        shotsAtMe: newShotsAtMe,
        turn: action.nextTurn,
        turnDeadline: action.turnDeadline ?? null,
        consumedPowerupKeys,
        radarReveals,
        view:
          state.view.kind === 'playing'
            ? { ...state.view, lastShot }
            : state.view,
      };
    }

    case 'radar_reveal': {
      // Avoid duplicates if the same cell ever arrives twice.
      if (
        state.radarReveals.some(
          (c) => c.x === action.cell.x && c.y === action.cell.y,
        )
      ) {
        return state;
      }
      return {
        ...state,
        radarReveals: [...state.radarReveals, action.cell],
        radarPing: state.radarPing + 1,
      };
    }

    case 'game_over':
      return {
        ...state,
        turnDeadline: null,
        view: {
          kind: 'gameover',
          winner: action.winner,
          reason: action.reason,
        },
      };

    case 'room_closed':
      return {
        ...state,
        view: { kind: 'room_closed', reason: action.reason },
      };

    case 'emote_received':
      return {
        ...state,
        incomingEmote: {
          code: action.code,
          label: action.label,
          from: action.from,
          receivedAt: Date.now(),
        },
      };

    case 'emote_clear':
      return { ...state, incomingEmote: null };

    case 'playlist_updated': {
      // The server sends songs with title ''. Preserve any titles the client
      // already resolved (matched by song id) so they don't flicker away.
      const prevTitles = new Map(state.playlist.map((s) => [s.id, s.title]));
      const songs = action.songs.map((s) =>
        s.title ? s : { ...s, title: prevTitles.get(s.id) ?? '' },
      );
      return { ...state, playlist: songs, playback: action.playback };
    }

    case 'rooms_updated':
      return { ...state, openRooms: action.rooms };

    case 'song_title_resolved':
      return {
        ...state,
        playlist: state.playlist.map((s) =>
          s.id === action.songId ? { ...s, title: action.title } : s,
        ),
      };

    case 'select_piece':
      if (state.view.kind !== 'placement') return state;
      return {
        ...state,
        view: { ...state.view, selectedPieceId: action.pieceId },
      };

    case 'rotate_selection':
      if (state.view.kind !== 'placement') return state;
      return {
        ...state,
        view: {
          ...state.view,
          rotation: (((state.view.rotation + 90) % 360) as Rotation),
        },
      };

    case 'place_local': {
      if (state.view.kind !== 'placement' || !state.session) return state;
      const { selectedPieceId, rotation } = state.view;
      if (!selectedPieceId) return state;
      const piece = findPiece(state.session.size, selectedPieceId);
      if (!piece) return state;
      const v = validatePlacement(state.myBoard, piece, action.cell, rotation);
      if (!v.ok) return state;
      const newBoard = placeShip(state.myBoard, piece, action.cell, rotation);
      const next = firstUnplacedId(state.session.size, newBoard);
      return {
        ...state,
        myBoard: newBoard,
        view: { ...state.view, selectedPieceId: next },
      };
    }

    case 'remove_local': {
      if (state.view.kind !== 'placement') return state;
      const newBoard = removeShip(state.myBoard, action.pieceId);
      return {
        ...state,
        myBoard: newBoard,
        view: { ...state.view, selectedPieceId: action.pieceId },
      };
    }

    case 'rotate_placed_local': {
      if (state.view.kind !== 'placement' || !state.session) return state;
      const existing = state.myBoard.ships.find((s) => s.pieceId === action.pieceId);
      if (!existing) return state;
      const piece = findPiece(state.session.size, action.pieceId);
      if (!piece) return state;
      const removed = removeShip(state.myBoard, action.pieceId);
      const order: Rotation[] = [];
      let r: Rotation = existing.rotation;
      for (let i = 0; i < 4; i++) {
        r = ((r + 90) % 360) as Rotation;
        order.push(r);
      }
      for (const newRot of order) {
        const v = validatePlacement(removed, piece, existing.origin, newRot);
        if (v.ok) {
          return {
            ...state,
            myBoard: placeShip(removed, piece, existing.origin, newRot),
          };
        }
      }
      return state;
    }

    case 'move_placed_local': {
      if (state.view.kind !== 'placement' || !state.session) return state;
      const existing = state.myBoard.ships.find((s) => s.pieceId === action.pieceId);
      if (!existing) return state;
      const piece = findPiece(state.session.size, action.pieceId);
      if (!piece) return state;
      const removed = removeShip(state.myBoard, action.pieceId);
      const v = validatePlacement(removed, piece, action.newOrigin, existing.rotation);
      if (!v.ok) return state;
      return {
        ...state,
        myBoard: placeShip(removed, piece, action.newOrigin, existing.rotation),
      };
    }

    case 'auto_place_local': {
      if (state.view.kind !== 'placement' || !state.session) return state;
      let board: Board = emptyBoard(state.session.size);
      for (const ship of action.ships) {
        const piece = findPiece(state.session.size, ship.pieceId);
        if (!piece) continue;
        const v = validatePlacement(board, piece, ship.origin, ship.rotation);
        if (!v.ok) continue;
        board = placeShip(board, piece, ship.origin, ship.rotation);
      }
      return {
        ...state,
        myBoard: board,
        view: { ...state.view, selectedPieceId: null },
      };
    }

    case 'reset_local_board': {
      if (state.view.kind !== 'placement' || !state.session) return state;
      const fleet = getFleet(state.session.size);
      return {
        ...state,
        myBoard: emptyBoard(state.session.size),
        view: {
          ...state.view,
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
        },
      };
    }

    case 'placement_submitted':
      if (state.view.kind !== 'placement') return state;
      return { ...state, view: { ...state.view, submitted: true } };

    case 'ready_submitted':
      // Guard against a race where `game_started` already arrived (when we're
      // the second to ready, the server emits game_started before the ack).
      // Without this guard the view rolls back from 'playing' to
      // 'placement_waiting' and the game appears stuck.
      if (state.view.kind !== 'placement') return state;
      return { ...state, view: { kind: 'placement_waiting' } };

    case 'reconnect_snapshot': {
      const fleet = getFleet(action.session.size);
      const myBoard: Board = {
        width: action.session.size,
        height: action.session.size,
        ships: action.myShips,
      };
      const oppBoard = emptyBoard(action.session.size);
      const nextView: OnlineView =
        action.phase === 'placement'
          ? action.yourReady
            ? { kind: 'placement_waiting' }
            : {
                kind: 'placement',
                selectedPieceId: fleet[0]?.id ?? null,
                rotation: 0,
                submitted: action.myShips.length === fleet.length,
              }
          : action.phase === 'playing'
            ? { kind: 'playing', lastShot: null }
            : {
                kind: 'gameover',
                winner: action.winner ?? action.session.role,
                reason: 'normal',
              };
      return {
        ...state,
        session: action.session,
        myBoard,
        oppBoard,
        shotsByMe: action.shotsByMe,
        shotsAtMe: action.shotsAtMe,
        turn: action.turn,
        opponentPresent: action.opponentPresent,
        opponentReady: action.opponentReady,
        opponentNickname: action.opponentNickname,
        view: nextView,
      };
    }

    case 'reset_to_lobby':
      return {
        ...initialOnlineState,
        connection: state.connection,
        view: { kind: 'lobby', pendingError: null, pendingCode: '' },
      };

    default:
      return state;
  }
}

export function otherRole(p: Player): Player {
  return otherPlayer(p);
}
