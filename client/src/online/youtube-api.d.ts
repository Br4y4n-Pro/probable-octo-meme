// Minimal ambient typings for the YouTube IFrame Player API.
// Only the surface the music mini-player uses is declared.
// Reference: https://developers.google.com/youtube/iframe_api_reference

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: number;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  interface PlayerVars {
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    fs?: 0 | 1;
    iv_load_policy?: 1 | 3;
    playsinline?: 0 | 1;
    origin?: string;
  }

  interface PlayerOptions {
    width?: number | string;
    height?: number | string;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: {
      onReady?: (e: PlayerEvent) => void;
      onStateChange?: (e: OnStateChangeEvent) => void;
      onError?: (e: OnErrorEvent) => void;
    };
  }

  class Player {
    constructor(el: HTMLElement | string, opts: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    loadVideoById(id: string, startSeconds?: number): void;
    cueVideoById(id: string, startSeconds?: number): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    getDuration(): number;
    setVolume(volume: number): void;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
