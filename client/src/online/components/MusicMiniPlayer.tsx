import { useEffect, useRef, useState } from 'react';
import type { MusicControlAction, PlaybackState, Song } from '@battlenaval/shared';
import {
  CaretDown,
  CaretUp,
  DotsSixVertical,
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
  /**
   * Hide the player visually (without unmounting it — the iframe stays alive
   * so the audio keeps playing) while the full playlist panel is on screen.
   */
  hidden: boolean;
};

type Pos = { x: number; y: number };

const POS_KEY = 'battlenaval:miniplayer-pos:v1';

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (
      p &&
      typeof p === 'object' &&
      typeof (p as Pos).x === 'number' &&
      typeof (p as Pos).y === 'number'
    ) {
      return p as Pos;
    }
    return null;
  } catch {
    return null;
  }
}

function savePos(p: Pos): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // ignored
  }
}

/**
 * A small, always-mounted YouTube player. It mirrors the host-controlled
 * `playback` state and can be dragged anywhere on screen by its title bar.
 * Mounted at the app root so the iframe survives view transitions and the
 * audio never restarts.
 */
export function MusicMiniPlayer({
  playlist,
  playback,
  isHost,
  onControl,
  hidden,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostElRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [ready, setReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Free-drag position. `null` → anchored to the default corner via CSS.
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const latestPosRef = useRef<Pos | null>(pos);

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

  // ─── Dragging ──────────────────────────────────────────────────────────
  // Keep the player fully inside the viewport.
  const clampPos = (x: number, y: number): Pos => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 200;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  // On mount (and whenever the viewport resizes) keep a saved position valid.
  useEffect(() => {
    if (pos) setPos((p) => (p ? clampPos(p.x, p.y) : p));
    const onResize = () =>
      setPos((p) => (p ? clampPos(p.x, p.y) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBarPointerDown = (e: React.PointerEvent) => {
    // Ignore non-primary buttons and clicks on the controls (collapse, etc.).
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onBarPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const next = clampPos(
      d.originX + (e.clientX - d.startX),
      d.originY + (e.clientY - d.startY),
    );
    latestPosRef.current = next;
    setPos(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignored
    }
    if (latestPosRef.current) savePos(latestPosRef.current);
  };

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

  const style: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined;

  return (
    <div
      ref={rootRef}
      className={`music-miniplayer ${
        collapsed ? 'music-miniplayer--collapsed' : ''
      } ${dragging ? 'music-miniplayer--dragging' : ''} ${
        hidden ? 'music-miniplayer--hidden' : ''
      }`}
      style={style}
      aria-hidden={hidden}
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
      <div
        className="music-miniplayer__bar"
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <DotsSixVertical
          size={15}
          weight="bold"
          className="music-miniplayer__grip"
        />
        <span className="music-miniplayer__title" title={title}>
          {title}
        </span>
        <button
          type="button"
          className={`music-miniplayer__collapse ${
            collapsed ? 'music-miniplayer__collapse--expand' : ''
          }`}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Mostrar video' : 'Minimizar video'}
          title={collapsed ? 'Mostrar video' : 'Minimizar video'}
        >
          {collapsed ? (
            <CaretUp size={16} weight="bold" />
          ) : (
            <CaretDown size={16} weight="bold" />
          )}
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
