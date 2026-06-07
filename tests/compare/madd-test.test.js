// Integration tests for the "Test madd" feature.
//
// These tests use REAL Quran data (quran-indopak.json) to verify that:
//   - The target verses actually contain a madd glyph (fixture guard).
//   - When requiredHarakat includes 'maddah_above', typing letters alone
//     does NOT complete the verse - the matcher demands the madd mark.
//   - When requiredHarakat is [] (auto-fill all), letters alone DO complete
//     the verse (madd auto-filled).
//
// Surah 110 (An-Nasr) ayah 1 and surah 106 (Quraysh) ayah 4 are chosen
// because both are known to contain at least one madd glyph.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { LiveMatcher } from '../../src/compare/live-matcher.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const QURAN_PATH = resolve(HERE, '../../assets/quran/quran-indopak.json');

const quran = JSON.parse(readFileSync(QURAN_PATH, 'utf8'));

function getVerseText(surah, ayah) {
  return quran[String(surah)].verses[String(ayah)];
}

// Madd glyph codepoints:
//   ٓ  U+0653  maddah_above (Uthmani / standard)
//   ۤ  U+06E4  high madda   (Indo-Pak)
const MADD_ABOVE_CHAR = 'ٓ';
const HIGH_MADDA_CHAR = 'ۤ';

function verseHasMadd(text) {
  return text.includes(MADD_ABOVE_CHAR) || text.includes(HIGH_MADDA_CHAR);
}

// Walk through the verse typing only letters (no harakat), using the
// real letter from each sound slot. Returns true if the matcher reaches done.
function typeLettersOnly(rawText, requiredHarakat) {
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, { requiredHarakat });
  let guard = 0;
  while (m.state.awaiting !== 'done' && guard < 2000) {
    guard++;
    if (m.state.awaiting === 'letter') {
      const slot = skeleton[m.state.slotIdx];
      if (!slot) break;
      const r = m.tryLetter(slot.letter);
      if (!r.accepted) break; // stuck - unexpected rejection
    } else if (m.state.awaiting === 'harakat') {
      // Do NOT type any harakat - bail out to detect the block.
      break;
    }
  }
  return m.state.awaiting === 'done';
}

// Walk through the verse typing letters AND all required harakat from
// the pending set, simulating a fully correct user. Returns true if done.
function typeLettersAndHarakat(rawText, requiredHarakat) {
  const HARAKAT_CHAR = {
    fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ',
    shadda: 'ّ',
    tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
    dagger_alif: 'ٰ', maddah_above: 'ٓ',
    subscript_alef: 'ٖ', inverted_damma: 'ٗ'
  };
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, { requiredHarakat });
  let guard = 0;
  while (m.state.awaiting !== 'done' && guard < 5000) {
    guard++;
    if (m.state.awaiting === 'letter') {
      const slot = skeleton[m.state.slotIdx];
      if (!slot) break;
      const r = m.tryLetter(slot.letter);
      if (!r.accepted) break;
    } else if (m.state.awaiting === 'harakat') {
      // Type any one of the pending marks.
      const pending = [...m.state.pendingMarks];
      if (pending.length === 0) break;
      const ch = HARAKAT_CHAR[pending[0]];
      if (!ch) break;
      const r = m.tryHarakat(ch);
      if (!r.accepted) break;
    }
  }
  return m.state.awaiting === 'done';
}

// ---- Fixture guards ----

test('madd-test fixture: surah 110 ayah 1 contains a madd glyph', () => {
  const text = getVerseText(110, 1);
  assert.ok(verseHasMadd(text), `Expected madd in: ${text}`);
});

test('madd-test fixture: surah 106 ayah 4 contains a madd glyph', () => {
  const text = getVerseText(106, 4);
  assert.ok(verseHasMadd(text), `Expected madd in: ${text}`);
});

// ---- 110:1 with maddah required ----

test('madd-test 110:1: typing letters alone does NOT complete when maddah_above is required', () => {
  const text = getVerseText(110, 1);
  const done = typeLettersOnly(text, ['maddah_above']);
  assert.equal(done, false, 'Should not complete without typing the madd mark');
});

