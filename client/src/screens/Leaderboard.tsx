import { useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@battlenaval/shared';
import { Avatar } from '../components/Avatar.js';
import { fetchLeaderboard, loadNickname } from '../online/net.js';

type Props = {
  onBack: () => void;
};

type Status = 'loading' | 'loaded' | 'error';

export function Leaderboard({ onBack }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string>('');
  const myNick = loadNickname().trim();

  const reload = async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetchLeaderboard(50);
      setData(res);
      setStatus('loaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      setStatus('error');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="screen screen--leaderboard">
      <div className="brand">
        <span className="brand__mark">🏆</span>
        <span className="brand__name">Marcador global</span>
      </div>

      <section className="card leaderboard-card">
        <div className="leaderboard-head">
          <h2>Top victorias</h2>
          <button type="button" className="btn btn--small" onClick={() => void reload()}>
            ↻ Actualizar
          </button>
        </div>

        {status === 'loading' && <p className="muted">Cargando…</p>}
        {status === 'error' && (
          <p className="lobby-error">No se pudo cargar: {error}</p>
        )}
        {status === 'loaded' && data && data.top.length === 0 && (
          <p className="muted">
            Aún no hay partidas registradas. ¡Sé el primero!
          </p>
        )}
        {status === 'loaded' && data && data.top.length > 0 && (
          <>
            <ol className="leaderboard-list">
              {data.top.map((entry, i) => {
                const isMe = myNick && entry.nickname === myNick;
                return (
                  <li
                    key={entry.nickname}
                    className={`leaderboard-row ${isMe ? 'leaderboard-row--me' : ''}`}
                  >
                    <span className="leaderboard-rank">{rankBadge(i + 1)}</span>
                    <Avatar nickname={entry.nickname} size={36} />
                    <span className="leaderboard-name">{entry.nickname}</span>
                    <span className="leaderboard-wins">{entry.wins}</span>
                  </li>
                );
              })}
            </ol>
            <p className="muted small">
              {data.total} jugador{data.total === 1 ? '' : 'es'} registrado
              {data.total === 1 ? '' : 's'}
            </p>
          </>
        )}
      </section>

      <button type="button" className="btn btn--ghost lobby-back" onClick={onBack}>
        ← Volver al menú
      </button>
    </div>
  );
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}
