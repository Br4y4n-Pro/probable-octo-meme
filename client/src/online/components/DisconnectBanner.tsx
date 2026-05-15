import { useEffect, useState } from 'react';

type Props = {
  /** Epoch ms when the opponent disconnected. */
  leftAt: number;
  /** Total grace period in seconds (server-reported). */
  graceSeconds: number;
};

export function DisconnectBanner({ leftAt, graceSeconds }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [leftAt]);

  const totalMs = graceSeconds * 1000;
  const elapsedMs = now - leftAt;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const secs = Math.ceil(remainingMs / 1000);
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const critical = secs <= 5;

  return (
    <div className={`disc-banner ${critical ? 'disc-banner--critical' : ''}`}>
      <div className="disc-banner__row">
        <span className="disc-banner__text">
          📡 Rival desconectado — esperando reconexión
        </span>
        <span className="disc-banner__secs">{secs}s</span>
      </div>
      <div className="disc-banner__bar">
        <div className="disc-banner__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
