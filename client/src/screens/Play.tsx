import { useEffect, useMemo, useState } from 'react';
import { otherPlayer, type Player } from '@battlenaval/shared';
import type { Action, AppState, EmoteEntry } from '../state.js';
import { Board } from '../components/Board.js';
import { EmotePicker } from '../components/EmotePicker.js';
import { SunkPopup } from '../components/SunkPopup.js';
import {
  playBigExplosion,
  playExplosion,
  playShot,
  playSplash,
} from '../sound.js';

type Props = {
  state: AppState;
  view: Extract<AppState['view'], { kind: 'play' }>;
  dispatch: (a: Action) => void;
};

type BoardView = 'attack' | 'defense';

export function Play({ state, view, dispatch }: Props) {
  const me: Player = view.activePlayer;
  const opp: Player = otherPlayer(me);

  const myBoard = state.game.boards[me];
  const oppBoard = state.game.boards[opp];

  // Shots on my board = shots opponent fired at me
  const shotsOnMyBoard = state.game.shots[opp];
  // Shots on opp board = shots I fired
  const shotsOnOppBoard = state.game.shots[me];

  const myAfloat = myBoard.ships.filter((s) => !s.sunk).length;
  const oppAfloat = oppBoard.ships.filter((s) => !s.sunk).length;

  const [boardView, setBoardView] = useState<BoardView>('attack');
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [sentEmote, setSentEmote] = useState<EmoteEntry | null>(null);
  const [sunkAlert, setSunkAlert] = useState<{ name: string; id: number } | null>(
    null,
  );

  // Reset view to attack at start of every turn
  useEffect(() => {
    setBoardView('attack');
    setSentEmote(null);
  }, [view.activePlayer]);

  // Play resulting sound for the last shot
  useEffect(() => {
    if (!view.lastShot) return;
    if (view.lastShot.outcome === 'miss') playSplash();
    else if (view.lastShot.outcome === 'hit') playExplosion();
    else if (view.lastShot.outcome === 'sunk') playBigExplosion();
  }, [view.lastShot]);

  // Trigger the centered "¡HUNDIDO!" overlay when a ship goes down.
  useEffect(() => {
    if (!view.lastShot || view.lastShot.outcome !== 'sunk') return;
    setSunkAlert({
      name: view.lastShot.sunkShipName ?? 'un barco',
      id: Date.now(),
    });
    const t = window.setTimeout(() => setSunkAlert(null), 1600);
    return () => window.clearTimeout(t);
  }, [view.lastShot]);

  const banner = useMemo(() => {
    if (!view.lastShot) return null;
    const { outcome, cell, sunkShipName } = view.lastShot;
    if (outcome === 'miss')
      return `🌊 Fallaste en (${cell.x + 1}, ${cell.y + 1}) — turno terminado`;
    if (outcome === 'sunk')
      return `💥 ¡Hundiste ${sunkShipName ?? 'un barco'}! Turno terminado`;
    return `🔥 ¡Acertaste en (${cell.x + 1}, ${cell.y + 1})! Sigues disparando`;
  }, [view.lastShot]);

  const handleShoot = (cell: { x: number; y: number }) => {
    if (boardView !== 'attack') return;
    playShot();
    dispatch({ type: 'shoot', cell });
  };

  const handleSendEmote = (entry: EmoteEntry) => {
    setSentEmote(entry);
    dispatch({ type: 'send_emote', entry });
  };

  return (
    <div className="screen screen--play">
      <header className="topbar">
        <div>
          <h2>Jugador {me} · tu turno</h2>
          {banner && <p className="banner">{banner}</p>}
        </div>
        <div className="topbar__meta">
          <span className="meta-pill">
            🚢 Tu flota: <strong>{myAfloat}/{myBoard.ships.length}</strong>
          </span>
          <span className="meta-pill">
            🎯 Rival: <strong>{oppAfloat}/{oppBoard.ships.length}</strong>
          </span>
        </div>
      </header>

      <nav className="board-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={boardView === 'attack'}
          className={`toggle-btn ${boardView === 'attack' ? 'toggle-btn--active' : ''}`}
          onClick={() => setBoardView('attack')}
        >
          🎯 Atacar al rival
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={boardView === 'defense'}
          className={`toggle-btn ${boardView === 'defense' ? 'toggle-btn--active' : ''}`}
          onClick={() => setBoardView('defense')}
        >
          🛡️ Tu tablero
        </button>
      </nav>

      <div className="single-board">
        <div
          key={boardView}
          className={`board-frame board-frame--${boardView}`}
        >
          <p className="board-caption">
            {boardView === 'attack'
              ? '🎯 Haz clic en una celda para disparar'
              : '🛡️ Aquí caen los disparos del rival'}
          </p>
          {boardView === 'attack' ? (
            <Board
              board={oppBoard}
              size={state.size}
              revealShips={false}
              shotsOnBoard={shotsOnOppBoard}
              interactive
              onCellClick={handleShoot}
            />
          ) : (
            <Board
              board={myBoard}
              size={state.size}
              revealShips
              shotsOnBoard={shotsOnMyBoard}
            />
          )}
        </div>
      </div>

      <div className="emote-bar">
        <button
          type="button"
          className="btn"
          onClick={() => setEmoteOpen((o) => !o)}
        >
          💬 Emote
        </button>
        {sentEmote && (
          <span className="emote-sent">
            Enviado: <strong>{sentEmote.code}</strong> {sentEmote.label}
          </span>
        )}
      </div>

      <EmotePicker
        open={emoteOpen}
        onPick={handleSendEmote}
        onClose={() => setEmoteOpen(false)}
      />

      {sunkAlert && <SunkPopup key={sunkAlert.id} shipName={sunkAlert.name} />}
    </div>
  );
}
