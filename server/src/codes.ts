import { randomBytes } from 'node:crypto';

// Characters chosen for visual clarity over the phone:
// Letters: skip I, L, O (look like 1/0).
// Digits: skip 0, 1.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function pickRandom(s: string): string {
  const idx = Math.floor(Math.random() * s.length);
  return s.charAt(idx);
}

/**
 * Generate a memorable room code like "XKQ-738". Retries on collision.
 * `taken` returns true if a code is already in use; this function asks until
 * it finds a free one or gives up after 50 attempts.
 */
export function generateRoomCode(taken: (code: string) => boolean): string {
  for (let i = 0; i < 50; i++) {
    let code = '';
    for (let j = 0; j < 3; j++) code += pickRandom(LETTERS);
    code += '-';
    for (let j = 0; j < 3; j++) code += pickRandom(DIGITS);
    if (!taken(code)) return code;
  }
  throw new Error('Could not generate a unique room code after 50 attempts');
}

/** Cryptographic session token used to authenticate reconnects. */
export function generateSessionToken(): string {
  return randomBytes(16).toString('hex');
}
