import { useEffect, useRef, useState } from 'react';
import type { MusicControlAction, PlaybackState, Song } from '@battlenaval/shared';
import {
  CaretDown,
  CaretUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from '@phosphor-icons/react';
import { loadYouTubeApi } from '../youtube.js';

type Props = {
  playlist: Song[];
  playback: PlaybackState;
  isHost: boolean;
  onControl: (action: MusicControlAction) => void;
};

/**
 * A small, always-mounted YouTube player pinned to the corner of the app.
 * It mirrors the host-controlled `playback` state: the host's controls send
 * socket actions, followers just watch. Mounted at the app root so the iframe
 * survives view transitions and the audio never restarts.
 */
export function MusicMiniPlayer({
  playlist,
  playback,
  isHost,
  onControl,
}: Props) {
  const hostElRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [ready, setReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Idempotency: only re-apply the host's command when `rev` advances, and
  // only reload the iframe when the actual video id changes.
  const appliedRevRef = useRef(-1);
  const loadedVideoRef = useRef<string | null>(null);

  // Keep the latest callback/role visible to the (stable) onStateChange closure.
  const isHostRef = useRef(isHost);
  const onControlRef = useRef(onControl);
  useEffect(() => {
    isHostRef.current = isHost;
    onControlRef.current = onControl;
  });

  const current =
    playback.currentIndex >= 0 ? playlist[playback.currentIndex] : undefined;

  // Create the YT player exactly once.
  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then(() => {
      if (cancelled || !hostElRef.current || playerRef.current) return;
      const YTns = window.YT;
      if (!YTns) return;
      // YT.Player replaces the element it's given — hand it a throwaway child.
      const inner = document.createElement('div');
      hostElRef.current.appendChild(inner);
      playerRef.current = new YTns.Player(inner, {
        width: 240,
        height: 135,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setReady(true);
          },
          onStateChange: (e) => {
            const PS = window.YT?.PlayerState;
            if (!PS) return;
            if (e.data === PS.PLAYING) setNeedsTap(false);
            // The host advances the shared playlist when a track finishes.
            if (e.data === PS.ENDED && isHostRef.current) {
              onControlRef.current({ kind: 'next' });
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignored
      }
      playerRef.current = null;
    };
  }, []);

  // Apply the shared playback state to the iframe.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player) return;
    if (!current) {
      try {
        player.pauseVideo();
      } catch {
        // ignored
      }
      return;
    }
    if (appliedRevRef.current === playback.rev) return;
    appliedRevRef.current = playback.rev;

    if (loadedVideoRef.current !== current.videoId) {
      loadedVideoRef.current = current.videoId;
      // Coarse seek only on a track change — enough to keep two clients
      // roughly in sync without per-second correction.
      const elapsed =
        playback.playing && playback.startedAt > 0
          ? Math.max(0, (Date.now() - playback.startedAt) / 1000)
          : 0;
      const startSeconds = elapsed > 3 ? elapsed : 0;
      if (playback.playing) {
        player.loadVideoById(current.videoId, startSeconds);
      } else {
        player.cueVideoById(current.videoId, startSeconds);
      }
    } else if (playback.playing) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }

    // Autoplay can be blocked (especially for the follower, whose play wasn't
    // a direct click). Verify shortly after and surface a tap-to-start prompt.
    if (playback.playing) {
      window.setTimeout(() => {
        const p = playerRef.current;
        const PS = window.YT?.PlayerState;
        if (!p || !PS) return;
        let st: number;
        try {
          st = p.getPlayerState();
        } catch {
          return;
        }
        if (st !== PS.PLAYING && st !== PS.BUFFERING) setNeedsTap(true);
      }, 1500);
    }
  }, [ready, playback.rev, current?.videoId, playback.playing]);

  const handleTap = () => {
    try {
      playerRef.current?.playVideo();
    } catch {
      // ignored
    }
    setNeedsTap(false);
  };

  const title = current ? current.title || current.videoId : 'Sin pista';

  return (
    <div
      className={`music-miniplayer ${
        collapsed ? 'music-miniplayer--collapsed' : ''
      }`}
    >
      <div className="music-miniplayer__video">
        <div ref={hostElRef} className="music-miniplayer__frame" />
        {needsTap && (
          <button
            type="button"
            className="music-miniplayer__tap"
            onClick={handleTap}
          >
            <Play size={20} weight="fill" />
            Toca para activar la música
          </button>
        )}
      </div>
      <div className="music-miniplayer__bar">
        <span className="music-miniplayer__title" title={title}>
          {title}
        </span>
        <button
          type="button"
          className="music-miniplayer__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir' : 'Minimizar'}
        >
          {collapsed ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>
      </div>
      {isHost ? (
        <div className="music-miniplayer__controls">
          <button
            type="button"
            onClick={() => onControl({ kind: 'prev' })}
            aria-label="Anterior"
          >
            <SkipBack size={16} weight="fill" />
          </button>
          <button
            type="button"
            className="music-miniplayer__play"
            onClick={() =>
              onControl(playback.playing ? { kind: 'pause' } : { kind: 'play' })
            }
            aria-label={playback.playing ? 'Pausar' : 'Reproducir'}
          >
            {playback.playing ? (
              <Pause size={18} weight="fill" />
            ) : (
              <Play size={18} weight="fill" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onControl({ kind: 'next' })}
            aria-label="Siguiente"
          >
            <SkipForward size={16} weight="fill" />
          </button>
        </div>
      ) : (
        <div className="music-miniplayer__hostnote">
          🎧 Controlada por el anfitrión
        </div>
      )}
    </div>
  );
}
