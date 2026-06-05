const CLASSES = [
  new Set(['ت','ة']),
  new Set(['ا','أ','إ','آ','ٱ']),
  // Arabic yeh (ي), Persian/Urdu yeh (ی U+06CC), alif maqsura (ى)
  // The Tarteel Indo-Pak Mushaf uses ی throughout.
  new Set(['ي','ى','ی']),
  new Set(['ه','ة']),
  // Hamza family: keypad offers only standalone ء (U+0621); ئ (U+0626) and
  // ؤ (U+0624) are positional hamza carriers not present as separate keys.
  new Set(['ء','ئ','ؤ'])
];

export function lettersEquivalent(a, b, { strict = false } = {}) {
  if (a === b) return true;
  if (strict) return false;
  for (const cls of CLASSES) if (cls.has(a) && cls.has(b)) return true;
  return false;
}
