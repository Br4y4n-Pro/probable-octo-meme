import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFleet,
  shipCells,
  validatePlacement,
  type Cell,
  type PieceDef,
} from '@battlenaval/shared';
import { Board } from '../../components/Board.js';
import { MiniShape } from '../../components/MiniShape.js';
import { useShipDrag } from '../../components/useShipDrag.js';
import { paletteForShip } from '../../ship-styles.js';
import { playPlace } from '../../sound.js';
import type { OnlineAction, OnlineState, OnlineView } from '../state.js';

type Props = {
  state: OnlineState;
  view: Extract<OnlineView, { kind: 'placement' } | { kind: 'placement_waiting' }>;
  dispatch: (a: OnlineAction) => void;
  onQuickPlace: () => Promise<void> | void;
  onConfirm: () => Promise<void> | void;
  onLeave: () => void;
};

export function OnlinePlacement({
  state,
  view,
  dispatch,
  onQuickPlace,
  onConfirm,
  onLeave,
}: Props) {
  const size = state.session?.size ?? 10;
  const fleet = useMemo(() => getFleet(size), [size]);
  const board = state.myBoard;
  const placedIds = useMemo(
    () => new Set(board.ships.map((s) => s.pieceId)),
    [board.ships],
  );

  const placementView = view.kind === 'placement' ? view : null;
  const selectedPiece: PieceDef | null = placementView?.selectedPieceId
    ? (fleet.find((p) => p.id === placementView.selectedPieceId) ?? null)
    : null;
  const rotation = placementView?.rotation ?? 0;

  const [hovered, setHovered] = useState<Cell | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useShipDrag({
    board,
    fleet,
    size,
    getBoardEl: () => boardRef.current,
    onMove: (pieceId, newOrigin) => {
      playPlace();
      dispatch({ type: 'move_placed_local', pieceId, newOrigin });
    },
  });

  useEffect(() => {
    if (view.kind !== 'placement') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        dispatch({ type: 'rotate_selection' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, view.kind]);

  const hoverPreview = useMemo(() => {
    if (!selectedPiece || !hovered || view.kind !== 'placement') return null;
    const cells = shipCells(selectedPiece, hovered, rotation);
    const v = validatePlacement(board, selectedPiece, hovered, rotation);
    return { cells, valid: v.ok };
  }, [selectedPiece, hovered, rotation, board, view.kind]);
  const preview = drag.preview ?? hoverPreview;

  const allPlaced = board.ships.length === fleet.length;
  const remaining = fleet.length - board.ships.length;

  if (view.kind === 'placement_waiting') {
    return (
      <div className="screen screen--placement-waiting">
        <div className="card card--centered">
          <h1>¡Listo!</h1>
          <p className="muted">Esperando a que tu rival termine de colocar…</p>
          <div className="waiting-anim">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          {state.opponentReady && (
            <p className="banner">Rival listo — iniciando partida</p>
          )}
          {!state.opponentPresent && (
            <p className="banner" style={{ borderColor: '#f59e0b' }}>
              Rival desconectado, esperando reconexión…
            </p>
          )}
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            Salir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--placement">
      <header className="topbar">
        <div>
          <h2>Coloca tu flota</h2>
          <p className="muted">
            {allPlaced
              ? '¡Flota completa! Pulsa Listo cuando estés.'
              : `${remaining} barco${remaining === 1 ? '' : 's'} por colocar`}
          </p>
          {state.opponentReady && (
            <p className="banner small">El rival ya está listo</p>
          )}
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn" onClick={() => void onQuickPlace()}>
            Colocación rápida
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => dispatch({ type: 'reset_local_board' })}
            disabled={board.ships.length === 0}
          >
            Reiniciar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void onConfirm()}
            disabled={!allPlaced}
          >
            Listo
          </button>
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            Salir
          </button>
        </div>
      </header>

      <div className="placement-layout">
        <Board
          ref={boardRef}
          board={board}
          size={size}
          revealShips
          shotsOnBoard={{}}
          preview={preview}
          interactive
          shipsDraggable
          hiddenShipPieceId={drag.draggingPieceId}
          onCellPointerDown={drag.onCellPointerDown}
          onCellClick={(c) => {
            if (drag.consumeJustDragged()) return;
            const occupying = board.ships.find((s) =>
              s.cells.some((sc) => sc.x === c.x && sc.y === c.y),
            );
            if (occupying) {
              playPlace();
              dispatch({ type: 'rotate_placed_local', pieceId: occupying.pieceId });
              return;
            }
            if (!selectedPiece) return;
            playPlace();
            dispatch({ type: 'place_local', cell: c });
          }}
          onCellHover={setHovered}
        />

        <aside className="palette">
          <div className="palette__header">
            <h3>Tu flota</h3>
            {selectedPiece && (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => dispatch({ type: 'rotate_selection' })}
                title="Rotar 90° (tecla R)"
              >
                Rotar (R) · {rotation}°
              </button>
            )}
          </div>
          <ul className="palette__list">
            {fleet.map((p) => {
              const placed = placedIds.has(p.id);
              const selected = placementView?.selectedPieceId === p.id;
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
                      rotation={selected ? rotation : 0}
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
                      onClick={() => dispatch({ type: 'remove_local', pieceId: p.id })}
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
              ? 'Haz clic para colocar. R rota.'
              : '¡Flota completa! Pulsa Listo.'}
            <br />
            <span className="muted">
              Tip: clic en un barco lo rota · arrástralo para moverlo.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
