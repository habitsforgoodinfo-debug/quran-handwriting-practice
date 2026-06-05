import { kvGet, kvPut } from './db.js';

const KEY = 'lastSession';

export async function getLastPosition() {
  const pos = (await kvGet(KEY)) ?? null;
  if (
    pos !== null &&
    Number.isInteger(pos.surah) &&
    Number.isInteger(pos.ayah) &&
    typeof pos.mode === 'string'
  ) {
    return pos;
  }
  return null;
}

export async function setLastPosition({ surah, ayah, mode }) {
  await kvPut(KEY, { surah, ayah, mode });
}
