import { cellKey, emptyBoard, inBounds } from './board.js';
import type {
  Board,
  BoardSize,
  Cell,
  GameState,
  PlacedShip,
  Player,
  ShotOutcome,
  ShotRecord,
} from './types.js';

export function createGame(size: BoardSize): GameState {
  return {
    size,
    phase: 'placement',
    boards: { A: emptyBoard(size), B: emptyBoard(size) },
    shots: { A: {}, B: {} },
    turn: 'A',
    ready: { A: false, B: false },
    winner: null,
  };
}

export function setPlayerBoard(state: GameState, player: Player, board: Board): GameState {
  return { ...state, boards: { ...state.boards, [player]: board } };
}

export function otherPlayer(p: Player): Player {
  return p === 'A' ? 'B' : 'A';
}

/** Mark a player ready. When both ready, transition to 'playing' and pick a random first turn. */
export function markReady(
  state: GameState,
  player: Player,
  rng: () => number = Math.random,
): GameState {
  const ready = { ...state.ready, [player]: true };
  const bothReady = ready.A && ready.B;
  if (!bothReady) {
    return { ...state, ready };
  }
  const firstTurn: Player = rng() < 0.5 ? 'A' : 'B';
  return { ...state, ready, phase: 'playing', turn: firstTurn };
}

export type ShootError =
  | 'not-your-turn'
  | 'wrong-phase'
  | 'already-shot'
  | 'out-of-bounds';

export type ShootSuccess = {
  ok: true;
  cell: Cell;
  outcome: ShotOutcome;
  sunkShipId?: string;
  gameOver?: Player;
};

export type ShootResult = ShootSuccess | { ok: false; reason: ShootError };

/** Apply a shot from `player` at `cell` to the opponent's board. */
export function shoot(
  state: GameState,
  player: Player,
  cell: Cell,
): { state: GameState; result: ShootResult } {
  if (state.phase !== 'playing') {
    return { state, result: { ok: false, reason: 'wrong-phase' } };
  }
  if (state.turn !== player) {
    return { state, result: { ok: false, reason: 'not-your-turn' } };
  }
  const opp = otherPlayer(player);
  const oppBoard = state.boards[opp];
  if (!inBounds(cell, oppBoard.width, oppBoard.height)) {
    return { state, result: { ok: false, reason: 'out-of-bounds' } };
  }
  const key = cellKey(cell);
  if (state.shots[player][key]) {
    return { state, result: { ok: false, reason: 'already-shot' } };
  }

  // Resolve the shot
  const hitShip = oppBoard.ships.find((s) =>
    s.cells.some((c) => cellKey(c) === key),
  );

  let outcome: ShotOutcome = 'miss';
  let updatedBoard: Board = oppBoard;
  let sunkShipId: string | undefined;

  if (hitShip) {
    const newHits = [...hitShip.hits, key];
    const sunk = hitShip.cells.every((c) => newHits.includes(cellKey(c)));
    outcome = sunk ? 'sunk' : 'hit';
    if (sunk) sunkShipId = hitShip.pieceId;
    const updatedShip: PlacedShip = { ...hitShip, hits: newHits, sunk };
    updatedBoard = {
      ...oppBoard,
      ships: oppBoard.ships.map((s) =>
        s.pieceId === hitShip.pieceId ? updatedShip : s,
      ),
    };
  }

  // Build shot record (omit sunkShipId when undefined for exactOptionalPropertyTypes)
  const shotRecord: ShotRecord =
    sunkShipId !== undefined
      ? { cell, outcome, sunkShipId }
      : { cell, outcome };

  const newShotsForPlayer = { ...state.shots[player], [key]: shotRecord };

  const allSunk = updatedBoard.ships.every((s) => s.sunk);

  // Turn rule (user spec):
  //   hit (not sunk) → keep shooting
  //   sunk           → turn ends
  //   miss           → turn ends
  const keepTurn = outcome === 'hit';
  const nextTurn: Player = allSunk ? player : keepTurn ? player : opp;

  const newState: GameState = {
    ...state,
    boards: { ...state.boards, [opp]: updatedBoard },
    shots: { ...state.shots, [player]: newShotsForPlayer },
    turn: nextTurn,
    phase: allSunk ? 'finished' : 'playing',
    winner: allSunk ? player : null,
  };

  const success: ShootSuccess = { ok: true, cell, outcome };
  if (sunkShipId !== undefined) success.sunkShipId = sunkShipId;
  if (allSunk) success.gameOver = player;

  return { state: newState, result: success };
}
