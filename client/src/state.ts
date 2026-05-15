import {
  autoPlace,
  cellKey,
  createGame,
  emptyBoard,
  getFleet,
  markReady,
  placeShip,
  removeShip,
  setPlayerBoard,
  shoot,
  validatePlacement,
  type BoardSize,
  type Cell,
  type GameState,
  type PieceDef,
  type Player,
  type Rotation,
  type ShotOutcome,
} from '@battlenaval/shared';

export type View =
  | { kind: 'setup' }
  | {
      kind: 'placement';
      currentPlayer: Player;
      selectedPieceId: string | null;
      rotation: Rotation;
    }
  | {
      kind: 'handoff';
      toPlayer: Player;
      next: 'placement' | 'play';
      message: string;
      sub: string;
    }
  | {
      kind: 'play';
      activePlayer: Player;
      /** Last shot info shown as banner, null if turn just started. */
      lastShot:
        | { outcome: ShotOutcome; cell: Cell; sunkShipName?: string }
        | null;
    }
  | { kind: 'gameover' };

export type EmoteEntry = { code: string; label: string };

// `code` is an icon identifier resolved by <EmoteIcon /> — it travels over
// the socket, so it must stay a stable string.
export const EMOTES: EmoteEntry[] = [
  { code: 'hand-waving', label: 'Hola' },
  { code: 'sunglasses', label: 'Easy' },
  { code: 'target', label: '¡Buen tiro!' },
  { code: 'hands-praying', label: 'Suerte' },
  { code: 'bomb', label: 'Boom' },
  { code: 'smiley-meh', label: 'Mmm...' },
  { code: 'fire', label: 'En racha' },
  { code: 'handshake', label: 'GG' },
];

export type AppState = {
  size: BoardSize;
  game: GameState;
  view: View;
  /** Emote sent by the previous active player, surfaced on the next handoff. */
  pendingEmote: { entry: EmoteEntry; from: Player } | null;
};

export type Action =
  | { type: 'start_game'; size: BoardSize }
  | { type: 'select_piece'; pieceId: string | null }
  | { type: 'rotate' }
  | { type: 'place_at'; cell: Cell }
  | { type: 'remove_ship'; pieceId: string }
  | { type: 'rotate_placed_ship'; pieceId: string }
  | { type: 'move_placed_ship'; pieceId: string; newOrigin: Cell }
  | { type: 'auto_place' }
  | { type: 'reset_player_board' }
  | { type: 'confirm_placement' }
  | { type: 'handoff_continue' }
  | { type: 'shoot'; cell: Cell }
  | { type: 'send_emote'; entry: EmoteEntry }
  | { type: 'rematch' }
  | { type: 'new_game' };

export const initialState: AppState = {
  size: 10,
  game: createGame(10),
  view: { kind: 'setup' },
  pendingEmote: null,
};

function firstUnplacedPieceId(
  fleet: PieceDef[],
  placedIds: Set<string>,
): string | null {
  for (const p of fleet) {
    if (!placedIds.has(p.id)) return p.id;
  }
  return null;
}

