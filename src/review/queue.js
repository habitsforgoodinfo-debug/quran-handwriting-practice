// Pure helpers for the dictated "quick review test" of mistake verses.
// Kept side-effect-free so they can be unit-tested without a DOM.

// Sort a list of mistake verses ascending by (surah, ayah). Returns a new
// array; input is not mutated. Entries are expected to be
// { surah, ayah, rawText } but only surah/ayah are read for ordering.
export function sortQueue(verses) {
  return [...(verses || [])].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

// Progress label shown on the canvas position strip during review, e.g.
//   "Review 2 of 5 · Al-Fatiha · 3"
// attempted: how many verses the user has attempted so far (1-based as they
//   land on each verse); total: queue length; surahName/ayah: current verse.
export function reviewLabel({ attempted, total, surahName, ayah }) {
  const head = `Review ${attempted} of ${total}`;
  const tail = [surahName, ayah].filter(v => v != null && v !== '').join(' · ');
  return tail ? `${head} · ${tail}` : head;
}
