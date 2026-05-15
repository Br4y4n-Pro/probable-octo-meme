import { useMemo, type CSSProperties } from 'react';
import { cellKey, rotateShape, type PieceDef, type Rotation } from '@battlenaval/shared';
import { paletteForShip, shipGradient } from '../ship-styles.js';

type Props = {
  piece: PieceDef;
  rotation?: Rotation;
  cellPx?: number;
};

export function MiniShape({ piece, rotation = 0, cellPx = 12 }: Props) {
  const { cells, w, h } = useMemo(() => {
    const rotated = rotateShape(piece.shape, rotation);
    let mx = 0;
    let my = 0;
    for (const c of rotated) {
      if (c.x > mx) mx = c.x;
      if (c.y > my) my = c.y;
    }
    return { cells: rotated, w: mx + 1, h: my + 1 };
  }, [piece.shape, rotation]);

  const palette = useMemo(
    () => paletteForShip(piece.kind, piece.shape.length),
    [piece.kind, piece.shape.length],
  );

  const filledSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of cells) s.add(cellKey(c));
    return s;
  }, [cells]);

  const tiles: React.JSX.Element[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const filled = filledSet.has(`${x},${y}`);
      const hasUp = filledSet.has(`${x},${y - 1}`);
      const hasDown = filledSet.has(`${x},${y + 1}`);
      const hasLeft = filledSet.has(`${x - 1},${y}`);
      const hasRight = filledSet.has(`${x + 1},${y}`);

      const style: CSSProperties = {};
      if (filled) {
        const r = '40%';
        style.background = shipGradient(palette);
        style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)`;
        style.borderRadius = [
          !hasUp && !hasLeft ? r : '0',
          !hasUp && !hasRight ? r : '0',
          !hasDown && !hasRight ? r : '0',
          !hasDown && !hasLeft ? r : '0',
        ].join(' ');
      }
      tiles.push(
        <div
          key={`${x},${y}`}
          className={filled ? 'mini-cell mini-cell--filled' : 'mini-cell'}
          style={style}
        />,
      );
    }
  }

  const wrapStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${w}, ${cellPx}px)`,
    gridTemplateRows: `repeat(${h}, ${cellPx}px)`,
  };

  return (
    <div className="mini-shape" style={wrapStyle}>
      {tiles}
    </div>
  );
}
