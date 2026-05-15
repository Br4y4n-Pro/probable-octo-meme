import { useEffect, useState } from 'react';
import { Heart } from '@phosphor-icons/react';
import { MainMenu } from './screens/MainMenu.js';
import { Leaderboard } from './screens/Leaderboard.js';
import { LocalApp } from './LocalApp.js';
import { OnlineApp } from './online/OnlineApp.js';
import { loadSession } from './online/net.js';

type Mode = 'menu' | 'local' | 'online' | 'leaderboard';

function Dedication() {
  return (
    <div className="dedication" aria-hidden>
      para Solangii <Heart size={11} weight="fill" />
    </div>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>('menu');

  // If a stored session exists, auto-jump into online mode to resume
  useEffect(() => {
    if (loadSession()) {
      setMode('online');
    }
  }, []);

  let screen: React.JSX.Element;
  if (mode === 'local') {
    screen = <LocalApp onExit={() => setMode('menu')} />;
  } else if (mode === 'online') {
    screen = <OnlineApp onExit={() => setMode('menu')} />;
  } else if (mode === 'leaderboard') {
    screen = (
      <div className="app">
        <Leaderboard onBack={() => setMode('menu')} />
      </div>
    );
  } else {
    screen = (
      <div className="app">
        <MainMenu
          onPickLocal={() => setMode('local')}
          onPickOnline={() => setMode('online')}
          onPickLeaderboard={() => setMode('leaderboard')}
        />
      </div>
    );
  }

  return (
    <>
      {screen}
      <Dedication />
    </>
  );
}
