import { useEffect, useState } from 'react';

type Props = {
  deadline: number | null;
  /** True if it's the local player's turn (renders prominently / urgent). */
  myTurn: boolean;
};

export function TurnTimer({ deadline, myTurn }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const remainingMs = Math.max(0, deadline - now);
  const secs = Math.ceil(remainingMs / 1000);
  const totalMs = 60_000;
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const level = secs <= 5 ? 'critical' : secs <= 15 ? 'warn' : 'ok';

  return (
    <div className={`turn-timer turn-timer--${level} ${myTurn ? 'turn-timer--mine' : ''}`}>
      <div className="turn-timer__row">
        <span className="turn-timer__label">
          {myTurn ? '⏱ Tu turno' : '⌛ Turno rival'}
        </span>
        <span className="turn-timer__secs">{secs}s</span>
      </div>
      <div className="turn-timer__bar">
        <div className="turn-timer__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
