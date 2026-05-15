import { useMemo, type CSSProperties } from 'react';
import {
  cellKey,
  type Board as BoardModel,
  type Cell,
  type PlacedShip,
  type ShotRecord,
} from '@battlenaval/shared';
import { paletteForShip, shipGradient, SUNK_PALETTE } from '../ship-styles.js';

export type BoardProps = {
  board: BoardModel;
  size: number;
  /** Show own ships fully (true) or only sunk ships (false). */
  revealShips: boolean;
  /** Shots fired AT this board (keys "x,y" → ShotRecord). */
  shotsOnBoard: Record<string, ShotRecord>;
  /** Optional placement preview (drawn translucent). */
  preview?: { cells: Cell[]; valid: boolean } | null;
  onCellClick?: (cell: Cell) => void;
  onCellHover?: (cell: Cell | null) => void;
  interactive?: boolean;
};

type CellShipInfo = {
  ship: PlacedShip;
  hasUp: boolean;
  hasDown: boolean;
  hasLeft: boolean;
  hasRight: boolean;
};

export function Board({
  board,
  size,
  revealShips,
  shotsOnBoard,
  preview = null,
  onCellClick,
  onCellHover,
  interactive = false,
}: BoardProps) {
  const shipInfoByCell = useMemo(() => {
    const map = new Map<string, CellShipInfo>();
    for (const ship of board.ships) {
      const cells = new Set(ship.cells.map(cellKey));
      for (const c of ship.cells) {
        map.set(cellKey(c), {
          ship,
          hasUp: cells.has(cellKey({ x: c.x, y: c.y - 1 })),
          hasDown: cells.has(cellKey({ x: c.x, y: c.y + 1 })),
          hasLeft: cells.has(cellKey({ x: c.x - 1, y: c.y })),
          hasRight: cells.has(cellKey({ x: c.x + 1, y: c.y })),
        });
      }
    }
    return map;
  }, [board.ships]);

  const previewSet = useMemo(() => {
    if (!preview) return null;
    const set = new Set<string>();
    for (const c of preview.cells) set.add(cellKey(c));
    return set;
  }, [preview]);

  const cells: React.JSX.Element[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c: Cell = { x, y };
      const key = cellKey(c);
      const info = shipInfoByCell.get(key);
      const shot = shotsOnBoard[key];
      const inPreview = previewSet?.has(key) ?? false;
      const showShip = info && (revealShips || info.ship.sunk);

      const cellClasses: string[] = ['cell'];
      if (interactive) cellClasses.push('cell--interactive');
      if (inPreview) {
        cellClasses.push(preview!.valid ? 'cell--preview-valid' : 'cell--preview-invalid');
      }

      const shipStyle: CSSProperties = {};
      let shipClasses = '';
      if (showShip && info) {
        const r = '40%';
        const o = '11%';
        const tl = !info.hasUp && !info.hasLeft ? r : '0';
        const tr = !info.hasUp && !info.hasRight ? r : '0';
        const br = !info.hasDown && !info.hasRight ? r : '0';
        const bl = !info.hasDown && !info.hasLeft ? r : '0';
        shipStyle.borderRadius = `${tl} ${tr} ${br} ${bl}`;
        shipStyle.top = info.hasUp ? '-1px' : o;
        shipStyle.bottom = info.hasDown ? '-1px' : o;
        shipStyle.left = info.hasLeft ? '-1px' : o;
        shipStyle.right = info.hasRight ? '-1px' : o;
        const palette = info.ship.sunk
          ? SUNK_PALETTE
          : paletteForShip(info.ship.kind, info.ship.cells.length);
        shipStyle.background = shipGradient(palette);
        shipStyle.boxShadow = `
          inset 0 1px 0 rgba(255,255,255,0.30),
          inset 0 -2px 0 rgba(0,0,0,0.35),
          0 1px 3px rgba(0,0,0,0.4),
          0 0 10px ${palette.glow}33
        `;
        shipClasses = 'ship-piece';
        if (info.ship.sunk) shipClasses += ' ship-piece--sunk';
      }

      // Render a flame on the middle cell of a sunk ship so it's clearly
      // "on fire" without spamming every cell with the same emoji.
      let showFlame = false;
      if (info && info.ship.sunk && (revealShips || info.ship.sunk)) {
        const mid = info.ship.cells[Math.floor(info.ship.cells.length / 2)];
        if (mid && mid.x === x && mid.y === y) showFlame = true;
      }

      cells.push(
        <div
          key={key}
          className={cellClasses.join(' ')}
          onClick={onCellClick ? () => onCellClick(c) : undefined}
          onMouseEnter={onCellHover ? () => onCellHover(c) : undefined}
        >
          {showShip && <div className={shipClasses} style={shipStyle} />}
          {showFlame && (
            <span className="ship-flame" aria-hidden>
              🔥
            </span>
          )}
          {shot && (
            <div className={`marker marker--${shot.outcome}`}>
              {shot.outcome === 'miss' ? (
                <span className="marker__splash" aria-hidden />
              ) : (
                <span className="marker__hit" aria-hidden>
                  ✕
                </span>
              )}
            </div>
          )}
        </div>,
      );
    }
  }

  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${size}, 1fr)`,
    gridTemplateRows: `repeat(${size}, 1fr)`,
  };

  return (
    <div
      className="board"
      style={style}
      onMouseLeave={onCellHover ? () => onCellHover(null) : undefined}
    >
      {cells}
    </div>
  );
}
