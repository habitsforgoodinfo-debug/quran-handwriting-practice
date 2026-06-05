import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { LiveMatcher } from '../../src/compare/live-matcher.js';

const HARAKAT = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ'
};

test('matcher: rejects wrong letter, no state change', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  const beforeIdx = m.state.slotIdx;
  const r = m.tryLetter('ك');
  assert.equal(r.accepted, false);
  assert.equal(m.state.slotIdx, beforeIdx);
  assert.equal(m.state.awaiting, 'letter');
});

test('matcher: accepts correct letter, moves to harakat', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  const r = m.tryLetter('ق');
  assert.equal(r.accepted, true);
  assert.equal(m.state.awaiting, 'harakat');
});

test('matcher: rejects wrong harakat', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق');
  const r = m.tryHarakat(HARAKAT.fatha);
  assert.equal(r.accepted, false);
  assert.equal(m.state.awaiting, 'harakat');
});

test('matcher: full word قُلْ completes', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.tryLetter('ق').accepted, true);
  assert.equal(m.tryHarakat(HARAKAT.damma).accepted, true);
  assert.equal(m.tryLetter('ل').accepted, true);
  const last = m.tryHarakat(HARAKAT.sukun);
  assert.equal(last.accepted, true);
  assert.equal(last.complete, true);
  assert.equal(m.state.awaiting, 'done');
});

test('matcher: madd alif in قَالَ is typed (not auto-consumed)', () => {
  const m = new LiveMatcher(buildSkeleton('قَالَ'));
  m.tryLetter('ق'); m.tryHarakat(HARAKAT.fatha);
  // Next expected is ا (madd alif), then ل
  assert.equal(m.tryLetter('ل').accepted, false);
  assert.equal(m.tryLetter('ا').accepted, true);
  assert.equal(m.tryLetter('ل').accepted, true);
  m.tryHarakat(HARAKAT.fatha);
  assert.equal(m.state.awaiting, 'done');
});

test('matcher: shadda+vowel accepted in either order - إِنَّا includes terminal madd alif', () => {
  const m1 = new LiveMatcher(buildSkeleton('إِنَّا'));
  m1.tryLetter('ا'); m1.tryHarakat(HARAKAT.kasra);
  m1.tryLetter('ن'); m1.tryHarakat(HARAKAT.shadda); m1.tryHarakat(HARAKAT.fatha);
  m1.tryLetter('ا'); // typed madd alif
  assert.equal(m1.state.awaiting, 'done');

  const m2 = new LiveMatcher(buildSkeleton('إِنَّا'));
  m2.tryLetter('ا'); m2.tryHarakat(HARAKAT.kasra);
  m2.tryLetter('ن'); m2.tryHarakat(HARAKAT.fatha); m2.tryHarakat(HARAKAT.shadda);
  m2.tryLetter('ا');
  assert.equal(m2.state.awaiting, 'done');
});

test('matcher: tolerance accepts ت for expected ة', () => {
  // "ة" alone: parseVerse strips it, parseWord makes a single glyph ة, no harakat → sound slot expectedHarakat.none
  const m = new LiveMatcher(buildSkeleton('ة'), { strict: false });
  assert.equal(m.tryLetter('ت').accepted, true);
});

test('matcher: strict mode disables tolerance', () => {
  const m = new LiveMatcher(buildSkeleton('ة'), { strict: true });
  assert.equal(m.tryLetter('ت').accepted, false);
});

test('matcher: backspace returns to letter-awaiting state', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق'); m.tryHarakat(HARAKAT.damma);
  m.tryLetter('ل');
  m.backspace();
  assert.equal(m.state.awaiting, 'letter');
});

test('matcher: nextHint reflects awaiting state', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.nextHint().letter, 'ق');
  m.tryLetter('ق');
  assert.equal(m.nextHint().harakat, HARAKAT.damma);
});

