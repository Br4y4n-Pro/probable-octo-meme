// Loader + helpers for the YouTube IFrame Player API.
// The API script is global (no npm package) and must only be injected once.

let apiPromise: Promise<void> | null = null;

/**
 * Inject the YouTube IFrame API script (once) and resolve when `window.YT`
 * is ready to construct players. Safe to call repeatedly.
 */
export function loadYouTubeApi(): Promise<void> {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * Best-effort fetch of a video's title via YouTube's public oEmbed endpoint.
 * Returns null on any failure (CORS, network, removed video) — the caller
 * falls back to showing the raw video id.
 */
export async function fetchYouTubeTitle(
  videoId: string,
): Promise<string | null> {
  try {
    const url =
      'https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent(`https://youtu.be/${videoId}`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === 'string' ? data.title : null;
  } catch {
    return null;
  }
}
