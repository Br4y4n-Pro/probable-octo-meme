import { useEffect, useMemo, useState } from 'react';
import { otherPlayer, type Cell } from '@battlenaval/shared';
import { Board } from '../../components/Board.js';
import { EmotePicker } from '../../components/EmotePicker.js';
import {
  playBigExplosion,
  playEmote,
  playExplosion,
  playRadar,
  playShot,
  playSplash,
} from '../../sound.js';
import type { EmoteEntry } from '../../state.js';
import type { OnlineState, OnlineView, LastShot } from '../state.js';
import { TurnTimer } from '../components/TurnTimer.js';
import { DisconnectBanner } from '../components/DisconnectBanner.js';
import { Avatar } from '../../components/Avatar.js';
import { SunkPopup } from '../../components/SunkPopup.js';
import { RadarPopup } from '../../components/RadarPopup.js';
import { EmoteIcon } from '../../components/EmoteIcon.js';
import { SmileySticker } from '@phosphor-icons/react';

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
  const [radarAlert, setRadarAlert] = useState<{
    x: number;
    y: number;
    id: number;
  } | null>(null);

  // Auto-flip the board on turn change so the player always sees what matters:
  //   - opponent's turn → show MY board (defense) so I watch their shots land
  //   - my turn → switch to ATTACK with a brief delay so the opponent's last
  //     shot animation has time to play on the defense view first
  useEffect(() => {
    setSentEmote(null);
    if (myTurn) {
      const t = window.setTimeout(() => setBoardView('attack'), 1500);
      return () => window.clearTimeout(t);
    }
    setBoardView('defense');
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

  // Radar popup — fires when a radar powerup reveals an enemy ship cell.
  // Crucial as feedback because collecting the powerup is a miss, which ends
  // the turn and auto-flips the board away from the attack view.
  useEffect(() => {
    if (state.radarPing === 0) return;
    const reveal = state.radarReveals[state.radarReveals.length - 1];
    if (!reveal) return;
    playRadar();
    setRadarAlert({ x: reveal.x + 1, y: reveal.y + 1, id: Date.now() });
    const t = window.setTimeout(() => setRadarAlert(null), 3200);
    return () => window.clearTimeout(t);
  }, [state.radarPing]);

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
          <span className="emote-incoming__code">
            <EmoteIcon code={state.incomingEmote.code} size={44} />
          </span>
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
        <div
          key={boardView}
          className={`board-frame board-frame--${boardView}`}
        >
          <p className="board-caption">
            {boardView === 'attack'
              ? myTurn
                ? '🎯 Haz clic para disparar'
                : '⏳ Esperando al rival…'
              : myTurn
                ? '🛡️ Tu tablero — disparos recibidos'
                : '👁️ El rival está apuntando — observa sus disparos'}
          </p>
          {boardView === 'attack' ? (
            <Board
              board={state.oppBoard}
              size={size}
              revealShips={false}
              shotsOnBoard={state.shotsByMe}
              interactive={myTurn}
              dotGrid
              onCellClick={(c) => void handleShoot(c)}
              powerups={state.powerups[opp]}
              consumedPowerupKeys={state.consumedPowerupKeys[opp]}
              radarReveals={state.radarReveals}
            />
          ) : (
            <Board
              board={state.myBoard}
              size={size}
              revealShips
              shotsOnBoard={state.shotsAtMe}
              powerups={state.powerups[me]}
              consumedPowerupKeys={state.consumedPowerupKeys[me]}
            />
          )}
        </div>
      </div>

      <div className="emote-bar">
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => setEmoteOpen((o) => !o)}
        >
          <SmileySticker size={18} weight="fill" /> Emote
        </button>
        {sentEmote && (
          <span className="emote-sent">
            Enviado: <EmoteIcon code={sentEmote.code} size={18} /> {sentEmote.label}
          </span>
        )}
      </div>

      <EmotePicker
        open={emoteOpen}
        onPick={(entry) => void handleSendEmote(entry)}
        onClose={() => setEmoteOpen(false)}
      />

      {sunkAlert && <SunkPopup key={sunkAlert.id} shipName={sunkAlert.name} />}

      {radarAlert && (
        <RadarPopup key={radarAlert.id} x={radarAlert.x} y={radarAlert.y} />
      )}
    </div>
  );
}
