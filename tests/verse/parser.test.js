import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWord, parseVerse } from '../../src/verse/parser.js';

test('parseWord: letter with fatha is user-required', () => {
  const w = parseWord('كَ');
  assert.deepEqual(w, [
    { letter: 'ك', diacritics: ['fatha'], isSilent: false, isMaddAlif: false }
  ]);
});

test('parseWord: bare letter has no diacritic and is silent', () => {
  const w = parseWord('ك');
  assert.equal(w.length, 1);
  assert.equal(w[0].isSilent, true);
  assert.equal(w[0].diacritics.length, 0);
  assert.equal(w[0].isMaddAlif, false);
});

test('parseWord: قَال - alif after fatha is madd, lam is silent', () => {
  const w = parseWord('قَال');
  assert.equal(w.length, 3);
  assert.equal(w[0].letter, 'ق');
  assert.deepEqual(w[0].diacritics, ['fatha']);
  assert.equal(w[0].isSilent, false);
  assert.equal(w[1].letter, 'ا');
  assert.equal(w[1].isMaddAlif, true);
  assert.equal(w[1].isSilent, false);
  assert.equal(w[2].letter, 'ل');
  assert.equal(w[2].isSilent, true);
  assert.equal(w[2].isMaddAlif, false);
});

test('parseWord: قُال - alif after damma is NOT madd and is silent', () => {
  const w = parseWord('قُال');
  assert.equal(w.length, 3);
  assert.deepEqual(w[0].diacritics, ['damma']);
  assert.equal(w[1].letter, 'ا');
  assert.equal(w[1].isMaddAlif, false);
  assert.equal(w[1].isSilent, true);
});

test('parseWord: shadda + fatha on same letter both captured', () => {
  const w = parseWord('بَّ');
  assert.equal(w.length, 1);
  assert.equal(w[0].letter, 'ب');
  assert.deepEqual(
    w[0].diacritics.slice().sort(),
    ['fatha', 'shadda'].sort()
  );
  assert.equal(w[0].isSilent, false);
});

test('parseWord: tanween damm', () => {
  const w = parseWord('بٌ');
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].diacritics, ['tanween_damm']);
  assert.equal(w[0].isSilent, false);
});

test('parseWord: sukun', () => {
  const w = parseWord('بْ');
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].diacritics, ['sukun']);
  assert.equal(w[0].isSilent, false);
});

test('parseWord: Quranic pause mark U+06D6 is recognized as a diacritic on its base', () => {
  const w = parseWord('بۖ');
  assert.equal(w.length, 1);
  assert.equal(w[0].letter, 'ب');
  assert.deepEqual(w[0].diacritics, ['high_ligature_sad_lam']);
  assert.equal(w[0].isSilent, false);
});

test('parseVerse: bismillah short form → 2 words', () => {
  const v = parseVerse('بِسْمِ اللّٰهِ');
  assert.equal(v.length, 2);
});

test('parseVerse: trims and collapses whitespace → 2 words', () => {
  const v = parseVerse('  كَ   بَ  ');
  assert.equal(v.length, 2);
});

test('parseVerse: full bismillah → 4 words; first word ب س م all non-silent', () => {
  const v = parseVerse('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
  assert.equal(v.length, 4);
  const first = v[0];
  assert.equal(first.length, 3);
  assert.equal(first[0].letter, 'ب');
  assert.equal(first[1].letter, 'س');
  assert.equal(first[2].letter, 'م');
  assert.equal(first[0].isSilent, false);
  assert.equal(first[1].isSilent, false);
  assert.equal(first[2].isSilent, false);
});

test('parseWord: قُلْ → qaf+damma, lam+sukun, both non-silent', () => {
  const w = parseWord('قُلْ');
  assert.equal(w.length, 2);
  assert.equal(w[0].letter, 'ق');
  assert.deepEqual(w[0].diacritics, ['damma']);
  assert.equal(w[0].isSilent, false);
  assert.equal(w[1].letter, 'ل');
  assert.deepEqual(w[1].diacritics, ['sukun']);
  assert.equal(w[1].isSilent, false);
});

test("parseWord: alif-with-madda 'آ' is a single base letter, silent when bare", () => {
  const w = parseWord('آ');
  assert.equal(w.length, 1);
  assert.equal(w[0].letter, 'آ');
  assert.equal(w[0].isSilent, true);
  assert.equal(w[0].isMaddAlif, false);
});

test("parseWord: alif wasla 'ٱ' is a single base letter, silent when bare", () => {
  const w = parseWord('ٱ');
  assert.equal(w.length, 1);
  assert.equal(w[0].letter, 'ٱ');
  assert.equal(w[0].isSilent, true);
});

test('parseWord: letter with only dagger_alif is non-silent (mark carries elongation sound)', () => {
  // ل + dagger_alif → user must write the lam (mark gives it audible elongation)
  const w = parseWord('لٰ');
  assert.equal(w.length, 1);
  assert.equal(w[0].letter, 'ل');
  assert.deepEqual(w[0].diacritics, ['dagger_alif']);
  assert.equal(w[0].isSilent, false);
});

test('parseWord: consecutive bare alifs each get their own glyph, all silent', () => {
  const w = parseWord('ااا');
  assert.equal(w.length, 3);
  for (const g of w) {
    assert.equal(g.letter, 'ا');
    assert.equal(g.isSilent, true);
    assert.equal(g.isMaddAlif, false);
  }
});

test('parseWord: hamza variants are passthrough base letters', () => {
  for (const ch of ['ء','أ','إ','ؤ','ئ']) {
    const w = parseWord(ch);
    assert.equal(w.length, 1);
    assert.equal(w[0].letter, ch);
    assert.equal(w[0].isSilent, true);
  }
});