test('matcher: shadda + dagger_alif required, any order seals - reverse order', () => {
  // Minimal fake skeleton: one sound slot with two required marks.
  const fake = [
    { kind: 'sound', letter: 'ل', expectedHarakat: { required: ['shadda', 'dagger_alif'] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  assert.equal(m.tryLetter('ل').accepted, true);
  assert.equal(m.tryHarakat('ٰ').accepted, true);
  const sealed = m.tryHarakat('ّ');
  assert.equal(sealed.accepted, true);
  assert.equal(m.state.awaiting, 'done');
});

test('matcher: shadda + dagger_alif required, forward order seals', () => {
  const fake = [
    { kind: 'sound', letter: 'ل', expectedHarakat: { required: ['shadda', 'dagger_alif'] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  m.tryLetter('ل');
  assert.equal(m.tryHarakat('ّ').accepted, true);
  assert.equal(m.tryHarakat('ٰ').accepted, true);
  assert.equal(m.state.awaiting, 'done');
});

test('matcher: rejectCount increments on wrong letter, resets on correct', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.state.rejectCount, 0);
  m.tryLetter('ك');
  assert.equal(m.state.rejectCount, 1);
  m.tryLetter('ت');
  assert.equal(m.state.rejectCount, 2);
  m.tryLetter('ق');
  assert.equal(m.state.rejectCount, 0);
});

test('matcher: rejectCount also tracks wrong harakat', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق');
  assert.equal(m.state.rejectCount, 0);
  m.tryHarakat('َ'); // wrong (expects damma)
  assert.equal(m.state.rejectCount, 1);
  m.tryHarakat('ُ'); // correct
  assert.equal(m.state.rejectCount, 0);
});

test('matcher: waqf-eligible slot accepts sukun in place of canonical vowel', () => {
  const sk = buildSkeleton('قُلْ هُوَ');
  const m = new LiveMatcher(sk);
  m.tryLetter('ق'); m.tryHarakat('ُ');
  m.tryLetter('ل'); m.tryHarakat('ْ');
  m.tryLetter('ه'); m.tryHarakat('ُ');
  m.tryLetter('و');
  const r = m.tryHarakat('ْ'); // sukun instead of canonical fatha
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});

test('matcher: non-waqf slot rejects sukun when canonical is not sukun', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ هُوَ'));
  m.tryLetter('ق');
  const r = m.tryHarakat('ْ'); // canonical for ق is damma; not last sound
  assert.equal(r.accepted, false);
});

test('matcher: waqf-eligible tanween_fath slot accepts bare fatha', () => {
  const fake = [
    { kind: 'sound', letter: 'ا', expectedHarakat: { required: ['tanween_fath'] }, wordIdx: 0, canonicalIdx: 0, acceptWaqf: true },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  assert.equal(m.tryLetter('ا').accepted, true);
  const r = m.tryHarakat('َ');
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});

test('matcher: wrong-mode keystroke also increments rejectCount (letter when awaiting harakat)', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.tryLetter('ق').accepted, true);
  // awaiting harakat now - press a letter key
  const r = m.tryLetter('ل');
  assert.equal(r.accepted, false);
  assert.equal(m.state.rejectCount, 1);
});

test('matcher: wrong-mode keystroke also increments rejectCount (harakat when awaiting letter)', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  // awaiting letter - press a harakat
  const r = m.tryHarakat('َ');
  assert.equal(r.accepted, false);
  assert.equal(m.state.rejectCount, 1);
});

test('matcher: Indo-Pak sukun (ۡ) is accepted as sukun input', () => {
  const fake = [
    { kind: 'sound', letter: 'ق', expectedHarakat: { required: ['sukun'] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  m.tryLetter('ق');
  const r = m.tryHarakat('ۡ');
  assert.equal(r.accepted, true);
});

test('matcher: long-kasra ٖ accepted as subscript_alef', () => {
  const fake = [
    { kind: 'sound', letter: 'ا', expectedHarakat: { required: ['subscript_alef'] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  m.tryLetter('ا');
  const r = m.tryHarakat('ٖ');
  assert.equal(r.accepted, true);
});

test('matcher: long-damma ٗ accepted as inverted_damma', () => {
  const fake = [
    { kind: 'sound', letter: 'ق', expectedHarakat: { required: ['inverted_damma'] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  m.tryLetter('ق');
  const r = m.tryHarakat('ٗ');
  assert.equal(r.accepted, true);
});

test('matcher: requiredLetters auto-fills non-required letters with their harakat', () => {
  // قُلْ - if ق is NOT in requiredLetters, the matcher should auto-consume
  // it (with damma) and start awaiting the next slot (ل).
  const m = new LiveMatcher(buildSkeleton('قُلْ'), { requiredLetters: ['ل'] });
  const qaf = m.state.typed[0];
  assert.equal(qaf.letter, 'ق');
  assert.equal(qaf.auto, true);
  // Auto-filled sukun uses the jazm glyph (canonical char in HARAKAT_CHAR).
  assert.equal(qaf.harakat, HARAKAT.damma);
  assert.equal(m.state.awaiting, 'letter');
  assert.equal(m.tryLetter('ل').accepted, true);
});

test('matcher: null requiredLetters means every letter is required', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.state.typed.length, 0);
  assert.equal(m.tryLetter('ق').accepted, true);
});

test('matcher: requiredHarakat auto-attaches non-required harakat to user-typed letter', () => {
  // قُلْ with only "sukun" user-required → damma on ق auto-attaches.
  const m = new LiveMatcher(buildSkeleton('قُلْ'), { requiredHarakat: ['sukun'] });
  const r1 = m.tryLetter('ق');
  assert.equal(r1.accepted, true);
  const qaf = m.state.typed.find(t => t.letter === 'ق');
  assert.equal(qaf.harakat, HARAKAT.damma);
  assert.equal(m.state.awaiting, 'letter');
  assert.equal(m.tryLetter('ل').accepted, true);
  assert.equal(m.state.awaiting, 'harakat');
  assert.equal(m.tryHarakat(HARAKAT.sukun).complete, true);
});

test('matcher: jazm (ۡ) accepted in place of Uthmani sukun', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق'); m.tryHarakat(HARAKAT.damma);
  m.tryLetter('ل');
  const r = m.tryHarakat('ۡ');
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});
