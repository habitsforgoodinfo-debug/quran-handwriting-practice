const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

const ALIF = 'ا';
const ALIF_WASLA = 'ٱ';
const LAM = 'ل';

export function isSilentInWord(glyphs, index) {
  const g = glyphs[index];
  if (!g) return false;
  // The madd alif (alif elongating a preceding fatha, e.g. قَالَ) is NOT
  // silent — the user must type it. Its skeleton slot stays `sound` with
  // hasNone=true and seals on the letter alone.
  if (g.isMaddAlif) return false;
  if (g.isSilent) return true;

  if (index === 1
      && g.letter === LAM
      && (glyphs[0]?.letter === ALIF || glyphs[0]?.letter === ALIF_WASLA)
      && glyphs[2]
      && SUN_LETTERS.has(glyphs[2].letter)
      && glyphs[2].diacritics.includes('shadda')) {
    return true;
  }

  return false;
}

const VOWEL_DIACRITICS = new Set([
  'fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm'
]);

// At the start of an utterance, an alif-wasla (ٱ) or a bare alif (ا)
// of the definite article is pronounced as fatha (hamzatul-wasl rule).
// Returns the vowel name to require, or null if no override.
export function firstSoundOverride(glyphs, index, isVerseStart) {
  if (!isVerseStart || index !== 0) return null;
  const g = glyphs[0];
  if (!g) return null;
  if (g.letter !== 'ا' && g.letter !== 'ٱ') return null;
  const hasVowel = g.diacritics.some(d => VOWEL_DIACRITICS.has(d));
  if (hasVowel) return null;
  return 'fatha';
}
