import { useEffect } from 'react';
import type { Action, AppState } from '../state.js';
import { Confetti } from '../components/Confetti.js';
import { playWin } from '../sound.js';

type Props = {
  state: AppState;
  dispatch: (a: Action) => void;
};

export function GameOver({ state, dispatch }: Props) {
  const winner = state.game.winner;

  useEffect(() => {
    playWin();
  }, []);

  return (
    <div className="screen screen--gameover">
      <Confetti type="win" count={80} />
      <div className="card card--centered">
        <p className="muted">Fin de la partida</p>
        <h1 className="winner">🏆 ¡Jugador {winner} gana!</h1>
        <div className="row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => dispatch({ type: 'rematch' })}
          >
            Revancha (mismo tamaño)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: 'new_game' })}
          >
            Nueva partida
          </button>
        </div>
      </div>
    </div>
  );
}
