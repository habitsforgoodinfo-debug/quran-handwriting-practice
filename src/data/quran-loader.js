let cache = null;
let inflight = null;

export async function loadQuran() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch('./assets/quran/quran-indopak.json');
    if (!res.ok) throw new Error(`Failed to load Quran data: ${res.status}`);
    cache = await res.json();
    return cache;
  })();
  return inflight;
}

export function getVerse(surah, ayah) {
  if (!cache) throw new Error('loadQuran() must be awaited before getVerse()');
  const s = cache[String(surah)];
  if (!s) throw new Error(`Surah ${surah} out of range`);
  const v = s.verses[String(ayah)];
  if (v == null) throw new Error(`Ayah ${surah}:${ayah} out of range`);
  return v;
}

export function _resetForTests() {
  cache = null;
  inflight = null;
}
