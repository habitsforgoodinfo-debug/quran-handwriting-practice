import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { LiveMatcher } from '../../src/compare/live-matcher.js';

const HARAKAT = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ'
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

test('matcher: silent madd alif auto-consumed in قَالَ', () => {
  const m = new LiveMatcher(buildSkeleton('قَالَ'));
  m.tryLetter('ق'); m.tryHarakat(HARAKAT.fatha);
  // Next expected is ل, not ا
  assert.equal(m.tryLetter('ا').accepted, false);
  assert.equal(m.tryLetter('ل').accepted, true);
});

test('matcher: shadda+vowel accepted in either order', () => {
  const m1 = new LiveMatcher(buildSkeleton('إِنَّا'));
  m1.tryLetter('ا'); m1.tryHarakat(HARAKAT.kasra);
  m1.tryLetter('ن'); m1.tryHarakat(HARAKAT.shadda); m1.tryHarakat(HARAKAT.fatha);
  assert.equal(m1.state.awaiting, 'done');

  const m2 = new LiveMatcher(buildSkeleton('إِنَّا'));
  m2.tryLetter('ا'); m2.tryHarakat(HARAKAT.kasra);
  m2.tryLetter('ن'); m2.tryHarakat(HARAKAT.fatha); m2.tryHarakat(HARAKAT.shadda);
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
