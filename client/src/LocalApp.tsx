import { useReducer } from 'react';
import { initialState, reducer } from './state.js';
import { Setup } from './screens/Setup.js';
import { Placement } from './screens/Placement.js';
import { Handoff } from './screens/Handoff.js';
import { Play } from './screens/Play.js';
import { GameOver } from './screens/GameOver.js';
import { unlockAudio } from './sound.js';

type Props = {
  onExit: () => void;
};

export function LocalApp({ onExit }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { view } = state;

  return (
    <div className="app local-app" onClick={unlockAudio}>
      <button type="button" className="exit-fab" onClick={onExit} title="Menú principal">
        ← Menú
      </button>
      {view.kind === 'setup' && <Setup dispatch={dispatch} />}
      {view.kind === 'placement' && (
        <Placement state={state} view={view} dispatch={dispatch} />
      )}
      {view.kind === 'handoff' && (
        <Handoff state={state} view={view} dispatch={dispatch} />
      )}
      {view.kind === 'play' && <Play state={state} view={view} dispatch={dispatch} />}
      {view.kind === 'gameover' && <GameOver state={state} dispatch={dispatch} />}
    </div>
  );
}
