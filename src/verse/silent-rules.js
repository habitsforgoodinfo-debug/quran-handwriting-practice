const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

const ALIF = 'ا';
const ALIF_WASLA = 'ٱ';
const LAM = 'ل';

export function isSilentInWord(glyphs, index) {
  const g = glyphs[index];
  if (!g) return false;
  if (g.isSilent) return true;
  if (g.isMaddAlif) return true;

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
