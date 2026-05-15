import { cellKey, emptyBoard, inBounds, occupiedCellSet } from './board.js';
import { getFleet, ROTATIONS, shipCells } from './pieces.js';
import type { Board, BoardSize, Cell, PieceDef, PlacedShip, Rotation } from './types.js';

export type PlacementError =
  | { kind: 'out-of-bounds'; cell: Cell }
  | { kind: 'overlap'; cell: Cell }
  | { kind: 'duplicate-piece'; pieceId: string };

export type PlacementResult =
  | { ok: true; cells: Cell[] }
  | { ok: false; error: PlacementError };

export function validatePlacement(
  board: Board,
  piece: PieceDef,
  origin: Cell,
  rotation: Rotation,
): PlacementResult {
  if (board.ships.some((s) => s.pieceId === piece.id)) {
    return { ok: false, error: { kind: 'duplicate-piece', pieceId: piece.id } };
  }
  const cells = shipCells(piece, origin, rotation);
  const occupied = occupiedCellSet(board);
  for (const c of cells) {
    if (!inBounds(c, board.width, board.height)) {
      return { ok: false, error: { kind: 'out-of-bounds', cell: c } };
    }
    if (occupied.has(cellKey(c))) {
      return { ok: false, error: { kind: 'overlap', cell: c } };
    }
  }
  return { ok: true, cells };
}

export function placeShip(
  board: Board,
  piece: PieceDef,
  origin: Cell,
  rotation: Rotation,
): Board {
  const result = validatePlacement(board, piece, origin, rotation);
  if (!result.ok) {
    throw new Error(`Invalid placement (${result.error.kind})`);
  }
  const newShip: PlacedShip = {
    pieceId: piece.id,
    kind: piece.kind,
    name: piece.name,
    origin,
    rotation,
    cells: result.cells,
    hits: [],
    sunk: false,
  };
  return { ...board, ships: [...board.ships, newShip] };
}

export function removeShip(board: Board, pieceId: string): Board {
  return { ...board, ships: board.ships.filter((s) => s.pieceId !== pieceId) };
}

/** Try to randomly place every piece in `fleet` onto an empty board of `size`. */
export function autoPlace(
  size: BoardSize,
  fleet: PieceDef[],
  rng: () => number = Math.random,
): Board {
  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let board: Board = emptyBoard(size);
    let success = true;
    for (const piece of fleet) {
      const next = tryPlaceRandom(board, piece, rng);
      if (!next) {
        success = false;
        break;
      }
      board = next;
    }
    if (success) return board;
  }
  throw new Error('Auto-placement failed: no valid layout found in 200 attempts');
}

function tryPlaceRandom(board: Board, piece: PieceDef, rng: () => number): Board | null {
  const positions: Array<{ origin: Cell; rotation: Rotation }> = [];
  for (const r of ROTATIONS) {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        positions.push({ origin: { x, y }, rotation: r });
      }
    }
  }
  shuffleInPlace(positions, rng);
  for (const { origin, rotation } of positions) {
    const v = validatePlacement(board, piece, origin, rotation);
    if (v.ok) return placeShip(board, piece, origin, rotation);
  }
  return null;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}

export type BuildBoardError =
  | 'incomplete-fleet'
  | 'duplicate-piece'
  | 'unknown-piece'
  | 'placement-invalid';

/**
 * Validate and apply a sequence of ship placements onto a fresh board.
 * Used by the server to authoritatively reconstruct a player's board from
 * client input. Returns the placed board, or a reason for rejection.
 */
export function buildBoardFromInputs(
  size: BoardSize,
  inputs: { pieceId: string; origin: Cell; rotation: Rotation }[],
): { ok: true; board: Board } | { ok: false; reason: BuildBoardError } {
  const fleet = getFleet(size);
  const fleetById = new Map<string, PieceDef>(fleet.map((p) => [p.id, p]));
  const seen = new Set<string>();
  let board: Board = emptyBoard(size);
  for (const input of inputs) {
    if (seen.has(input.pieceId)) {
      return { ok: false, reason: 'duplicate-piece' };
    }
    const piece = fleetById.get(input.pieceId);
    if (!piece) {
      return { ok: false, reason: 'unknown-piece' };
    }
    const v = validatePlacement(board, piece, input.origin, input.rotation);
    if (!v.ok) {
      return { ok: false, reason: 'placement-invalid' };
    }
    board = placeShip(board, piece, input.origin, input.rotation);
    seen.add(input.pieceId);
  }
  if (seen.size !== fleet.length) {
    return { ok: false, reason: 'incomplete-fleet' };
  }
  return { ok: true, board };
}
