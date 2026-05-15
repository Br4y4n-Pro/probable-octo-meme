import { useEffect, useRef, useState } from 'react';
import {
  removeShip,
  shipCells,
  validatePlacement,
  type Board,
  type Cell,
  type PieceDef,
  type Rotation,
} from '@battlenaval/shared';

const DRAG_THRESHOLD_PX = 5;

type DragState = {
  pieceId: string;
  rotation: Rotation;
  /** Difference from the ship's origin to the cell the user grabbed. */
  grabOffset: Cell;
  /** Current cell the pointer is over (may be out of bounds). */
  pointerCell: Cell;
  startClient: { x: number; y: number };
  moved: boolean;
};

export type ShipDragOptions = {
  board: Board;
  fleet: PieceDef[];
  size: number;
  /** Lazy getter for the board DOM node, so the hook can measure it. */
  getBoardEl: () => HTMLDivElement | null;
  /** Called when a valid drop completes. */
  onMove: (pieceId: string, newOrigin: Cell) => void;
  /** Optional: fires when the drag actually starts (after threshold). */
  onDragStart?: () => void;
};

export type ShipDragApi = {
  /** Translucent preview cells under the cursor while dragging. */
  preview: { cells: Cell[]; valid: boolean } | null;
  isDragging: boolean;
  /** id of the ship currently being moved; null when idle. */
  draggingPieceId: string | null;
  onCellPointerDown: (cell: Cell, e: React.PointerEvent) => void;
  /**
   * True iff the most recent pointerup was a drag (not a plain click).
   * Calling this consumes the flag — use it in your `onClick` handler to
   * decide whether to fall through to the normal click behavior.
   */
  consumeJustDragged: () => boolean;
};

export function useShipDrag(opts: ShipDragOptions): ShipDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);
  const justDraggedRef = useRef(false);
  // Keep latest opts in a ref so the global pointer handlers always see the
  // current board/fleet without re-registering on every keystroke.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      const el = optsRef.current.getBoardEl();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sz = optsRef.current.size;
      const cx = Math.floor(((e.clientX - rect.left) / rect.width) * sz);
      const cy = Math.floor(((e.clientY - rect.top) / rect.height) * sz);
      const dist = Math.hypot(
        e.clientX - drag.startClient.x,
        e.clientY - drag.startClient.y,
      );
      const becameDrag = !drag.moved && dist > DRAG_THRESHOLD_PX;
      if (becameDrag) optsRef.current.onDragStart?.();
      setDrag((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pointerCell: { x: cx, y: cy },
          moved: prev.moved || dist > DRAG_THRESHOLD_PX,
        };
      });
    };
    const handleUp = () => {
      setDrag((prev) => {
        if (!prev) return prev;
        if (prev.moved) {
          const { board, fleet, onMove } = optsRef.current;
          const piece = fleet.find((p) => p.id === prev.pieceId);
          if (piece) {
            const newOrigin: Cell = {
              x: prev.pointerCell.x - prev.grabOffset.x,
              y: prev.pointerCell.y - prev.grabOffset.y,
            };
            const tempBoard = removeShip(board, prev.pieceId);
            const v = validatePlacement(
              tempBoard,
              piece,
              newOrigin,
              prev.rotation,
            );
            if (v.ok) onMove(prev.pieceId, newOrigin);
          }
          justDraggedRef.current = true;
        }
        return null;
      });
    };
    const handleCancel = () => setDrag(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [drag?.pieceId, drag?.startClient.x, drag?.startClient.y]);

  const preview =
    drag && drag.moved
      ? (() => {
          const piece = opts.fleet.find((p) => p.id === drag.pieceId);
          if (!piece) return null;
          const origin: Cell = {
            x: drag.pointerCell.x - drag.grabOffset.x,
            y: drag.pointerCell.y - drag.grabOffset.y,
          };
          const cells = shipCells(piece, origin, drag.rotation);
          const tempBoard = removeShip(opts.board, drag.pieceId);
          const valid = validatePlacement(
            tempBoard,
            piece,
            origin,
            drag.rotation,
          ).ok;
          return { cells, valid };
        })()
      : null;

  const onCellPointerDown = (cell: Cell, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const occupying = opts.board.ships.find((s) =>
      s.cells.some((sc) => sc.x === cell.x && sc.y === cell.y),
    );
    if (!occupying) return;
    setDrag({
      pieceId: occupying.pieceId,
      rotation: occupying.rotation,
      grabOffset: {
        x: cell.x - occupying.origin.x,
        y: cell.y - occupying.origin.y,
      },
      pointerCell: cell,
      startClient: { x: e.clientX, y: e.clientY },
      moved: false,
    });
  };

  const consumeJustDragged = () => {
    const was = justDraggedRef.current;
    justDraggedRef.current = false;
    return was;
  };

  return {
    preview,
    isDragging: drag !== null && drag.moved,
    draggingPieceId: drag?.moved ? drag.pieceId : null,
    onCellPointerDown,
    consumeJustDragged,
  };
}
