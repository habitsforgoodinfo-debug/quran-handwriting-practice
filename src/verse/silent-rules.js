const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

const ALIF = 'ا';
const ALIF_WASLA = 'ٱ';
const LAM = 'ل';

export function isSilentInWord(glyphs, index) {
  const g = glyphs[index];
  if (!g) return false;
  // Indo-Pak silent-letter marker (U+06DF ۟ / U+06E0 ۠). When the
  // canonical text places this small high zero above a letter, the
  // letter is silent in recitation - auto-consume it.
  if (g.diacritics.includes('small_high_rounded_zero')
      || g.diacritics.includes('high_upright_rectangular_zero')) {
    return true;
  }
  // Madd alif (alif elongating a preceding fatha) is normally TYPED by the
  // user. Exception: if the letter immediately following the alif carries a
  // sukun or a shadda, the alif is not elongated in recitation and the user
  // should NOT have to type it.
  if (g.isMaddAlif) {
    // Walk forward past any silent letters (definite-article lam, etc.)
    // to find the first sounded follow-up. If THAT letter carries a sukun
    // or shadda, the alif's elongation is dropped in recitation, so the
    // user shouldn't have to type it.
    let j = index + 1;
    while (j < glyphs.length && glyphs[j].isSilent) j++;
    const target = glyphs[j];
    if (target && (target.diacritics.includes('sukun') || target.diacritics.includes('shadda'))) {
      return true;
    }
    return false;
  }
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
