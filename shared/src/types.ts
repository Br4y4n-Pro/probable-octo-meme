export type Cell = { x: number; y: number };

export type PieceKind = 'straight' | 'L' | 'T';

export type Rotation = 0 | 90 | 180 | 270;

export type BoardSize = 8 | 10 | 12 | 15 | 30;

export type Player = 'A' | 'B';

export type GamePhase = 'placement' | 'playing' | 'finished';

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

/** Template for a piece — relative offsets at rotation 0. */
export type PieceDef = {
  /** Unique id within a fleet (e.g. "s3-a"). */
  id: string;
  kind: PieceKind;
  /** Display name (e.g. "Recto-3", "L-4"). */
  name: string;
  /** Canonical cell offsets at rotation 0 (normalized so min x/y === 0). */
  shape: Cell[];
};

export type PlacedShip = {
  pieceId: string;
  kind: PieceKind;
  name: string;
  origin: Cell;
  rotation: Rotation;
  /** Absolute occupied cells, computed once on placement. */
  cells: Cell[];
  /** "x,y" keys of cells that have been hit. */
  hits: string[];
  sunk: boolean;
};

export type Board = {
  width: number;
  height: number;
  ships: PlacedShip[];
};

export type ShotRecord = {
  cell: Cell;
  outcome: ShotOutcome;
  /** Set when outcome === 'sunk'. */
  sunkShipId?: string;
};

export type GameState = {
  size: BoardSize;
  phase: GamePhase;
  boards: Record<Player, Board>;
  /** Shots fired BY each player (keys "x,y" → ShotRecord). */
  shots: Record<Player, Record<string, ShotRecord>>;
  turn: Player;
  ready: Record<Player, boolean>;
  winner: Player | null;
};
