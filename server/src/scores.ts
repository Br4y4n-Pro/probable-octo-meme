import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LeaderboardEntry } from '@battlenaval/shared';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'scores.json');

type ScoresMap = Record<string, number>;

let scores: ScoresMap = {};
let saveTimer: NodeJS.Timeout | null = null;
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(FILE)) {
      const raw = readFileSync(FILE, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const cleaned: ScoresMap = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            cleaned[k] = v;
          }
        }
        scores = cleaned;
        console.log(
          `[scores] loaded ${Object.keys(scores).length} entries from ${FILE}`,
        );
      }
    }
  } catch (err) {
    console.error('[scores] failed to load — starting fresh', err);
  }
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(FILE, JSON.stringify(scores, null, 2), 'utf8');
    } catch (err) {
      console.error('[scores] failed to save', err);
    }
  }, 500);
}

export function incrementWin(nickname: string): void {
  load();
  const key = nickname.trim();
  if (!key) return;
  scores[key] = (scores[key] ?? 0) + 1;
  scheduleSave();
}

export function getTop(limit = 50): LeaderboardEntry[] {
  load();
  return Object.entries(scores)
    .map(([nickname, wins]) => ({ nickname, wins }))
    .sort((a, b) => b.wins - a.wins || a.nickname.localeCompare(b.nickname))
    .slice(0, limit);
}

export function getTotalEntries(): number {
  load();
  return Object.keys(scores).length;
}

/** Force-flush the save timer. Useful before shutdown. */
export function flushScores(): void {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(scores, null, 2), 'utf8');
  } catch (err) {
    console.error('[scores] failed to flush', err);
  }
}
