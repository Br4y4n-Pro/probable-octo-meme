import { useEffect, useMemo, useState } from 'react';
import { otherPlayer, type Cell } from '@battlenaval/shared';
import { Board } from '../../components/Board.js';
import { EmotePicker } from '../../components/EmotePicker.js';
import {
  playBigExplosion,
  playEmote,
  playExplosion,
  playShot,
  playSplash,
} from '../../sound.js';
import type { EmoteEntry } from '../../state.js';
import type { OnlineState, OnlineView, LastShot } from '../state.js';
import { TurnTimer } from '../components/TurnTimer.js';
import { DisconnectBanner } from '../components/DisconnectBanner.js';
import { Avatar } from '../../components/Avatar.js';
import { SunkPopup } from '../../components/SunkPopup.js';

type Props = {
  state: OnlineState;
  view: Extract<OnlineView, { kind: 'playing' }>;
  onShoot: (cell: Cell) => Promise<void> | void;
  onSendEmote: (entry: EmoteEntry) => Promise<void> | void;
  onClearEmote: () => void;
  onLeave: () => void;
};

type BoardView = 'attack' | 'defense';

export function OnlinePlay({
  state,
  view,
  onShoot,
  onSendEmote,
  onClearEmote,
  onLeave,
}: Props) {
  const me = state.session?.role ?? 'A';
  const opp = otherPlayer(me);
  const size = state.session?.size ?? 10;
  const myTurn = state.turn === me;

  const [boardView, setBoardView] = useState<BoardView>('attack');
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [sentEmote, setSentEmote] = useState<EmoteEntry | null>(null);
  const [sunkAlert, setSunkAlert] = useState<{ name: string; id: number } | null>(
    null,
  );

  // Reset view on turn change
  useEffect(() => {
    setSentEmote(null);
    if (myTurn) setBoardView('attack');
  }, [state.turn, myTurn]);

  // Play sounds for last shot
  useEffect(() => {
    const ls = view.lastShot as LastShot | null;
    if (!ls) return;
    if (ls.outcome === 'miss') playSplash();
    else if (ls.outcome === 'hit') playExplosion();
    else if (ls.outcome === 'sunk') playBigExplosion();
  }, [view.lastShot]);

  // Sunk popup (both players see it — drama is shared)
  useEffect(() => {
    const ls = view.lastShot;
    if (!ls || ls.outcome !== 'sunk') return;
    setSunkAlert({ name: ls.sunkShipName ?? 'un barco', id: Date.now() });
    const t = window.setTimeout(() => setSunkAlert(null), 1600);
    return () => window.clearTimeout(t);
  }, [view.lastShot]);

  // Play emote sound when one arrives
  useEffect(() => {
    if (state.incomingEmote) playEmote();
  }, [state.incomingEmote?.receivedAt]);

  // Auto-dismiss incoming emote
  useEffect(() => {
    if (!state.incomingEmote) return;
    const t = window.setTimeout(onClearEmote, 4000);
    return () => window.clearTimeout(t);
  }, [state.incomingEmote, onClearEmote]);

  const banner = useMemo(() => {
    const ls = view.lastShot;
    if (!ls) return null;
    const who = ls.byPlayer === me ? 'Tú' : 'Rival';
    if (ls.outcome === 'miss')
      return `🌊 ${who} falló en (${ls.cell.x + 1}, ${ls.cell.y + 1})`;
    if (ls.outcome === 'sunk')
      return `💥 ${who} hundió ${ls.sunkShipName ?? 'un barco'}`;
    return `🔥 ${who} acertó en (${ls.cell.x + 1}, ${ls.cell.y + 1})`;
  }, [view.lastShot, me]);

  const myAfloat = state.myBoard.ships.filter((s) => !s.sunk).length;
  const oppSunk = state.oppBoard.ships.length;

  const handleShoot = async (cell: Cell) => {
    if (!myTurn || boardView !== 'attack') return;
    playShot();
    await onShoot(cell);
  };

  const handleSendEmote = async (entry: EmoteEntry) => {
    setSentEmote(entry);
    await onSendEmote(entry);
    window.setTimeout(() => setSentEmote(null), 2500);
  };

  return (
    <div className="screen screen--play">
      <header className="topbar">
        <div>
          <div className="play-players">
            <span className={`play-player ${myTurn ? 'play-player--active' : ''}`}>
              <Avatar nickname={state.session?.nickname ?? ''} size={36} />
              <span className="play-player__name">{state.session?.nickname ?? 'Tú'}</span>
            </span>
            <span className="play-vs">vs</span>
            <span className={`play-player ${!myTurn ? 'play-player--active' : ''}`}>
              <Avatar nickname={state.opponentNickname || '?'} size={36} />
              <span className="play-player__name">
                {state.opponentNickname || 'Rival'}
              </span>
            </span>
          </div>
          <h2>{myTurn ? 'Tu turno' : 'Turno del rival'}</h2>
          {banner && <p className="banner">{banner}</p>}
        </div>
        <div className="topbar__meta">
          <TurnTimer deadline={state.turnDeadline} myTurn={myTurn} />
          <span className="meta-pill">
            🚢 Tu flota: <strong>{myAfloat}/{state.myBoard.ships.length}</strong>
          </span>
          <span className="meta-pill">
            🎯 Hundidos: <strong>{oppSunk}</strong>
          </span>
          <button type="button" className="btn btn--small btn--ghost" onClick={onLeave}>
            Salir
          </button>
        </div>
      </header>

      {state.incomingEmote && (
        <div className="emote-incoming emote-toast">
          <span className="emote-incoming__from">
            {state.opponentNickname || 'Rival'} te dice:
          </span>
          <span className="emote-incoming__code">{state.incomingEmote.code}</span>
          <span className="emote-incoming__label">{state.incomingEmote.label}</span>
        </div>
      )}

      {!state.opponentPresent &&
        state.opponentLeftAt !== null &&
        state.opponentLeftGrace !== null && (
          <DisconnectBanner
            leftAt={state.opponentLeftAt}
            graceSeconds={state.opponentLeftGrace}
          />
        )}

      <nav className="board-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={boardView === 'attack'}
          className={`toggle-btn ${boardView === 'attack' ? 'toggle-btn--active' : ''}`}
          onClick={() => setBoardView('attack')}
        >
          🎯 Atacar rival
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
        <p className="board-caption">
          {boardView === 'attack'
            ? myTurn
              ? 'Haz clic para disparar'
              : 'Esperando al rival…'
            : 'Aquí caen los disparos del rival'}
        </p>
        {boardView === 'attack' ? (
          <Board
            board={state.oppBoard}
            size={size}
            revealShips={false}
            shotsOnBoard={state.shotsByMe}
            interactive={myTurn}
            onCellClick={(c) => void handleShoot(c)}
          />
        ) : (
          <Board
            board={state.myBoard}
            size={size}
            revealShips
            shotsOnBoard={state.shotsAtMe}
          />
        )}
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
        onPick={(entry) => void handleSendEmote(entry)}
        onClose={() => setEmoteOpen(false)}
      />

      {sunkAlert && <SunkPopup key={sunkAlert.id} shipName={sunkAlert.name} />}
    </div>
  );
}
