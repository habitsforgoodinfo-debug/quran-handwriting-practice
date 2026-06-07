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
import { DEFAULT_REQUIRED_LETTERS } from '../../src/store/settings.js';

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
function typeLettersOnly(rawText, config) {
  // `config` is the full LiveMatcher options object, e.g.
  //   { requiredHarakat: [...] } or
  //   { requiredLetters: [...], requiredHarakat: [...] }.
  // The walk is AWAITING-driven: it only types a letter when the matcher
  // asks for one, so auto-consumed (optional) slots are skipped naturally.
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, config);
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
function typeLettersAndHarakat(rawText, config) {
  const HARAKAT_CHAR = {
    fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ',
    shadda: 'ّ',
    tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
    dagger_alif: 'ٰ', maddah_above: 'ٓ',
    subscript_alef: 'ٖ', inverted_damma: 'ٗ'
  };
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, config);
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
  const done = typeLettersOnly(text, { requiredHarakat: ['maddah_above'] });
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
  const done = typeLettersAndHarakat(text, { requiredHarakat: ['maddah_above'] });
  assert.equal(done, true, 'Should complete when madd mark is typed');
});

test('madd-test 110:1: with requiredHarakat [] letters alone complete the verse (madd auto-filled)', () => {
  const text = getVerseText(110, 1);
  const done = typeLettersOnly(text, { requiredHarakat: [] });
  assert.equal(done, true, 'With auto-fill all, letters alone should complete the verse');
});

// ---- 106:4 with maddah required ----

test('madd-test 106:4: typing letters alone does NOT complete when maddah_above is required', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersOnly(text, { requiredHarakat: ['maddah_above'] });
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
  const done = typeLettersAndHarakat(text, { requiredHarakat: ['maddah_above'] });
  assert.equal(done, true, 'Should complete when madd mark is typed');
});

test('madd-test 106:4: with requiredHarakat [] letters alone complete the verse (madd auto-filled)', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersOnly(text, { requiredHarakat: [] });
  assert.equal(done, true, 'With auto-fill all, letters alone should complete the verse');
});

// ---- REFRESHER mode: madd carrier letter is OPTIONAL (auto-consumed) ----
//
// In refresher mode the madd carrier (ا / ي / ی) is NOT in
// DEFAULT_REQUIRED_LETTERS, so its whole slot auto-consumes. The bug:
// the auto-consume path swallowed EVERY required harakat - including
// maddah_above that the user explicitly opted into via requiredHarakat.
// So "Test madd" had no effect in refresher mode. These tests pin the
// fixed behavior: the opted-in madd must still be DEMANDED.

const REFRESHER = {
  requiredLetters: DEFAULT_REQUIRED_LETTERS,
  requiredHarakat: ['maddah_above']
};

// Walk a refresher-config matcher; assert it stops at a harakat-awaiting
// state with maddah_above pending, that typing the madd char proceeds, and
// that the full (letters + demanded madd) walk completes.
function refresherMaddWalk(rawText, maddChar) {
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton, REFRESHER);
  let foundMaddPending = false;
  let acceptedMadd = false;
  let guard = 0;
  while (m.state.awaiting !== 'done' && guard < 4000) {
    guard++;
    if (m.state.awaiting === 'letter') {
      const slot = skeleton[m.state.slotIdx];
      if (!slot) break;
      const r = m.tryLetter(slot.letter);
      if (!r.accepted) break;
    } else if (m.state.awaiting === 'harakat') {
      // Under refresher config, maddah_above is the ONLY demanded mark.
      assert.ok(
        m.state.pendingMarks.has('maddah_above'),
        'only maddah_above should ever be pending in refresher mode'
      );
      foundMaddPending = true;
      const r = m.tryHarakat(maddChar);
      if (r.accepted) acceptedMadd = true;
      else break;
    }
  }
  return { done: m.state.awaiting === 'done', foundMaddPending, acceptedMadd };
}

test('madd-test refresher 110:1: letters-only does NOT complete (madd demanded)', () => {
  const text = getVerseText(110, 1);
  const done = typeLettersOnly(text, REFRESHER);
  assert.equal(done, false,
    'Refresher mode with Test madd on must NOT complete from letters alone');
});

test('madd-test refresher 110:1: madd is pending, typing it proceeds, full walk completes', () => {
  const text = getVerseText(110, 1);
  // 110:1 madd carrier is ا (alif) -> U+0653 maddah_above.
  const { done, foundMaddPending, acceptedMadd } = refresherMaddWalk(text, 'ٓ');
  assert.ok(foundMaddPending, 'Should reach a harakat-awaiting state with madd pending');
  assert.ok(acceptedMadd, 'Typing the madd char should be accepted');
  assert.equal(done, true, 'Full walk (letters + demanded madd) should complete');
});

