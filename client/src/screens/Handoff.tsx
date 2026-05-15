import { useEffect } from 'react';
import type { Action, AppState } from '../state.js';
import { playEmote } from '../sound.js';

type Props = {
  state: AppState;
  view: Extract<AppState['view'], { kind: 'handoff' }>;
  dispatch: (a: Action) => void;
};

export function Handoff({ state, view, dispatch }: Props) {
  const incomingEmote =
    state.pendingEmote && state.pendingEmote.from !== view.toPlayer
      ? state.pendingEmote
      : null;

  useEffect(() => {
    if (incomingEmote) playEmote();
  }, [incomingEmote]);

  return (
    <div className="screen screen--handoff">
      <div className="card card--centered">
        <p className="handoff-label">Pasa el dispositivo a</p>
        <h1 className="handoff-player">Jugador {view.toPlayer}</h1>
        <p className="handoff-message">{view.message}</p>
        <p className="muted">{view.sub}</p>

        {incomingEmote && (
          <div className="emote-incoming">
            <span className="emote-incoming__from">
              Jugador {incomingEmote.from} te dice:
            </span>
            <span className="emote-incoming__code">
              {incomingEmote.entry.code}
            </span>
            <span className="emote-incoming__label">
              {incomingEmote.entry.label}
            </span>
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={() => dispatch({ type: 'handoff_continue' })}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
