let cache = null;
let inflight = null;
let activeScript = null;

const PATHS = {
  indopak: './assets/quran/quran-indopak.json',
  uthmani: './assets/quran/quran-uthmani.json'
};

export async function loadQuran(script = 'indopak') {
  if (cache && activeScript === script) return cache;
  if (inflight && activeScript === script) return inflight;
  cache = null;
  activeScript = script;
  inflight = (async () => {
    const res = await fetch(PATHS[script] || PATHS.indopak);
    if (!res.ok) throw new Error(`Failed to load Quran data: ${res.status}`);
    cache = await res.json();
    return cache;
  })().finally(() => { inflight = null; });
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
  activeScript = null;
}
