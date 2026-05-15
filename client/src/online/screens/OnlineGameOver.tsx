import { useEffect } from 'react';
import { playWin } from '../../sound.js';
import { Avatar } from '../../components/Avatar.js';
import { Confetti } from '../../components/Confetti.js';
import type { GameOverReason, Player } from '@battlenaval/shared';

type Props = {
  winner: Player;
  reason: GameOverReason;
  myRole: Player;
  myNickname: string;
  opponentNickname: string;
  meWantsRematch: boolean;
  opponentWantsRematch: boolean;
  opponentPresent: boolean;
  onRematch: () => void;
  onReturn: () => void;
  onExit: () => void;
};

export function OnlineGameOver({
  winner,
  reason,
  myRole,
  myNickname,
  opponentNickname,
  meWantsRematch,
  opponentWantsRematch,
  opponentPresent,
  onRematch,
  onReturn,
  onExit,
}: Props) {
  const won = winner === myRole;
  const winnerName = won ? myNickname : opponentNickname;

  useEffect(() => {
    if (won) playWin();
  }, [won]);

  const headline = won ? '🏆 ¡Ganaste!' : '💀 Perdiste';
  const subtitle =
    reason === 'turn-timeout'
      ? won
        ? 'Tu rival se quedó sin tiempo en su turno.'
        : 'Te quedaste sin tiempo en tu turno.'
      : won
        ? 'Hundiste toda la flota rival.'
        : 'Tu flota fue completamente hundida.';

  const rematchAvailable = opponentPresent;

  let rematchBlock: React.JSX.Element;
  if (!rematchAvailable) {
    rematchBlock = (
      <p className="muted small rematch-hint">
        Tu rival se fue — no se puede pedir revancha.
      </p>
    );
  } else if (meWantsRematch && !opponentWantsRematch) {
    rematchBlock = (
      <p className="rematch-hint banner">
        Esperando a que tu rival acepte la revancha…
      </p>
    );
  } else if (!meWantsRematch && opponentWantsRematch) {
    rematchBlock = (
      <p className="rematch-hint banner banner--warn">
        🔁 Tu rival quiere revancha
      </p>
    );
  } else {
    rematchBlock = <></>;
  }

  return (
    <div className="screen screen--gameover">
      <Confetti type={won ? 'win' : 'lose'} count={won ? 80 : 55} />
      <div className="card card--centered">
        <p className="muted">
          {reason === 'turn-timeout' ? 'Fin por inactividad' : 'Fin de la partida'}
        </p>
        <div className="winner-avatar">
          <Avatar nickname={winnerName || '?'} size={84} />
          <span className="winner-name">{winnerName}</span>
        </div>
        <h1 className="winner">{headline}</h1>
        <p className="muted">{subtitle}</p>

        {rematchBlock}

        <div className="row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRematch}
            disabled={!rematchAvailable || meWantsRematch}
          >
            {meWantsRematch ? 'Revancha pedida…' : '🔁 Revancha'}
          </button>
          <button type="button" className="btn" onClick={onReturn}>
            Nueva sala
          </button>
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            Menú
          </button>
        </div>
      </div>
    </div>
  );
}
