import { useState } from 'react';
import {
  MAX_PLAYLIST_SONGS,
  type AddSongRes,
  type MusicControlAction,
  type PlaybackState,
  type Player,
  type Song,
} from '@battlenaval/shared';
import { MusicNotes, Pause, Play, SkipBack, SkipForward, Trash } from '@phosphor-icons/react';

type Props = {
  playlist: Song[];
  playback: PlaybackState;
  myRole: Player;
  isHost: boolean;
  onAddSong: (url: string) => Promise<AddSongRes>;
  onRemoveSong: (songId: string) => void;
  onControl: (action: MusicControlAction) => void;
  variant?: 'card' | 'drawer';
};

/** Add-a-song input + the room's shared song list. Host-only playback controls. */
export function PlaylistPanel({
  playlist,
  playback,
  myRole,
  isHost,
  onAddSong,
  onRemoveSong,
  onControl,
  variant = 'card',
}: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const full = playlist.length >= MAX_PLAYLIST_SONGS;

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await onAddSong(trimmed);
    setBusy(false);
    if (res.ok) {
      setUrl('');
    } else {
      setError(addErrorText(res.reason));
    }
  };

  return (
    <div className={`playlist-panel playlist-panel--${variant}`}>
      <h3 className="playlist-panel__title">
        <MusicNotes size={18} weight="fill" /> Música de la sala
        <span className="playlist-panel__count">
          {playlist.length}/{MAX_PLAYLIST_SONGS}
        </span>
      </h3>

      <div className="playlist-add">
        <input
          type="text"
          className="playlist-add__input"
          value={url}
          placeholder="Pega un enlace de YouTube…"
          spellCheck={false}
          disabled={full}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={busy || full || url.trim().length === 0}
          onClick={() => void submit()}
        >
          Añadir
        </button>
      </div>

      {error && <p className="playlist-error">{error}</p>}
      {full && !error && (
        <p className="playlist-error">
          Playlist llena ({MAX_PLAYLIST_SONGS} máx.)
        </p>
      )}

      {playlist.length === 0 ? (
        <p className="muted small">Aún no hay canciones. ¡Agrega la primera!</p>
      ) : (
        <ul className="playlist-songs">
          {playlist.map((song, i) => {
            const isCurrent = i === playback.currentIndex;
            return (
              <li
                key={song.id}
                className={`playlist-song ${
                  isCurrent ? 'playlist-song--current' : ''
                }`}
              >
                <button
                  type="button"
                  className="playlist-song__main"
                  disabled={!isHost}
                  title={isHost ? 'Reproducir esta canción' : undefined}
                  onClick={() =>
                    isHost && onControl({ kind: 'select', index: i })
                  }
                >
                  <span className="playlist-song__index">
                    {isCurrent && playback.playing ? '▶' : i + 1}
                  </span>
                  <span className="playlist-song__name">
                    {song.title || song.videoId}
                  </span>
                  <span className="playlist-song__by">
                    {song.addedBy === myRole ? 'Tú' : 'Rival'}
                  </span>
                </button>
                <button
                  type="button"
                  className="playlist-song__remove"
                  aria-label="Quitar canción"
                  onClick={() => onRemoveSong(song.id)}
                >
                  <Trash size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isHost ? (
        playlist.length > 0 && (
          <div className="playlist-controls">
            <button
              type="button"
              className="btn btn--small"
              onClick={() => onControl({ kind: 'prev' })}
              aria-label="Anterior"
            >
              <SkipBack size={16} weight="fill" />
            </button>
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={() =>
                onControl(
                  playback.playing ? { kind: 'pause' } : { kind: 'play' },
                )
              }
            >
              {playback.playing ? (
                <>
                  <Pause size={16} weight="fill" /> Pausa
                </>
              ) : (
                <>
                  <Play size={16} weight="fill" /> Reproducir
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => onControl({ kind: 'next' })}
              aria-label="Siguiente"
            >
              <SkipForward size={16} weight="fill" />
            </button>
          </div>
        )
      ) : (
        <p className="muted small playlist-panel__note">
          🎧 El anfitrión controla la reproducción.
        </p>
      )}
    </div>
  );
}

function addErrorText(reason: string): string {
  switch (reason) {
    case 'invalid-url':
      return 'Ese enlace de YouTube no es válido.';
    case 'duplicate':
      return 'Esa canción ya está en la playlist.';
    case 'playlist-full':
      return 'La playlist está llena.';
    case 'not-in-room':
      return 'No estás en una sala.';
    default:
      return 'No se pudo añadir la canción.';
  }
}
