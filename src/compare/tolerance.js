const CLASSES = [
  new Set(['ت','ة']),
  new Set(['ا','أ','إ','آ','ٱ']),
  new Set(['ي','ى']),
  new Set(['ه','ة'])
];

export function lettersEquivalent(a, b, { strict = false } = {}) {
  if (a === b) return true;
  if (strict) return false;
  for (const cls of CLASSES) if (cls.has(a) && cls.has(b)) return true;
  return false;
}
