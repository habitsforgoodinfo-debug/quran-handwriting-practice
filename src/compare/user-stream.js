// Parse user input into a stream that preserves spaces and renders verbatim.
// Each item is either { kind: 'space', raw } or
// { kind: 'letter', letter, diacritics: [names], diacriticChars: [chars] }.
import { isCombiningMark, _diacriticMapForUserStream } from '../verse/parser.js';

function lookupDiacriticName(ch) {
  return _diacriticMapForUserStream[ch];
}

export function parseUserStream(text) {
  const cps = Array.from(text);
  const items = [];
  let i = 0;
  while (i < cps.length) {
    const ch = cps[i];
    if (/\s/.test(ch)) { items.push({ kind: 'space', raw: ch }); i++; continue; }
    if (isCombiningMark(ch)) { i++; continue; } // stray combining mark with no base
    const item = { kind: 'letter', letter: ch, diacritics: [], diacriticChars: [] };
    i++;
    while (i < cps.length && isCombiningMark(cps[i])) {
      item.diacriticChars.push(cps[i]);
      const name = lookupDiacriticName(cps[i]);
      if (name) item.diacritics.push(name);
      i++;
    }
    items.push(item);
  }
  return items;
}
