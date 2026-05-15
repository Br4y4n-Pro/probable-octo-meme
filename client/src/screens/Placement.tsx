import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFleet,
  shipCells,
  validatePlacement,
  type Cell,
  type PieceDef,
} from '@battlenaval/shared';
import type { Action, AppState } from '../state.js';
import { Board } from '../components/Board.js';
import { MiniShape } from '../components/MiniShape.js';
import { useShipDrag } from '../components/useShipDrag.js';
import { paletteForShip } from '../ship-styles.js';
import { playPlace } from '../sound.js';

type Props = {
  state: AppState;
  view: Extract<AppState['view'], { kind: 'placement' }>;
  dispatch: (a: Action) => void;
};

export function Placement({ state, view, dispatch }: Props) {
  const fleet = useMemo(() => getFleet(state.size), [state.size]);
  const board = state.game.boards[view.currentPlayer];
  const placedIds = useMemo(
    () => new Set(board.ships.map((s) => s.pieceId)),
    [board.ships],
  );
  const selectedPiece: PieceDef | null = view.selectedPieceId
    ? (fleet.find((p) => p.id === view.selectedPieceId) ?? null)
    : null;

  const [hovered, setHovered] = useState<Cell | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useShipDrag({
    board,
    fleet,
    size: state.size,
    getBoardEl: () => boardRef.current,
    onMove: (pieceId, newOrigin) => {
      playPlace();
      dispatch({ type: 'move_placed_ship', pieceId, newOrigin });
    },
  });

  // Keyboard rotate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        dispatch({ type: 'rotate' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const hoverPreview = useMemo(() => {
    if (!selectedPiece || !hovered) return null;
    const cells = shipCells(selectedPiece, hovered, view.rotation);
    const validation = validatePlacement(board, selectedPiece, hovered, view.rotation);
    return { cells, valid: validation.ok };
  }, [selectedPiece, hovered, view.rotation, board]);
  // While dragging, the drag preview takes precedence over the hover preview.
  const preview = drag.preview ?? hoverPreview;

  const allPlaced = board.ships.length === fleet.length;
  const remaining = fleet.length - board.ships.length;

  return (
    <div className="screen screen--placement">
      <header className="topbar">
        <div>
          <h2>Jugador {view.currentPlayer}: coloca tu flota</h2>
          <p className="muted">
            {allPlaced
              ? '¡Flota completa! Confirma para continuar.'
              : `${remaining} barco${remaining === 1 ? '' : 's'} por colocar`}
          </p>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: 'auto_place' })}
          >
            Colocación rápida
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => dispatch({ type: 'reset_player_board' })}
            disabled={board.ships.length === 0}
          >
            Reiniciar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => dispatch({ type: 'confirm_placement' })}
            disabled={!allPlaced}
          >
            Listo
          </button>
        </div>
      </header>

      <div className="placement-layout">
        <Board
          ref={boardRef}
          board={board}
          size={state.size}
          revealShips
          shotsOnBoard={{}}
          preview={preview}
          interactive={!!selectedPiece}
          shipsDraggable
          hiddenShipPieceId={drag.draggingPieceId}
          onCellPointerDown={drag.onCellPointerDown}
          onCellClick={(c) => {
            // Swallow the click that follows a successful drag.
            if (drag.consumeJustDragged()) return;
            // If the click lands on a cell occupied by an already-placed ship,
            // try to rotate that ship in place instead of placing a new one.
            const occupying = board.ships.find((s) =>
              s.cells.some((sc) => sc.x === c.x && sc.y === c.y),
            );
            if (occupying) {
              playPlace();
              dispatch({ type: 'rotate_placed_ship', pieceId: occupying.pieceId });
              return;
            }
            if (!selectedPiece) return;
            playPlace();
            dispatch({ type: 'place_at', cell: c });
          }}
          onCellHover={setHovered}
        />

        <aside className="palette">
          <div className="palette__header">
            <h3>Flota</h3>
            {selectedPiece && (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => dispatch({ type: 'rotate' })}
                title="Rotar 90° (tecla R)"
              >
                Rotar (R) · {view.rotation}°
              </button>
            )}
          </div>
          <ul className="palette__list">
            {fleet.map((p) => {
              const placed = placedIds.has(p.id);
              const selected = view.selectedPieceId === p.id;
              const palette = paletteForShip(p.kind, p.shape.length);
              return (
                <li
                  key={p.id}
                  className={`palette-item${selected ? ' palette-item--selected' : ''}${
                    placed ? ' palette-item--placed' : ''
                  }`}
                  style={
                    selected
                      ? { borderColor: palette.glow, boxShadow: `0 0 0 1px ${palette.glow}55` }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className="palette-item__main"
                    onClick={() => {
                      if (placed) return;
                      dispatch({ type: 'select_piece', pieceId: p.id });
                    }}
                    disabled={placed}
                  >
                    <MiniShape
                      piece={p}
                      rotation={selected ? view.rotation : 0}
                      cellPx={11}
                    />
                    <span className="palette-item__text">
                      <span className="palette-item__name">{palette.klass}</span>
                      <span className="palette-item__sub">{p.name}</span>
                    </span>
                  </button>
                  {placed && (
                    <button
                      type="button"
                      className="palette-item__remove"
                      onClick={() => dispatch({ type: 'remove_ship', pieceId: p.id })}
                      title="Quitar"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="palette__hint">
            {selectedPiece
              ? 'Haz clic en el tablero para colocar. Tecla R rota el barco activo.'
              : '¡Flota completa! Pulsa Listo para continuar.'}
            <br />
            <span className="muted">
              Tip: clic sobre un barco lo rota. Arrastra para moverlo.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}

