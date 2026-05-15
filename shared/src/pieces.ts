import type { BoardSize, Cell, PieceDef, Rotation } from './types.js';

/** Rotate a shape by `rotation` degrees CW and normalize so min x/y === 0. */
export function rotateShape(shape: Cell[], rotation: Rotation): Cell[] {
  let cells = shape;
  const steps = rotation / 90;
  for (let i = 0; i < steps; i++) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  return cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
}

/** Compute absolute cells occupied by a piece placed at `origin` with `rotation`. */
export function shipCells(piece: PieceDef, origin: Cell, rotation: Rotation): Cell[] {
  return rotateShape(piece.shape, rotation).map(({ x, y }) => ({
    x: origin.x + x,
    y: origin.y + y,
  }));
}

// ─── Piece constructors ─────────────────────────────────────────────────────

function straight(id: string, length: number): PieceDef {
  return {
    id,
    kind: 'straight',
    name: `Recto-${length}`,
    shape: Array.from({ length }, (_, i) => ({ x: i, y: 0 })),
  };
}

function lPiece(id: string, length: number): PieceDef {
  // vertical bar of (length-1) plus 1 foot
  const shape: Cell[] = [];
  for (let i = 0; i < length - 1; i++) shape.push({ x: 0, y: i });
  shape.push({ x: 1, y: length - 2 });
  return { id, kind: 'L', name: `L-${length}`, shape };
}

function tPiece(id: string, length: number): PieceDef {
  // 3 across at y=0, plus (length-3) cells hanging from center column
  const shape: Cell[] = [];
  for (let i = 0; i < 3; i++) shape.push({ x: i, y: 0 });
  for (let i = 1; i <= length - 3; i++) shape.push({ x: 1, y: i });
  return { id, kind: 'T', name: `T-${length}`, shape };
}

// ─── Fleets per board size ──────────────────────────────────────────────────

export const FLEETS: Record<BoardSize, PieceDef[]> = {
  8: [
    straight('s2-a', 2),
    straight('s3-a', 3),
    lPiece('L4-a', 4),
  ],
  10: [
    straight('s2-a', 2),
    straight('s3-a', 3),
    straight('s4-a', 4),
    lPiece('L4-a', 4),
    tPiece('T4-a', 4),
  ],
  12: [
    straight('s2-a', 2),
    straight('s3-a', 3),
    straight('s3-b', 3),
    straight('s4-a', 4),
    lPiece('L4-a', 4),
    lPiece('L4-b', 4),
    tPiece('T5-a', 5),
  ],
  15: [
    straight('s2-a', 2),
    straight('s3-a', 3),
    straight('s3-b', 3),
    straight('s4-a', 4),
    straight('s5-a', 5),
    lPiece('L4-a', 4),
    lPiece('L4-b', 4),
    tPiece('T5-a', 5),
    tPiece('T5-b', 5),
  ],
  30: [
    straight('s2-a', 2),
    straight('s3-a', 3),
    straight('s3-b', 3),
    straight('s4-a', 4),
    straight('s4-b', 4),
    straight('s5-a', 5),
    straight('s5-b', 5),
    straight('s6-a', 6),
    lPiece('L4-a', 4),
    lPiece('L4-b', 4),
    lPiece('L4-c', 4),
    lPiece('L4-d', 4),
    lPiece('L5-a', 5),
    lPiece('L5-b', 5),
    lPiece('L5-c', 5),
    tPiece('T4-a', 4),
    tPiece('T4-b', 4),
    tPiece('T4-c', 4),
    tPiece('T5-a', 5),
    tPiece('T5-b', 5),
  ],
};

export function getFleet(size: BoardSize): PieceDef[] {
  return FLEETS[size].map((p) => ({ ...p, shape: p.shape.map((c) => ({ ...c })) }));
}

export const BOARD_SIZES: BoardSize[] = [8, 10, 12, 15, 30];
export const ROTATIONS: Rotation[] = [0, 90, 180, 270];
