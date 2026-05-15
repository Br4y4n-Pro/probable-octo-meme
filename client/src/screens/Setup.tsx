import { useState } from 'react';
import { BOARD_SIZES, getFleet, type BoardSize } from '@battlenaval/shared';
import type { Action } from '../state.js';

const SIZE_LABELS: Record<BoardSize, string> = {
  8: 'Pequeño',
  10: 'Clásico',
  12: 'Grande',
  15: 'Enorme',
  30: 'Masivo',
};

type Props = {
  dispatch: (a: Action) => void;
};

export function Setup({ dispatch }: Props) {
  const [size, setSize] = useState<BoardSize>(10);
  const fleet = getFleet(size);
  const totalCells = fleet.reduce((acc, p) => acc + p.shape.length, 0);

  return (
    <div className="screen screen--setup">
      <div className="brand">
        <span className="brand__mark">⚓</span>
        <span className="brand__name">
          Batalla <em>Naval</em>
        </span>
      </div>
      <h1>Hunde la flota enemiga</h1>
      <p className="lede">Modo local · Pasar y jugar 1v1</p>

      <section className="card">
        <h2>Elige el tamaño del tablero</h2>
        <div className="size-grid">
          {BOARD_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`size-option ${s === size ? 'size-option--active' : ''}`}
              onClick={() => setSize(s)}
            >
              <span className="size-option__num">
                {s}×{s}
              </span>
              <span className="size-option__label">{SIZE_LABELS[s]}</span>
              <span className="size-option__fleet">{getFleet(s).length} barcos</span>
            </button>
          ))}
        </div>

        <div className="fleet-summary">
          <strong>{fleet.length} barcos</strong> · {totalCells} celdas (~
          {Math.round((totalCells / (size * size)) * 100)}% del tablero)
        </div>

        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => dispatch({ type: 'start_game', size })}
        >
          Empezar
        </button>
      </section>
    </div>
  );
}
