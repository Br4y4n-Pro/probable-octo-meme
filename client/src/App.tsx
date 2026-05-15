import { useEffect, useState } from 'react';
import { MainMenu } from './screens/MainMenu.js';
import { Leaderboard } from './screens/Leaderboard.js';
import { LocalApp } from './LocalApp.js';
import { OnlineApp } from './online/OnlineApp.js';
import { loadSession } from './online/net.js';

type Mode = 'menu' | 'local' | 'online' | 'leaderboard';

export function App() {
  const [mode, setMode] = useState<Mode>('menu');

  // If a stored session exists, auto-jump into online mode to resume
  useEffect(() => {
    if (loadSession()) {
      setMode('online');
    }
  }, []);

  if (mode === 'local') return <LocalApp onExit={() => setMode('menu')} />;
  if (mode === 'online') return <OnlineApp onExit={() => setMode('menu')} />;
  if (mode === 'leaderboard') {
    return (
      <div className="app">
        <Leaderboard onBack={() => setMode('menu')} />
      </div>
    );
  }

  return (
    <div className="app">
      <MainMenu
        onPickLocal={() => setMode('local')}
        onPickOnline={() => setMode('online')}
        onPickLeaderboard={() => setMode('leaderboard')}
      />
    </div>
  );
}
