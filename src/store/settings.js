import { kvGet, kvPut } from './db.js';

export const DEFAULT_SETTINGS = Object.freeze({
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4
});

export async function getSettings(deps = { kvGet, kvPut }) {
  const stored = await deps.kvGet('settings');
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function updateSettings(patch, deps = { kvGet, kvPut }) {
  const current = await getSettings(deps);
  const next = { ...current, ...patch };
  await deps.kvPut('settings', next);
  return next;
}