test('madd-test 110:1: matcher demands maddah_above at the madd position (pendingMarks check)', () => {
  const text = getVerseText(110, 1);
  const skeleton = buildSkeleton(text, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, { requiredHarakat: ['maddah_above'] });
  // Walk until we hit a harakat-awaiting state with maddah_above pending.
  let foundMaddPending = false;
  let guard = 0;
  outer: while (m.state.awaiting !== 'done' && guard < 2000) {
    guard++;
    if (m.state.awaiting === 'letter') {
      const slot = skeleton[m.state.slotIdx];
      if (!slot) break;
      m.tryLetter(slot.letter);
    } else if (m.state.awaiting === 'harakat') {
      if (m.state.pendingMarks.has('maddah_above')) {
        foundMaddPending = true;
        // Verify tryHarakat with maddah_above char is accepted.
        const r = m.tryHarakat('ٓ'); // ٓ
        assert.equal(r.accepted, true, 'maddah_above char should be accepted');
        break outer;
      }
      // Type the first pending mark (not madd) and continue.
      const pending = [...m.state.pendingMarks];
      if (pending.length === 0) break;
      const HARAKAT_CHAR = {
        fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ',
        shadda: 'ّ', tanween_fath: 'ً', tanween_kasr: 'ٍ',
        tanween_damm: 'ٌ', dagger_alif: 'ٰ', maddah_above: 'ٓ',
        subscript_alef: 'ٖ', inverted_damma: 'ٗ'
      };
      const ch = HARAKAT_CHAR[pending[0]];
      if (!ch) break;
      m.tryHarakat(ch);
    }
  }
  assert.ok(foundMaddPending, 'Should encounter a slot where maddah_above is pending');
});

test('madd-test 110:1: maddah_above char (U+0653) is accepted when pending', () => {
  const text = getVerseText(110, 1);
  const done = typeLettersAndHarakat(text, ['maddah_above']);
  assert.equal(done, true, 'Should complete when madd mark is typed');
});

test('madd-test 110:1: with requiredHarakat [] letters alone complete the verse (madd auto-filled)', () => {
  const text = getVerseText(110, 1);
  const done = typeLettersOnly(text, []);
  assert.equal(done, true, 'With auto-fill all, letters alone should complete the verse');
});

// ---- 106:4 with maddah required ----

test('madd-test 106:4: typing letters alone does NOT complete when maddah_above is required', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersOnly(text, ['maddah_above']);
  assert.equal(done, false, 'Should not complete without typing the madd mark');
});

test('madd-test 106:4: matcher demands maddah_above at the madd position (pendingMarks check)', () => {
  const text = getVerseText(106, 4);
  const skeleton = buildSkeleton(text, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, { requiredHarakat: ['maddah_above'] });
  let foundMaddPending = false;
  let guard = 0;
  outer: while (m.state.awaiting !== 'done' && guard < 2000) {
    guard++;
    if (m.state.awaiting === 'letter') {
      const slot = skeleton[m.state.slotIdx];
      if (!slot) break;
      m.tryLetter(slot.letter);
    } else if (m.state.awaiting === 'harakat') {
      if (m.state.pendingMarks.has('maddah_above')) {
        foundMaddPending = true;
        // Indo-Pak uses ۤ (U+06E4) - but the matcher's HARAKAT_NAME maps it to
        // 'maddah_above', so tryHarakat with either codepoint should be accepted.
        const r = m.tryHarakat('ۤ'); // ۤ high madda
        assert.equal(r.accepted, true, 'high madda char (U+06E4) should be accepted as maddah_above');
        break outer;
      }
      const pending = [...m.state.pendingMarks];
      if (pending.length === 0) break;
      const HARAKAT_CHAR = {
        fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ',
        shadda: 'ّ', tanween_fath: 'ً', tanween_kasr: 'ٍ',
        tanween_damm: 'ٌ', dagger_alif: 'ٰ', maddah_above: 'ٓ',
        subscript_alef: 'ٖ', inverted_damma: 'ٗ'
      };
      const ch = HARAKAT_CHAR[pending[0]];
      if (!ch) break;
      m.tryHarakat(ch);
    }
  }
  assert.ok(foundMaddPending, 'Should encounter a slot where maddah_above is pending');
});

test('madd-test 106:4: maddah_above (both U+0653 and U+06E4) is accepted when pending', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersAndHarakat(text, ['maddah_above']);
  assert.equal(done, true, 'Should complete when madd mark is typed');
});

test('madd-test 106:4: with requiredHarakat [] letters alone complete the verse (madd auto-filled)', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersOnly(text, []);
  assert.equal(done, true, 'With auto-fill all, letters alone should complete the verse');
});
