// Curated confusable groups — similar-sounding or visually similar Arabic letters.
const CONFUSABLES = {
  'ا': ['أ','إ','آ','ٱ','ى'],
  'أ': ['ا','إ','آ','ٱ'],
  'إ': ['ا','أ','آ','ٱ'],
  'آ': ['ا','أ','إ','ٱ'],
  'ٱ': ['ا','أ','إ','آ'],
  'ى': ['ا','ي'],
  'ب': ['ت','ث','ن','ي'],
  'ت': ['ب','ث','ن','ط'],
  'ث': ['ب','ت','س','ش'],
  'ج': ['ح','خ','ز'],
  'ح': ['ج','خ','ه'],
  'خ': ['ج','ح','ه'],
  'د': ['ذ','ض'],
  'ذ': ['د','ز','ظ'],
  'ر': ['ز'],
  'ز': ['ر','ذ','ظ','ج'],
  'س': ['ش','ص','ث'],
  'ش': ['س','ص','ث'],
  'ص': ['س','ش','ض'],
  'ض': ['ص','د','ظ'],
  'ط': ['ت','ظ'],
  'ظ': ['ط','ض','ز','ذ'],
  'ع': ['غ','ا'],
  'غ': ['ع'],
  'ف': ['ق'],
  'ق': ['ف','ك'],
  'ك': ['ق'],
  'ل': [],
  'م': [],
  'ن': ['ب','ت','ث','ي'],
  'ه': ['ح','خ','ة'],
  'ة': ['ه','ت'],
  'و': ['ؤ'],
  'ؤ': ['و'],
  'ي': ['ى','ئ','ب','ت','ن'],
  'ئ': ['ي','ى']
};

// Canonical Arabic letter order for keypad layout (28 base letters + common variants).
const CANONICAL_ORDER = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي',
  'ى','ة','أ','إ','آ','ٱ','ؤ','ئ','ء'
];

export function computeKeypadLetters(parsedVerses) {
  const needed = new Set();
  for (const verse of parsedVerses) {
    for (const word of verse) {
      for (const g of word) {
        if (!g.isSilent) needed.add(g.letter);
      }
    }
  }
  const expanded = new Set(needed);
  for (const ch of needed) {
    for (const c of (CONFUSABLES[ch] || [])) expanded.add(c);
  }
  return CANONICAL_ORDER.filter(c => expanded.has(c)).concat(
    [...expanded].filter(c => !CANONICAL_ORDER.includes(c))
  );
}