function findPiece(size: BoardSize, pieceId: string): PieceDef | undefined {
  return getFleet(size).find((p) => p.id === pieceId);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'start_game': {
      const size = action.size;
      const fleet = getFleet(size);
      return {
        size,
        game: createGame(size),
        view: {
          kind: 'placement',
          currentPlayer: 'A',
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
        },
        pendingEmote: null,
      };
    }

    case 'select_piece': {
      if (state.view.kind !== 'placement') return state;
      return { ...state, view: { ...state.view, selectedPieceId: action.pieceId } };
    }

    case 'rotate': {
      if (state.view.kind !== 'placement') return state;
      const next: Rotation = (((state.view.rotation + 90) % 360) as Rotation);
      return { ...state, view: { ...state.view, rotation: next } };
    }

    case 'place_at': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer, selectedPieceId, rotation } = state.view;
      if (!selectedPieceId) return state;
      const piece = findPiece(state.size, selectedPieceId);
      if (!piece) return state;
      const board = state.game.boards[currentPlayer];
      const validation = validatePlacement(board, piece, action.cell, rotation);
      if (!validation.ok) return state;
      const newBoard = placeShip(board, piece, action.cell, rotation);
      const newGame = setPlayerBoard(state.game, currentPlayer, newBoard);
      const placedIds = new Set(newBoard.ships.map((s) => s.pieceId));
      const nextPieceId = firstUnplacedPieceId(getFleet(state.size), placedIds);
      return {
        ...state,
        game: newGame,
        view: { ...state.view, selectedPieceId: nextPieceId },
      };
    }

    case 'remove_ship': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const newBoard = removeShip(state.game.boards[currentPlayer], action.pieceId);
      const newGame = setPlayerBoard(state.game, currentPlayer, newBoard);
      // Select the removed piece for re-placement
      return {
        ...state,
        game: newGame,
        view: { ...state.view, selectedPieceId: action.pieceId },
      };
    }

    case 'rotate_placed_ship': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const board = state.game.boards[currentPlayer];
      const existing = board.ships.find((s) => s.pieceId === action.pieceId);
      if (!existing) return state;
      const piece = findPiece(state.size, action.pieceId);
      if (!piece) return state;
      // Remove the ship, then try rotations starting from current+90
      const removed = removeShip(board, action.pieceId);
      const order: Rotation[] = [];
      let r: Rotation = existing.rotation;
      for (let i = 0; i < 4; i++) {
        r = (((r + 90) % 360) as Rotation);
        order.push(r);
      }
      for (const newRot of order) {
        const v = validatePlacement(removed, piece, existing.origin, newRot);
        if (v.ok) {
          const placed = placeShip(removed, piece, existing.origin, newRot);
          return {
            ...state,
            game: setPlayerBoard(state.game, currentPlayer, placed),
          };
        }
      }
      // No rotation fits — leave the ship as it was
      return state;
    }

    case 'move_placed_ship': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const board = state.game.boards[currentPlayer];
      const existing = board.ships.find((s) => s.pieceId === action.pieceId);
      if (!existing) return state;
      const piece = findPiece(state.size, action.pieceId);
      if (!piece) return state;
      const removed = removeShip(board, action.pieceId);
      const v = validatePlacement(removed, piece, action.newOrigin, existing.rotation);
      if (!v.ok) return state;
      const placed = placeShip(removed, piece, action.newOrigin, existing.rotation);
      return {
        ...state,
        game: setPlayerBoard(state.game, currentPlayer, placed),
      };
    }

    case 'auto_place': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const fleet = getFleet(state.size);
      const newBoard = autoPlace(state.size, fleet);
      const newGame = setPlayerBoard(state.game, currentPlayer, newBoard);
      return {
        ...state,
        game: newGame,
        view: { ...state.view, selectedPieceId: null },
      };
    }

    case 'reset_player_board': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const fleet = getFleet(state.size);
      const newGame = setPlayerBoard(state.game, currentPlayer, emptyBoard(state.size));
      return {
        ...state,
        game: newGame,
        view: { ...state.view, selectedPieceId: fleet[0]?.id ?? null, rotation: 0 },
      };
    }

    case 'confirm_placement': {
      if (state.view.kind !== 'placement') return state;
      const { currentPlayer } = state.view;
      const fleet = getFleet(state.size);
      const board = state.game.boards[currentPlayer];
      if (board.ships.length !== fleet.length) return state;
      const game = markReady(state.game, currentPlayer);
      if (game.phase === 'playing') {
        return {
          ...state,
          game,
          view: {
            kind: 'handoff',
            toPlayer: game.turn,
            next: 'play',
            message: `Empieza el juego — turno de Jugador ${game.turn}`,
            sub: 'Pasa el dispositivo al jugador indicado y presiona Continuar.',
          },
        };
      }
      const other: Player = currentPlayer === 'A' ? 'B' : 'A';
      return {
        ...state,
        game,
        view: {
          kind: 'handoff',
          toPlayer: other,
          next: 'placement',
          message: `Colocación: Jugador ${other}`,
          sub: 'Pasa el dispositivo al otro jugador y presiona Continuar.',
        },
      };
    }

    case 'handoff_continue': {
      if (state.view.kind !== 'handoff') return state;
      const { toPlayer, next } = state.view;
      if (next === 'placement') {
        const fleet = getFleet(state.size);
        return {
          ...state,
          pendingEmote: null,
          view: {
            kind: 'placement',
            currentPlayer: toPlayer,
            selectedPieceId: fleet[0]?.id ?? null,
            rotation: 0,
          },
        };
      }
      return {
        ...state,
        pendingEmote: null,
        view: { kind: 'play', activePlayer: toPlayer, lastShot: null },
      };
    }

    case 'shoot': {
      if (state.view.kind !== 'play') return state;
      const { activePlayer } = state.view;
      const { state: nextGame, result } = shoot(state.game, activePlayer, action.cell);
      if (!result.ok) return state;

      if (result.gameOver) {
        return { ...state, game: nextGame, view: { kind: 'gameover' } };
      }

      // Build last-shot info for the banner
      const opponentBoard = nextGame.boards[activePlayer === 'A' ? 'B' : 'A'];
      const sunkShipName =
        result.sunkShipId !== undefined
          ? opponentBoard.ships.find((s) => s.pieceId === result.sunkShipId)?.name
          : undefined;
      const lastShot = {
        outcome: result.outcome,
        cell: result.cell,
        ...(sunkShipName ? { sunkShipName } : {}),
      };

      // Turn continues (hit but not sunk)
      if (nextGame.turn === activePlayer) {
        return {
          ...state,
          game: nextGame,
          view: { ...state.view, lastShot },
        };
      }

      // Turn ended → handoff
      const other: Player = activePlayer === 'A' ? 'B' : 'A';
      const outcomeText =
        result.outcome === 'miss'
          ? 'Falló'
          : result.outcome === 'sunk'
            ? `Hundiste ${sunkShipName ?? 'un barco'}`
            : 'Acertaste';
      return {
        ...state,
        game: nextGame,
        view: {
          kind: 'handoff',
          toPlayer: other,
          next: 'play',
          message: `Turno de Jugador ${other}`,
          sub: `${outcomeText}. Pasa el dispositivo y presiona Continuar.`,
        },
      };
    }

    case 'send_emote': {
      if (state.view.kind !== 'play') return state;
      return {
        ...state,
        pendingEmote: { entry: action.entry, from: state.view.activePlayer },
      };
    }

    case 'rematch': {
      const fleet = getFleet(state.size);
      return {
        size: state.size,
        game: createGame(state.size),
        view: {
          kind: 'placement',
          currentPlayer: 'A',
          selectedPieceId: fleet[0]?.id ?? null,
          rotation: 0,
        },
        pendingEmote: null,
      };
    }

    case 'new_game': {
      return {
        size: state.size,
        game: createGame(state.size),
        view: { kind: 'setup' },
        pendingEmote: null,
      };
    }

    default:
      return state;
  }
}

/** Helper: build a Set of cell keys for an arbitrary cell list. */
export function cellSet(cells: Cell[]): Set<string> {
  const s = new Set<string>();
  for (const c of cells) s.add(cellKey(c));
  return s;
}
