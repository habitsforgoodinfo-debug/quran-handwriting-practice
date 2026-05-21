// Integrity suite for Tarteel Indo-Pak Nastaleeq data (chapters 78–114).
//
// For every verse:
//   1. Build the skeleton (with isVerseStart=true).
//   2. Walk slot-by-slot through the live matcher, pressing the expected
//      letter and each remaining required harakat in order.
//   3. Assert the verse reaches awaiting='done' and that every key the
//      matcher demands has a corresponding keypad button mapped.
//
// A failure means a verse contains a letter or diacritic the user
// cannot type via the on-screen keypad — i.e. it would freeze the
// practice loop in the browser.
//
// Run on demand:
//     node --test tests/integration/juz-amma-typeable.test.js
// The full `node --test tests/` run also exercises it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { LiveMatcher } from '../../src/compare/live-matcher.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const QURAN_PATH = resolve(HERE, '../../assets/quran/quran-indopak.json');

// Mark name → input codepoint (matches HARAKAT_BASE in keypad.js).
const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ',
  subscript_alef: 'ٖ', inverted_damma: 'ٗ'
};

// Letters reachable from the keypad layout (mirrors src/ui/keypad.js).
const KEYPAD_LETTERS = new Set([
  'ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د','ذ',
  'ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط',
  'ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ'
]);
// Letters from Indo-Pak data that aren't on the keypad but are accepted
// via tolerance (e.g. Urdu yeh ی → Arabic yeh ي).
const TOLERANCE_FALLBACK = new Map([
  ['ی', 'ي']
]);

function keypadHasLetter(letter) {
  if (KEYPAD_LETTERS.has(letter)) return true;
  if (TOLERANCE_FALLBACK.has(letter)) return KEYPAD_LETTERS.has(TOLERANCE_FALLBACK.get(letter));
  return false;
}

function tryTypeVerse(surah, ayah, rawText) {
  const skeleton = buildSkeleton(rawText, { isVerseStart: true });
  const m = new LiveMatcher(skeleton);
  let guard = 0;
  while (m.state.awaiting !== 'done' && guard < 5000) {
    guard++;
    const slot = skeleton[m.state.slotIdx];
    if (!slot) return { ok: false, surah, ayah, slotIdx: m.state.slotIdx, reason: 'no slot' };
    if (m.state.awaiting === 'letter') {
      // Need a keypad-reachable letter for this slot.
      if (!keypadHasLetter(slot.letter)) {
        return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
          reason: `letter "${slot.letter}" (U+${slot.letter.codePointAt(0).toString(16)}) missing from keypad` };
      }
      const input = TOLERANCE_FALLBACK.get(slot.letter) || slot.letter;
      const r = m.tryLetter(input);
      if (!r.accepted) {
        return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
          reason: `letter ${input} rejected (kind=${slot.kind}, expected=${slot.letter})` };
      }
    } else {
      const need = [...m.state.pendingMarks][0];
      const ch = HARAKAT_CHAR[need];
      if (!ch) return { ok: false, surah, ayah, slotIdx: m.state.slotIdx,
        reason: `required mark "${need}" has no keypad input` };
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

const results = { ok: 0, fail: 0, failures: [], byChapter: {} };

for (const s of SURAH_RANGE) {
  const surahData = quran[String(s)];
  if (!surahData) continue;
  const verses = surahData.verses;
  results.byChapter[s] = { ok: 0, fail: 0 };
  for (const ayahKey of Object.keys(verses)) {
    const ayah = parseInt(ayahKey, 10);
    const rawText = verses[ayahKey];
    const r = tryTypeVerse(s, ayah, rawText);
    if (r.ok) { results.ok++; results.byChapter[s].ok++; }
    else      { results.fail++; results.byChapter[s].fail++; results.failures.push(r); }
  }
}

test('Tarteel Indo-Pak chapters 78–114: every verse fully typeable', () => {
  console.log(`\n[Tarteel Indo-Pak juz-amma integrity]`);
  console.log(`  total verses:  ${results.ok + results.fail}`);
  console.log(`  passed:        ${results.ok}`);
  console.log(`  failed:        ${results.fail}`);
  console.log(`  chapters covered: ${Object.keys(results.byChapter).length}  (78..114)`);
  if (results.failures.length) {
    const sample = results.failures.slice(0, 20);
    console.log(`  first failures:`);
    for (const f of sample) {
      console.log(`    ✗ ${f.surah}:${f.ayah}  slot ${f.slotIdx}  ${f.reason}`);
    }
    if (results.failures.length > sample.length) {
      console.log(`    …(+${results.failures.length - sample.length} more)`);
    }
  }
  assert.equal(results.fail, 0,
    `${results.fail} verses in chapters 78..114 are not fully typeable`);
});
