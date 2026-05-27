import {
  counterIncrement, counterAll, counterClear,
  kvGet, kvPut,
  verseStorePut, verseStoreGetAll, verseStoreClear
} from './db.js';

const TOTAL_QURAN_VERSES = 6236;

export async function recordError({ kind, value }, deps = { counterIncrement }) {
  let store;
  if (kind === 'letter') store = 'letterErrors';
  else if (kind === 'diacritic') store = 'diacriticErrors';
  else throw new Error(`recordError: unknown kind "${kind}"`);
  await deps.counterIncrement(store, value);
}

export async function recordAttempt({ correct, surah } = { correct: true },
                                    deps = { kvGet, kvPut }) {
  // Overall counter (kept for backwards compatibility).
  const overall = (await deps.kvGet('accCounters')) || { hits: 0, attempts: 0 };
  overall.attempts++;
  if (correct) overall.hits++;
  await deps.kvPut('accCounters', overall);

  // Per-surah counter, used by the header banner + surah-dropdown badges.
  if (surah != null) {
    const map = (await deps.kvGet('accBySurah')) || {};
    const key = String(surah);
    const entry = map[key] || { hits: 0, attempts: 0 };
    entry.attempts++;
    if (correct) entry.hits++;
    map[key] = entry;
    await deps.kvPut('accBySurah', map);
  }
}

export async function getAccuracy(deps = { kvGet }) {
  const cur = (await deps.kvGet('accCounters')) || { hits: 0, attempts: 0 };
  if (cur.attempts === 0) return { hits: 0, attempts: 0, percent: null };
  return {
    hits: cur.hits,
    attempts: cur.attempts,
    percent: Math.round((cur.hits / cur.attempts) * 100)
  };
}

export async function getSurahAccuracy(surah, deps = { kvGet }) {
  const map = (await deps.kvGet('accBySurah')) || {};
  const e = map[String(surah)] || { hits: 0, attempts: 0 };
  if (e.attempts === 0) return { hits: 0, attempts: 0, percent: null };
  return { hits: e.hits, attempts: e.attempts,
    percent: Math.round((e.hits / e.attempts) * 100) };
}

export async function getAllSurahAccuracy(deps = { kvGet }) {
  return (await deps.kvGet('accBySurah')) || {};
}

export async function getSurahProgress(surah, deps = { verseStoreGetAll }) {
  const rows = await deps.verseStoreGetAll();
  let written = 0;
  for (const r of rows) {
    const v = r.value;
    if (!v || v.skipped) continue;
    if (v.surah === surah) written++;
  }
  return written;
}

export async function getStats(deps = { counterAll }) {
  const [letterErrors, diacriticErrors] = await Promise.all([
    deps.counterAll('letterErrors'),
    deps.counterAll('diacriticErrors')
  ]);
  return { letterErrors, diacriticErrors };
}

export async function resetStats(deps = {
  counterClear, kvPut, verseStoreClear
}) {
  await Promise.all([
    deps.counterClear('letterErrors'),
    deps.counterClear('diacriticErrors'),
    deps.kvPut('accCounters', { hits: 0, attempts: 0 }),
    deps.kvPut('accBySurah', {}),
    deps.verseStoreClear()
  ]);
}

export async function getWorst(n, deps = { counterAll }) {
  const [letters, dias] = await Promise.all([
    deps.counterAll('letterErrors'),
    deps.counterAll('diacriticErrors')
  ]);
  const items = [
    ...Object.entries(letters).map(([value, count]) => ({ kind: 'letter', value, count })),
    ...Object.entries(dias).map(([value, count]) => ({ kind: 'diacritic', value, count }))
  ];
  items.sort((a, b) => b.count - a.count);
  return items.slice(0, n);
}

export async function markVerseComplete({ surah, ayah, rawText, perfect },
                                        deps = { verseStorePut }) {
  const key = `${surah}:${ayah}`;
  await deps.verseStorePut(key, {
    surah, ayah, rawText,
    perfect: !!perfect,
    skipped: false,
    completedAt: Date.now()
  });
}

export async function markVerseSkipped({ surah, ayah, rawText },
                                       deps = { verseStorePut, verseStoreGetAll }) {
  const key = `${surah}:${ayah}`;
  // Don't overwrite an already-completed entry with a skip.
  const existing = await deps.verseStoreGetAll();
  if (existing.some(r => r.key === key && r.value && !r.value.skipped)) return;
  await deps.verseStorePut(key, {
    surah, ayah, rawText,
    perfect: false,
    skipped: true,
    completedAt: Date.now()
  });
}

export async function getCompletedVerses(deps = { verseStoreGetAll }) {
  const rows = await deps.verseStoreGetAll();
  return rows.map(r => r.value).sort((a, b) =>
    a.surah - b.surah || a.ayah - b.ayah
  );
}

export async function getCoverage(deps = { verseStoreGetAll }) {
  const rows = await deps.verseStoreGetAll();
  const versesWritten = rows.length;
  return {
    versesWritten,
    totalVerses: TOTAL_QURAN_VERSES,
    percent: versesWritten === 0 ? 0
      : Math.max(0.01, +(versesWritten * 100 / TOTAL_QURAN_VERSES).toFixed(2))
  };
}
