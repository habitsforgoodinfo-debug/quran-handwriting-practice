// Integrity suite — every verse in chapters 78..114 of the bundled
// Indo-Pak data should be typeable end-to-end with the current parser,
// silent-rules, skeleton, and live-matcher. The test simulates a
// "perfect" run: for each verse it builds the skeleton, then presses
// every required key in order until the matcher reports complete.
//
// A failure means EITHER the data has a glyph our rules don't recognize
// as gateable / silent (so the user gets stuck on a phantom slot), OR
// the matcher cannot accept some legitimate input. Either way the user
// would experience a verse that never completes.
//
// Run on demand:  node --test tests/integration/juz-amma-typeable.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { LiveMatcher } from '../../src/compare/live-matcher.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const QURAN_PATH = resolve(HERE, '../../assets/quran/quran-indopak.json');

const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ',
  subscript_alef: 'ٖ', inverted_damma: 'ٗ'
};

// Try to drive the matcher to completion by reading the skeleton.
// Returns { ok, surah, ayah, slotIdx, reason } when stuck.
function tryTypeVerse(surah, ayah, rawText) {
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton);
  let guard = 0;
  while (m.state.awaiting !== 'done' && guard < 5000) {
    guard++;
    const slot = skeleton[m.state.slotIdx];
    if (!slot) return { ok: false, surah, ayah, slotIdx: m.state.slotIdx, reason: 'no slot' };
    if (m.state.awaiting === 'letter') {
      const r = m.tryLetter(slot.letter);
      if (!r.accepted) {
        return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
          reason: `letter ${slot.letter} rejected (kind=${slot.kind})` };
      }
    } else {
      const need = [...m.state.pendingMarks][0];
      const ch = HARAKAT_CHAR[need];
      if (!ch) return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
        reason: `no input mapping for required mark "${need}"` };
      const r = m.tryHarakat(ch);
      if (!r.accepted) {
        return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
          reason: `harakat ${need} (${ch.codePointAt(0).toString(16)}) rejected` };
      }
    }
  }
  return { ok: m.state.awaiting === 'done', surah, ayah, slotIdx: m.state.slotIdx };
}

const quran = JSON.parse(readFileSync(QURAN_PATH, 'utf8'));

const SURAH_RANGE = [];
for (let s = 78; s <= 114; s++) SURAH_RANGE.push(s);

const results = { ok: 0, fail: 0, failures: [] };

for (const s of SURAH_RANGE) {
  const surahData = quran[String(s)];
  if (!surahData) continue;
  const verses = surahData.verses;
  for (const ayahKey of Object.keys(verses)) {
    const ayah = parseInt(ayahKey, 10);
    const rawText = verses[ayahKey];
    const r = tryTypeVerse(s, ayah, rawText);
    if (r.ok) results.ok++;
    else { results.fail++; results.failures.push(r); }
  }
}

test('juz-amma typability report (chapters 78–114)', () => {
  // eslint-disable-next-line no-console
  console.log(`\n[juz-amma integrity] passed: ${results.ok}, failed: ${results.fail}`);
  if (results.failures.length) {
    const sample = results.failures.slice(0, 12);
    for (const f of sample) {
      console.log(`  ✗ ${f.surah}:${f.ayah}  slot ${f.slotIdx}  ${f.reason}`);
    }
    if (results.failures.length > sample.length) {
      console.log(`  …(+${results.failures.length - sample.length} more)`);
    }
  }
  assert.equal(results.fail, 0,
    `${results.fail} verses in chapters 78..114 are not typeable end-to-end`);
});
