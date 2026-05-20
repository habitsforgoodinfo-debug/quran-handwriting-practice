let cache = null;
let inflight = null;

export async function loadWordMeanings() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('./assets/quran/word-meanings.json')
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
    .finally(() => { inflight = null; });
  cache = await inflight;
  return cache;
}

// Returns { m, role } for the current word, or null if not available.
export function getWordMeaning(surah, ayah, wordIdx) {
  if (!cache) return null;
  const key = `${surah}:${ayah}`;
  const arr = cache[key];
  if (!arr || !Array.isArray(arr)) return null;
  return arr[wordIdx] || null;
}
