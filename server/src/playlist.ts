// Parsing helper for the shared music playlist feature.

/** A YouTube video id is exactly 11 URL-safe base64 characters. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract a YouTube video id from a pasted URL (or a bare id).
 * Accepts the common forms: youtube.com/watch?v=, youtu.be/, /embed/,
 * /shorts/, /v/, plus the m. and music. subdomains. Returns null for anything
 * that doesn't yield a valid 11-char id.
 */
export function parseYouTubeId(input: string): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 200) return null;

  // Bare video id pasted directly.
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com'
  ) {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID_RE.test(v)) return v;
    const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([^/?]+)/);
    if (m && m[1] && VIDEO_ID_RE.test(m[1])) return m[1];
  }
  return null;
}
