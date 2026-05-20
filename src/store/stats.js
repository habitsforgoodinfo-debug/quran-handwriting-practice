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

export async function recordAttempt({ correct } = { correct: true },
                                    deps = { kvGet, kvPut }) {
  const cur = (await deps.kvGet('accCounters')) || { hits: 0, attempts: 0 };
  cur.attempts++;
  if (correct) cur.hits++;
  await deps.kvPut('accCounters', cur);
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
