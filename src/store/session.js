import { kvGet, kvPut } from './db.js';

const KEY = 'lastSession';

export async function getLastPosition() {
  return (await kvGet(KEY)) ?? null;
}

export async function setLastPosition({ surah, ayah, mode }) {
  await kvPut(KEY, { surah, ayah, mode });
}
