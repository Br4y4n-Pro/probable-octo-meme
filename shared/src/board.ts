import type { Board, BoardSize, Cell } from './types.js';

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function parseCellKey(key: string): Cell {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}

export function inBounds(c: Cell, width: number, height: number): boolean {
  return c.x >= 0 && c.x < width && c.y >= 0 && c.y < height;
}

export function emptyBoard(size: BoardSize): Board {
  return { width: size, height: size, ships: [] };
}

export function occupiedCellSet(board: Board): Set<string> {
  const set = new Set<string>();
  for (const ship of board.ships) {
    for (const c of ship.cells) set.add(cellKey(c));
  }
  return set;
}