test('madd-test refresher 106:4: letters-only does NOT complete (madd demanded)', () => {
  const text = getVerseText(106, 4);
  const done = typeLettersOnly(text, REFRESHER);
  assert.equal(done, false,
    'Refresher mode with Test madd on must NOT complete from letters alone');
});

test('madd-test refresher 106:4: madd is pending, typing it proceeds, full walk completes', () => {
  const text = getVerseText(106, 4);
  // 106:4 Indo-Pak carrier is ی; the matcher accepts the U+06E4 high madda.
  const { done, foundMaddPending, acceptedMadd } = refresherMaddWalk(text, 'ۤ');
  assert.ok(foundMaddPending, 'Should reach a harakat-awaiting state with madd pending');
  assert.ok(acceptedMadd, 'Typing the high-madda char should be accepted');
  assert.equal(done, true, 'Full walk (letters + demanded madd) should complete');
});

test('madd-test refresher: requiredHarakat [] still completes letters-only (no regression)', () => {
  // Same optional-letter config, but Test madd OFF -> auto-fill everything.
  const cfg = { requiredLetters: DEFAULT_REQUIRED_LETTERS, requiredHarakat: [] };
  assert.equal(typeLettersOnly(getVerseText(110, 1), cfg), true,
    '110:1 should complete from letters alone when madd is auto-filled');
  assert.equal(typeLettersOnly(getVerseText(106, 4), cfg), true,
    '106:4 should complete from letters alone when madd is auto-filled');
});

// ---- Unit level: synthetic skeleton, optional letter carries fatha+madd ----

test('madd-test unit: optional letter with [fatha, maddah_above] auto-fills fatha, demands madd', () => {
  // Synthetic skeleton: one required sound (ب) then an OPTIONAL carrier (ا)
  // that carries BOTH fatha and maddah_above. With requiredHarakat
  // ['maddah_above'] the fatha must auto-fill onto the auto letter, but
  // maddah_above must be demanded.
  const skeleton = [
    { kind: 'sound', letter: 'ب', expectedHarakat: { required: [] }, wordIdx: 0, canonicalIdx: 0 },
    { kind: 'sound', letter: 'ا',
      expectedHarakat: { required: ['fatha', 'maddah_above'] },
      wordIdx: 0, canonicalIdx: 1 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(skeleton, {
    requiredLetters: ['ب'],          // ا is optional -> auto-consumed
    requiredHarakat: ['maddah_above']
  });

  // First the matcher asks for the required letter ب (no marks).
  assert.equal(m.state.awaiting, 'letter');
  const r1 = m.tryLetter('ب');
  assert.equal(r1.accepted, true);

  // Now the optional ا auto-consumes: fatha is auto-filled, but madd is
  // demanded -> we land in harakat-awaiting with ONLY maddah_above pending.
  assert.equal(m.state.awaiting, 'harakat',
    'should stop to demand the opted-in madd on the auto letter');
  assert.deepEqual([...m.state.pendingMarks], ['maddah_above'],
    'only maddah_above should be pending (fatha auto-filled)');

  // The auto ا entry should already carry the auto-filled fatha.
  const autoEntry = m.state.typed.find(t => t.letter === 'ا');
  assert.ok(autoEntry, 'auto alif entry exists');
  assert.equal(autoEntry.auto, true, 'alif entry is marked auto');
  assert.ok((autoEntry.harakat || '').includes('َ'),
    'auto alif entry carries the auto-filled fatha');

  // Typing the madd char attaches it to the alif and completes.
  const r2 = m.tryHarakat('ٓ');
  assert.equal(r2.accepted, true, 'madd char accepted');
  assert.equal(r2.complete, true, 'verse completes after the demanded madd');
  assert.ok((autoEntry.harakat || '').includes('ٓ'),
    'madd is attached to the auto alif entry');
});

test('madd-test unit: verse STARTING with optional madd carrier demands madd before input', () => {
  // Constructor calls _advanceToNextSound([]) - a verse whose very first
  // sound is an optional madd carrier must immediately await the madd.
  const skeleton = [
    { kind: 'sound', letter: 'ا',
      expectedHarakat: { required: ['maddah_above'] },
      wordIdx: 0, canonicalIdx: 0 },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(skeleton, {
    requiredLetters: ['ب'],          // ا optional
    requiredHarakat: ['maddah_above']
  });
  assert.equal(m.state.awaiting, 'harakat',
    'verse opening on an optional madd carrier awaits the madd immediately');
  assert.deepEqual([...m.state.pendingMarks], ['maddah_above']);
  const r = m.tryHarakat('ٓ');
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});
