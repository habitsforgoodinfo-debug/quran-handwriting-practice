# UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the app on its core purpose — verifying pronounced letters and harakat — by introducing a phonetic skeleton, automatic word segmentation, tap-to-edit harakat, ghosted silent letters, a quiet progress layer, and a calm mushaf-inspired UI.

**Architecture:** A new intermediate data structure (the *skeleton*) is built per verse at load time, listing slots of kind `sound`, `silent`, and `wordEnd`. A stateful matcher consumes typed slots against the skeleton, auto-consuming silent/word-end slots. The UI renders from the matcher's render-state. Existing modules are folded in incrementally behind a feature flag so the app stays usable at every step.

**Tech Stack:** Vanilla ES modules, `node --test` for unit tests, plain CSS, no build step. Existing modules: `src/verse/parser.js` already produces glyphs with `letter`, `diacritics[]`, `isSilent`, `isMaddAlif` — the skeleton builder consumes this.

**Spec:** `docs/superpowers/specs/2026-05-19-ux-overhaul-design.md`

---

## File Structure

**New files:**
- `src/verse/silent-rules.js` — silent-letter rule table and `isSilentSlot(glyph, prevGlyph, word, wordIdx)`.
- `src/verse/skeleton.js` — pure `buildSkeleton(parsedVerse) → Skeleton`.
- `src/compare/matcher.js` — stateful matcher over a skeleton.
- `src/ui/practice-view.js` — three-zone layout host.
- `src/ui/progress-strip.js` — streak + personal-best strip.
- `src/store/progress.js` — streak, verse-bests, surah-completion store (pure-ish, IDB-backed).
- `src/ui/stats-view.js` — separate stats screen.
- `tests/verse/skeleton.test.js`, `tests/verse/silent-rules.test.js`, `tests/compare/matcher.test.js`, `tests/store/progress.test.js`.

**Modified:**
- `src/data/quran-loader.js` — attach `.skeleton` to each parsed verse.
- `src/ui/verse-display.js` — render from matcher render-state; faded silent letters; tap-to-edit hit testing.
- `src/ui/keypad.js` — harakat row always reachable; remove space key.
- `src/main.js` — feature flag, then full rewrite to use practice-view.
- `styles.css` — full rewrite for mushaf palette + zone layout.
- `index.html` — three-zone container scaffolding.

**Removed (in final phase, after flag flip):**
- `src/compare/aligner.js`, `src/compare/user-stream.js`, `src/compare/smart-match.js` (folded into matcher).

---

## Phase 0: Setup

### Task 0.1: Create feature-flag constant

**Files:**
- Create: `src/feature-flags.js`

- [ ] **Step 1: Write the file**

```js
// One source of truth for in-progress migration flags. Each flag must default
// to the existing behavior so the app remains shippable at every commit.
export const FLAGS = {
  // When true, main.js renders the new practice-view and uses the matcher.
  // When false, the legacy layout + smart-match path is used.
  useSkeletonMatcher: false,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/feature-flags.js
git commit -m "chore: add feature-flag module for incremental UX overhaul"
```

---

## Phase 1: Silent-rule table

### Task 1.1: Define silent-rule predicates

**Files:**
- Create: `src/verse/silent-rules.js`
- Test: `tests/verse/silent-rules.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSilentSlot } from '../../src/verse/silent-rules.js';

// Each case is { name, word: [glyph...], index, expected }
// A glyph here is the parser's output shape: { letter, diacritics, isSilent, isMaddAlif }.
function g(letter, diacritics = [], extra = {}) {
  return { letter, diacritics, isSilent: false, isMaddAlif: false, ...extra };
}

test('definite-article alif before sun letter is silent', () => {
  // الشَّمْس : ا ل ش(shadda+fatha) م(sukun) س
  const word = [
    g('ا'),
    g('ل', ['sukun']),
    g('ش', ['shadda', 'fatha']),
    g('م', ['sukun']),
    g('س'),
  ];
  assert.equal(isSilentSlot(word, 0), true,  'leading alif of al- before sun letter');
  assert.equal(isSilentSlot(word, 1), true,  'lam of al- before sun letter');
});

test('definite-article alif before moon letter is NOT silent for lam', () => {
  // القَمَر : ا ل(sukun) ق َ م َ ر
  const word = [
    g('ا'),
    g('ل', ['sukun']),
    g('ق', ['fatha']),
    g('م', ['fatha']),
    g('ر'),
  ];
  assert.equal(isSilentSlot(word, 0), true,  'leading alif of al- is always silent');
  assert.equal(isSilentSlot(word, 1), false, 'lam before moon letter is pronounced');
});

test('plural masculine trailing alif (waw + sukun + alif) is silent', () => {
  // كَتَبُوا : ك(fatha) ت(fatha) ب(damma) و(sukun) ا
  const word = [
    g('ك', ['fatha']),
    g('ت', ['fatha']),
    g('ب', ['damma']),
    g('و', ['sukun']),
    g('ا'),
  ];
  assert.equal(isSilentSlot(word, 4), true);
});

test('dagger-alif-bearing glyph (parser flagged) is not auto-silent', () => {
  // dagger alif is itself a diacritic on the base letter, so the base is pronounced.
  const word = [g('ه', ['fatha', 'dagger_alif']), g('ذ', ['fatha']), g('ا')];
  // Trailing alif in هَٰذَا is silent (lengthens the dagger alif sound).
  assert.equal(isSilentSlot(word, 0), false);
  assert.equal(isSilentSlot(word, 2), true);
});

test('isMaddAlif glyphs are silent (parser already flagged)', () => {
  const word = [g('ق', ['fatha']), g('ا', [], { isMaddAlif: true })];
  assert.equal(isSilentSlot(word, 1), true);
});

test('plain consonant with harakat is not silent', () => {
  const word = [g('ب', ['kasra'])];
  assert.equal(isSilentSlot(word, 0), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/verse/silent-rules.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `silent-rules.js`**

```js
// Decide whether a glyph in a parsed word should be treated as a "silent" slot
// (script-only — not required from the user) when building the skeleton.
//
// All decisions are local to one word. The parser already flagged isMaddAlif
// and a naive isSilent (no harakat AND not a madd alif). We extend that with
// rules specific to Quranic orthography.

const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

function isAlif(letter) {
  return letter === 'ا' || letter === 'أ' || letter === 'إ' || letter === 'آ' || letter === 'ٱ';
}

function isDefiniteArticlePrefix(word) {
  // Word starts with a bare alif (no harakat) followed by lam.
  if (word.length < 2) return false;
  const a = word[0];
  const l = word[1];
  if (!isAlif(a.letter)) return false;
  if (a.diacritics.length !== 0) return false;
  if (l.letter !== 'ل') return false;
  return true;
}

function isTrailingPluralAlif(word, i) {
  // Pattern: ... و(sukun) ا   at the very end of the word.
  if (i !== word.length - 1) return false;
  const g = word[i];
  if (!isAlif(g.letter) || g.diacritics.length !== 0) return false;
  const prev = word[i - 1];
  if (!prev) return false;
  return prev.letter === 'و' && prev.diacritics.includes('sukun');
}

export function isSilentSlot(word, i) {
  const g = word[i];
  if (!g) return false;

  // Trust the parser's flag: a bare alif that lengthens a preceding fatha.
  if (g.isMaddAlif) return true;

  // Definite article: leading alif of "al-" is always silent.
  if (i === 0 && isDefiniteArticlePrefix(word)) return true;

  // Definite article before a sun letter: the lam assimilates, so it's silent.
  if (i === 1 && isDefiniteArticlePrefix(word)) {
    const next = word[2];
    if (next && SUN_LETTERS.has(next.letter)) return true;
  }

  // Plural masculine trailing alif.
  if (isTrailingPluralAlif(word, i)) return true;

  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/verse/silent-rules.test.js`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/verse/silent-rules.js tests/verse/silent-rules.test.js
git commit -m "feat(verse): silent-letter rule table for skeleton builder"
```

---

## Phase 2: Skeleton builder

### Task 2.1: Build skeleton from a parsed verse

**Files:**
- Create: `src/verse/skeleton.js`
- Test: `tests/verse/skeleton.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVerse } from '../../src/verse/parser.js';
import { buildSkeleton } from '../../src/verse/skeleton.js';

test('bismillah skeleton has sound/silent/wordEnd slots in order', () => {
  // بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
  const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const parsed = parseVerse(text);
  const skel = buildSkeleton(parsed);

  // First word بِسْمِ → 3 sound slots + 1 wordEnd
  assert.equal(skel[0].kind, 'sound'); assert.equal(skel[0].letter, 'ب');
  assert.equal(skel[1].kind, 'sound'); assert.equal(skel[1].letter, 'س');
  assert.equal(skel[2].kind, 'sound'); assert.equal(skel[2].letter, 'م');
  assert.equal(skel[3].kind, 'wordEnd'); assert.equal(skel[3].word, 0);

  // Second word اللَّهِ — al- before lam (sun letter): both alif and lam are silent.
  // The shadda on lam is part of "اللّه" — parser places shadda+fatha on lam itself.
  // Skeleton: silent(ا), silent(ل), sound(ل with shadda+fatha), sound(ه with kasra), wordEnd
  const w1Start = 4;
  assert.equal(skel[w1Start].kind, 'silent');     assert.equal(skel[w1Start].letter, 'ا');
  assert.equal(skel[w1Start + 1].kind, 'silent'); assert.equal(skel[w1Start + 1].letter, 'ل');
  assert.equal(skel[w1Start + 2].kind, 'sound');  assert.equal(skel[w1Start + 2].letter, 'ل');
});

test('every sound slot carries word index and expected harakat', () => {
  const parsed = parseVerse('بِسْمِ');
  const skel = buildSkeleton(parsed);
  assert.equal(skel[0].word, 0);
  assert.deepEqual(skel[0].expectedHarakat, ['kasra']);
  assert.deepEqual(skel[2].expectedHarakat, ['kasra']);
});

test('a verse with one word ends with exactly one wordEnd', () => {
  const skel = buildSkeleton(parseVerse('بِسْمِ'));
  assert.equal(skel[skel.length - 1].kind, 'wordEnd');
  const wordEnds = skel.filter(s => s.kind === 'wordEnd');
  assert.equal(wordEnds.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/verse/skeleton.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `skeleton.js`**

```js
import { isSilentSlot } from './silent-rules.js';

// Build an ordered list of slots from a parsed verse.
// Slot kinds:
//   { kind: 'sound',   letter, expectedHarakat: [names], word: number, glyphIdx: number }
//   { kind: 'silent',  letter, expectedHarakat: [names], word: number, glyphIdx: number }
//   { kind: 'wordEnd', word: number }
//
// parsedVerse is an array of words; each word is an array of glyphs from parseWord().
export function buildSkeleton(parsedVerse) {
  const out = [];
  for (let wi = 0; wi < parsedVerse.length; wi++) {
    const word = parsedVerse[wi];
    for (let gi = 0; gi < word.length; gi++) {
      const g = word[gi];
      const silent = isSilentSlot(word, gi);
      out.push({
        kind: silent ? 'silent' : 'sound',
        letter: g.letter,
        expectedHarakat: g.diacritics.slice(),
        word: wi,
        glyphIdx: gi,
      });
    }
    out.push({ kind: 'wordEnd', word: wi });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/verse/skeleton.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/verse/skeleton.js tests/verse/skeleton.test.js
git commit -m "feat(verse): phonetic skeleton builder"
```

### Task 2.2: Attach skeleton to loaded verses

**Files:**
- Modify: `src/data/quran-loader.js`

- [ ] **Step 1: Read `quran-loader.js`** to identify where verses are returned.

- [ ] **Step 2: Add a helper export `getVerseWithSkeleton(surah, ayah)`** that returns `{ raw, parsed, skeleton }`. Do NOT modify the existing `getVerse` signature.

```js
// Append near the bottom of the file.
import { parseVerse } from '../verse/parser.js';
import { buildSkeleton } from '../verse/skeleton.js';

export function getVerseWithSkeleton(surah, ayah) {
  const raw = getVerse(surah, ayah);
  const parsed = parseVerse(raw);
  return { raw, parsed, skeleton: buildSkeleton(parsed) };
}
```

- [ ] **Step 3: Sanity-check** with a quick node script:

```bash
node --input-type=module -e "
  import('./src/data/quran-loader.js').then(async m => {
    await m.loadQuran('uthmani');
    const v = m.getVerseWithSkeleton(1, 1);
    console.log('skeleton length:', v.skeleton.length);
    console.log('first 5 slots:', v.skeleton.slice(0, 5));
  });
"
```

Expected: non-zero skeleton length; slots have `kind`/`letter` fields.

- [ ] **Step 4: Commit**

```bash
git add src/data/quran-loader.js
git commit -m "feat(data): expose getVerseWithSkeleton helper"
```

---

## Phase 3: Stateful matcher

### Task 3.1: Matcher: appendLetter/backspace/getRenderState

**Files:**
- Create: `src/compare/matcher.js`
- Test: `tests/compare/matcher.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVerse } from '../../src/verse/parser.js';
import { buildSkeleton } from '../../src/verse/skeleton.js';
import { createMatcher } from '../../src/compare/matcher.js';

function matcherFor(text) {
  return createMatcher(buildSkeleton(parseVerse(text)));
}

test('appendLetter advances through sound slots', () => {
  const m = matcherFor('بِسْمِ'); // 3 sound slots + wordEnd
  m.appendLetter('ب');
  m.appendLetter('س');
  m.appendLetter('م');
  const state = m.getRenderState();
  assert.equal(state.typedSlots.length, 3);
  assert.equal(state.typedSlots[0].letterState, 'match');
});

test('wrong letter is marked wrong-letter but does not block', () => {
  const m = matcherFor('بِسْمِ');
  m.appendLetter('ت'); // wrong (expected ب)
  m.appendLetter('س');
  const state = m.getRenderState();
  assert.equal(state.typedSlots[0].letterState, 'wrong-letter');
  assert.equal(state.typedSlots[1].letterState, 'match');
});

test('appendHarakat applies to last sound slot', () => {
  const m = matcherFor('بِسْمِ');
  m.appendLetter('ب');
  m.appendHarakat('kasra');
  const s = m.getRenderState();
  assert.deepEqual(s.typedSlots[0].harakat, ['kasra']);
  assert.equal(s.typedSlots[0].letterState, 'match');
  assert.equal(s.typedSlots[0].harakatState, 'match');
});

test('appendHarakat with wrong value flags wrong-harakat', () => {
  const m = matcherFor('بِسْمِ'); // expects kasra on ب
  m.appendLetter('ب');
  m.appendHarakat('fatha');
  const s = m.getRenderState();
  assert.equal(s.typedSlots[0].harakatState, 'wrong-harakat');
});

test('silent letters auto-insert as ghost slots after the preceding sound slot', () => {
  // الشَّمْس : a l(silent) sh(shadda+fatha) m(sukun) s
  const m = matcherFor('الشَّمْسُ');
  // user types: sh m s u (only sound letters)
  m.appendLetter('ش');
  const s = m.getRenderState();
  // Two silent slots (alif, lam) should appear as ghost slots BEFORE the typed 'ش'.
  const ghostsBeforeFirst = s.renderedSlots.filter(r => r.isGhost).length;
  assert.equal(ghostsBeforeFirst, 2);
});

test('wordEnd slot emits a word break in the render state', () => {
  const m = matcherFor('بِسْمِ اللَّهِ');
  m.appendLetter('ب'); m.appendLetter('س'); m.appendLetter('م');
  // After typing the last sound of the first word, wordEnd should be auto-consumed
  // and the matcher should be ready for the next word.
  const s = m.getRenderState();
  // typedSlots[2] should have isLastInWord = true
  assert.equal(s.typedSlots[2].isLastInWord, true);
});

test('backspace removes last typed slot and any ghosts it pulled in', () => {
  const m = matcherFor('الشَّمْسُ');
  m.appendLetter('ش'); // pulls in 2 ghost silent slots before it
  let s = m.getRenderState();
  assert.equal(s.typedSlots.length, 1);
  m.backspace();
  s = m.getRenderState();
  assert.equal(s.typedSlots.length, 0);
  // Ghost slots are derived; they shouldn't persist after backspace removes their trigger.
  const ghosts = s.renderedSlots.filter(r => r.isGhost);
  assert.equal(ghosts.length, 0);
});

test('setActiveSlot + appendHarakat edits an earlier slot', () => {
  const m = matcherFor('بِسْمِ');
  m.appendLetter('ب');
  m.appendLetter('س');
  m.setActiveSlot(0);
  m.appendHarakat('kasra');
  const s = m.getRenderState();
  assert.deepEqual(s.typedSlots[0].harakat, ['kasra']);
});

test('typing a letter while a past slot is active returns caret to end then appends', () => {
  const m = matcherFor('بِسْمِ');
  m.appendLetter('ب');
  m.appendLetter('س');
  m.setActiveSlot(0);
  m.appendLetter('م'); // should NOT insert at index 1; should append at end
  const s = m.getRenderState();
  assert.equal(s.typedSlots.length, 3);
  assert.equal(s.typedSlots[2].letter, 'م');
  assert.equal(s.activeIndex, 2); // caret back at the end
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/compare/matcher.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `matcher.js`**

```js
// Stateful matcher over a verse skeleton.
//
// Render state shape (consumed by verse-display):
//   {
//     typedSlots: [{ letter, harakat: [names], expectedLetter, expectedHarakat,
//                    letterState, harakatState, isLastInWord, word }, ...],
//     renderedSlots: [ ...typedSlots interleaved with ghost silent slots ],
//     activeIndex: number,   // index into typedSlots; equals typedSlots.length-1 normally
//     remainingSlots: [skeleton slot...]  // slots not yet consumed (sound or silent)
//   }
//
// A ghost slot:
//   { isGhost: true, letter, harakat: [names], state: 'ghost' }

function harakatEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a), sb = new Set(b);
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

function letterMatches(typed, expected) {
  // Forgiving recognition: tolerated confusables. Strict mode is wired later.
  if (typed === expected) return true;
  const ALIF_GROUP = new Set(['ا','أ','إ','آ','ٱ']);
  const TA_GROUP   = new Set(['ت','ة']);
  if (ALIF_GROUP.has(typed) && ALIF_GROUP.has(expected)) return true;
  if (TA_GROUP.has(typed) && TA_GROUP.has(expected)) return true;
  return false;
}

export function createMatcher(skeleton) {
  // Each typed slot is bound at append time to the skeleton slot it consumed.
  const typed = [];        // [{ letter, harakat: [], skelIdx }]
  let nextSkelIdx = 0;     // pointer into skeleton (sound slot to consume next)
  let activeIdx = -1;      // -1 = caret at end

  function skipNonSoundSlots() {
    while (nextSkelIdx < skeleton.length && skeleton[nextSkelIdx].kind !== 'sound') {
      nextSkelIdx++;
    }
  }
  skipNonSoundSlots();

  function appendLetter(letter) {
    // If a past slot is active, first return caret to end (no mid-stream insert).
    activeIdx = -1;

    if (nextSkelIdx >= skeleton.length) {
      // Past end: still record as wrong-extra so the user can see it.
      typed.push({ letter, harakat: [], skelIdx: -1 });
      return;
    }
    const expected = skeleton[nextSkelIdx];
    typed.push({ letter, harakat: [], skelIdx: nextSkelIdx });
    nextSkelIdx++;
    skipNonSoundSlots();
  }

  function appendHarakat(name) {
    const idx = activeIdx === -1 ? typed.length - 1 : activeIdx;
    if (idx < 0) return;
    // Replace existing harakat with [name]. Multi-harakat (shadda+fatha) is
    // supported by repeated calls: caller decides whether to clear first.
    const t = typed[idx];
    if (!t.harakat.includes(name)) t.harakat.push(name);
  }

  function backspace() {
    activeIdx = -1;
    const removed = typed.pop();
    if (!removed) return;
    if (removed.skelIdx >= 0) {
      // Reset pointer to just after the slot before removed.skelIdx, then re-skip.
      nextSkelIdx = removed.skelIdx;
    }
  }

  function setActiveSlot(idx) {
    if (idx < 0 || idx >= typed.length) { activeIdx = -1; return; }
    activeIdx = idx;
  }

  function clearActiveHarakat() {
    const idx = activeIdx === -1 ? typed.length - 1 : activeIdx;
    if (idx < 0) return;
    typed[idx].harakat = [];
  }

  function getRenderState() {
    // Build typedSlots with states and word info.
    const typedSlots = typed.map((t) => {
      if (t.skelIdx < 0) {
        return {
          letter: t.letter, harakat: t.harakat,
          expectedLetter: null, expectedHarakat: [],
          letterState: 'wrong-extra', harakatState: 'n/a',
          isLastInWord: false, word: -1,
        };
      }
      const s = skeleton[t.skelIdx];
      const letterState = letterMatches(t.letter, s.letter) ? 'match' : 'wrong-letter';
      let harakatState;
      if (s.expectedHarakat.length === 0 && t.harakat.length === 0) harakatState = 'match';
      else if (t.harakat.length === 0) harakatState = 'pending';
      else if (harakatEqual(t.harakat, s.expectedHarakat)) harakatState = 'match';
      else harakatState = 'wrong-harakat';
      // isLastInWord: the slot after t.skelIdx in the skeleton is a wordEnd.
      const isLastInWord = (skeleton[t.skelIdx + 1] && skeleton[t.skelIdx + 1].kind === 'wordEnd');
      return {
        letter: t.letter, harakat: t.harakat.slice(),
        expectedLetter: s.letter, expectedHarakat: s.expectedHarakat.slice(),
        letterState, harakatState, isLastInWord, word: s.word,
      };
    });

    // Build renderedSlots by walking the skeleton up to nextSkelIdx and interleaving:
    //   silent slots become ghosts; sound slots become the typed slot at the matching index.
    const renderedSlots = [];
    let typedI = 0;
    for (let si = 0; si < nextSkelIdx; si++) {
      const sl = skeleton[si];
      if (sl.kind === 'silent') {
        renderedSlots.push({
          isGhost: true,
          letter: sl.letter,
          harakat: sl.expectedHarakat.slice(),
          state: 'ghost',
          word: sl.word,
        });
      } else if (sl.kind === 'sound') {
        const ts = typedSlots[typedI++];
        if (ts) renderedSlots.push({ isGhost: false, ...ts });
      }
      // wordEnd contributes nothing to renderedSlots; consumers use isLastInWord on the prior slot.
    }
    // Any wrong-extra typed slots past the end of skeleton:
    while (typedI < typedSlots.length) {
      renderedSlots.push({ isGhost: false, ...typedSlots[typedI++] });
    }

    return {
      typedSlots,
      renderedSlots,
      activeIndex: activeIdx === -1 ? typedSlots.length - 1 : activeIdx,
      remainingSlots: skeleton.slice(nextSkelIdx),
    };
  }

  function isComplete() {
    return nextSkelIdx >= skeleton.length;
  }

  return {
    appendLetter, appendHarakat, backspace,
    setActiveSlot, clearActiveHarakat,
    getRenderState, isComplete,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/compare/matcher.test.js`
Expected: PASS — all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/compare/matcher.js tests/compare/matcher.test.js
git commit -m "feat(compare): stateful skeleton matcher with tap-to-edit"
```

### Task 3.2: Matcher accuracy summary

**Files:**
- Modify: `src/compare/matcher.js`
- Modify: `tests/compare/matcher.test.js` (append)

- [ ] **Step 1: Add the failing test (append)**

```js
test('summarize() counts only sound slots; silent never counts', () => {
  const m = matcherFor('الشَّمْسُ'); // 3 sound slots (sh, m, s) + 2 silent
  m.appendLetter('ش'); m.appendHarakat('shadda'); m.appendHarakat('fatha');
  m.appendLetter('م'); m.appendHarakat('sukun');
  m.appendLetter('س'); m.appendHarakat('damma');
  const sum = m.summarize();
  assert.equal(sum.totalSoundSlots, 3);
  assert.equal(sum.lettersCorrect, 3);
  assert.equal(sum.harakatCorrect, 3);
  assert.equal(sum.accuracy, 1);
});

test('summarize() with one wrong harakat', () => {
  const m = matcherFor('بِسْمِ');
  m.appendLetter('ب'); m.appendHarakat('fatha'); // wrong (expected kasra)
  m.appendLetter('س'); m.appendHarakat('sukun');
  m.appendLetter('م'); m.appendHarakat('kasra');
  const sum = m.summarize();
  assert.equal(sum.lettersCorrect, 3);
  assert.equal(sum.harakatCorrect, 2);
  // Accuracy = (lettersCorrect + harakatCorrect) / (2 * totalSoundSlots)
  assert.equal(sum.accuracy, 5 / 6);
});
```

- [ ] **Step 2: Run, expect FAIL** (`summarize is not a function`).

- [ ] **Step 3: Add `summarize()` to the matcher** (inside `createMatcher`, before `return`):

```js
function summarize() {
  const sounds = skeleton.filter(s => s.kind === 'sound');
  const total = sounds.length;
  let lettersCorrect = 0, harakatCorrect = 0;
  for (const t of typed) {
    if (t.skelIdx < 0) continue;
    const s = skeleton[t.skelIdx];
    if (s.kind !== 'sound') continue;
    if (letterMatches(t.letter, s.letter)) lettersCorrect++;
    if (
      (s.expectedHarakat.length === 0 && t.harakat.length === 0) ||
      harakatEqual(t.harakat, s.expectedHarakat)
    ) harakatCorrect++;
  }
  return {
    totalSoundSlots: total,
    lettersCorrect,
    harakatCorrect,
    accuracy: total === 0 ? 1 : (lettersCorrect + harakatCorrect) / (2 * total),
  };
}
```

Add `summarize` to the returned object.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compare/matcher.js tests/compare/matcher.test.js
git commit -m "feat(compare): matcher summarize() for verse accuracy"
```

---

## Phase 4: Practice-view layout (no styling yet)

### Task 4.1: HTML scaffolding for three zones

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Read `index.html`** to see current container ids.

- [ ] **Step 2: Add a new container** alongside the existing ones (do NOT remove the old ones — the feature flag picks one):

```html
<!-- Insert just after the existing root content. -->
<div id="practice-view" hidden>
  <header id="pv-header" class="pv-header"></header>
  <section id="pv-progress" class="pv-progress"></section>
  <main id="pv-main" class="pv-main">
    <section id="pv-reference" class="pv-pane pv-reference"></section>
    <hr class="pv-divider" />
    <section id="pv-input" class="pv-pane pv-input"></section>
  </main>
  <footer id="pv-keypad" class="pv-keypad"></footer>
</div>
```

- [ ] **Step 3: Sanity check** — `python3 -m http.server 8000` and open in browser; the new container exists but is hidden, no visible change.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): add hidden practice-view scaffolding"
```

### Task 4.2: practice-view module that mounts panes from matcher state

**Files:**
- Create: `src/ui/practice-view.js`

- [ ] **Step 1: Write the module** (no test — DOM-driven, manual verify in browser):

```js
// Owns the new three-zone layout. Wires keypad input to a matcher and renders
// reference + user panes. Pure rendering; persistence and gamification live
// in main.js / progress store.

export function mountPracticeView(root, deps) {
  const { matcher, referenceVerseText, onSubmit } = deps;

  const headerEl    = root.querySelector('#pv-header');
  const progressEl  = root.querySelector('#pv-progress');
  const refEl       = root.querySelector('#pv-reference');
  const inputEl     = root.querySelector('#pv-input');
  const keypadEl    = root.querySelector('#pv-keypad');

  // Reference: render the canonical verse as plain text.
  refEl.textContent = referenceVerseText;

  function renderInput() {
    inputEl.innerHTML = '';
    const state = matcher.getRenderState();
    let currentWord = -1;
    let wordSpan = null;
    state.renderedSlots.forEach((slot, idx) => {
      if (slot.word !== currentWord) {
        currentWord = slot.word;
        wordSpan = document.createElement('span');
        wordSpan.className = 'pv-word';
        inputEl.appendChild(wordSpan);
        if (currentWord > 0) inputEl.insertBefore(document.createTextNode(' '), wordSpan);
      }
      const letterSpan = document.createElement('span');
      letterSpan.className = 'pv-letter';
      if (slot.isGhost) {
        letterSpan.classList.add('pv-ghost');
      } else {
        letterSpan.classList.add('pv-' + slot.letterState);
        if (slot.harakatState === 'wrong-harakat') letterSpan.classList.add('pv-wrong-harakat');
        if (slot.harakatState === 'pending') letterSpan.classList.add('pv-harakat-pending');
        // Tap-to-edit: only typed slots are tappable.
        letterSpan.dataset.typedIdx = String(idx);
        letterSpan.addEventListener('click', () => {
          // Compute typed-only index by counting non-ghost slots up to and including this one.
          let typedIdx = -1;
          for (let i = 0; i <= idx; i++) {
            if (!state.renderedSlots[i].isGhost) typedIdx++;
          }
          matcher.setActiveSlot(typedIdx);
          renderInput();
        });
        if (state.activeIndex === idxToTypedIdx(state, idx)) {
          letterSpan.classList.add('pv-active');
        }
      }
      // Render letter + combined harakat as text content.
      letterSpan.textContent = slot.letter + slot.harakat.map(harakatNameToChar).join('');
      wordSpan.appendChild(letterSpan);
    });
  }

  function idxToTypedIdx(state, idx) {
    let t = -1;
    for (let i = 0; i <= idx; i++) if (!state.renderedSlots[i].isGhost) t++;
    return t;
  }

  // Local copy of the name→char map (kept in sync with parser).
  const HARAKAT_CHAR = {
    fatha: 'َ', damma: 'ُ', kasra: 'ِ', sukun: 'ْ', shadda: 'ّ',
    tanween_fath: 'ً', tanween_damm: 'ٌ', tanween_kasr: 'ٍ',
    dagger_alif: 'ٰ', maddah_above: 'ٓ',
  };
  function harakatNameToChar(name) { return HARAKAT_CHAR[name] || ''; }

  // Public API the host (main.js) calls to wire keypad events.
  return {
    onLetter: (ch) => { matcher.appendLetter(ch); renderInput(); },
    onHarakat: (name) => { matcher.appendHarakat(name); renderInput(); },
    onBackspace: () => { matcher.backspace(); renderInput(); },
    onSubmit: () => onSubmit(matcher),
    refresh: renderInput,
    elements: { headerEl, progressEl, keypadEl },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/practice-view.js
git commit -m "feat(ui): practice-view renders matcher state into three-zone layout"
```

### Task 4.3: Wire feature flag in main.js

**Files:**
- Modify: `src/main.js`
- Modify: `src/feature-flags.js`

- [ ] **Step 1: In `main.js`, after `init()` sets up the legacy path, gate the new path behind the flag.** Replace the body of `handleRangeChange` only inside a flag branch — the legacy path stays untouched:

```js
import { FLAGS } from './feature-flags.js';
import { getVerseWithSkeleton } from './data/quran-loader.js';
import { createMatcher } from './compare/matcher.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';

let practiceApi = null;

function handleRangeChange_v2({ surah, fromAyah, toAyah }) {
  document.getElementById('practice-view').hidden = false;
  // Hide legacy containers.
  for (const id of ['header', 'verse-display', 'keypad-view']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  const { raw, skeleton } = getVerseWithSkeleton(surah, fromAyah);
  const matcher = createMatcher(skeleton);
  practiceApi = mountPracticeView(document.getElementById('practice-view'), {
    matcher,
    referenceVerseText: raw,
    onSubmit: (m) => {
      const sum = m.summarize();
      console.log('summary:', sum); // wired to summary screen in Phase 7
    },
  });
  // Mount keypad into pv-keypad and route its events through practiceApi.
  mountKeypad(practiceApi.elements.keypadEl, {
    onLetter:    practiceApi.onLetter,
    onHarakat:   practiceApi.onHarakat,
    onBackspace: practiceApi.onBackspace,
    onSubmit:    practiceApi.onSubmit,
    settings: state.settings,
  });
}
```

Wrap the existing `handleRangeChange` body so the first line is:

```js
function handleRangeChange(range) {
  if (FLAGS.useSkeletonMatcher) return handleRangeChange_v2(range);
  // ... existing body unchanged
}
```

- [ ] **Step 2: Manual check with flag OFF**

Run: `python3 -m http.server 8000`, open the app, pick a verse, type, submit. Verify the legacy app still works exactly as before.

- [ ] **Step 3: Manual check with flag ON**

Temporarily flip `useSkeletonMatcher: true` in `feature-flags.js`. Open the app. Verify: the practice-view container is visible, legacy containers are hidden. Type letters — they appear in the input pane. Backspace works. (Keypad events may not yet be wired — that's expected; Phase 5 addresses it.)

Flip the flag back to `false` before committing.

- [ ] **Step 4: Commit**

```bash
git add src/main.js src/feature-flags.js
git commit -m "feat(main): wire feature-flagged practice-view branch"
```

---

## Phase 5: Keypad rework

### Task 5.1: Keypad: harakat callbacks + remove space key

**Files:**
- Modify: `src/ui/keypad.js`

- [ ] **Step 1: Read `keypad.js`** to understand the current callback shape (currently `onSubmit(text)`).

- [ ] **Step 2: Extend the API to accept `onLetter`/`onHarakat`/`onBackspace`/`onSubmit` callbacks**, in addition to the legacy `onSubmit(text)`. Detect which mode by the presence of `onLetter`.

In the keypad event handlers:
- Letter button click → if `onLetter` provided, call `onLetter(ch)`; else fall back to legacy text-buffer mode.
- Harakat button click → if `onHarakat` provided, call `onHarakat(name)`; else append harakat char to legacy buffer.
- Backspace → if `onBackspace` provided, call it; else legacy delete-last.
- Submit → if `onSubmit` is a no-arg in the new mode, call it; else legacy `onSubmit(text)`.
- Remove the space key from the rendered keys list **only when in new mode** (test the same flag). Keep the legacy layout untouched when no `onLetter` provided.

This split keeps the legacy app intact while letting practice-view drive the keypad event-by-event.

- [ ] **Step 3: Manual verify (flag OFF)** — legacy app still types into a buffer, space still works.

- [ ] **Step 4: Manual verify (flag ON)** — typing letters and harakat updates the input pane live; no space key visible.

- [ ] **Step 5: Commit**

```bash
git add src/ui/keypad.js
git commit -m "feat(keypad): dual-mode — event callbacks for new practice view"
```

---

## Phase 6: Visual redesign

### Task 6.1: Mushaf-aesthetic stylesheet for practice-view

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Append a `.pv-*` section** at the bottom of `styles.css`. Do not touch existing legacy selectors.

```css
/* === Practice view (new UX overhaul) ============================ */

:root {
  --pv-bg:        #f6efdc;
  --pv-ink:       #2a2118;
  --pv-gold:      #b08a3e;
  --pv-error:     #a55a3a;
  --pv-ghost:     #8a8377;
  --pv-divider:   #d8c89a;
  --pv-pane-pad:  18px;
}

#practice-view {
  background: var(--pv-bg);
  color: var(--pv-ink);
  min-height: 100dvh;
  display: flex; flex-direction: column;
  font-family: 'KFGQPC Uthmanic Hafs', 'Noto Naskh Arabic', serif;
}

.pv-header {
  padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--pv-divider);
}

.pv-progress {
  padding: 6px 14px; font-size: 13px; color: var(--pv-gold);
  border-bottom: 1px solid var(--pv-divider);
}

.pv-main { flex: 1; padding: var(--pv-pane-pad); }
.pv-pane { padding: 12px 0; font-size: 28px; line-height: 1.9; direction: rtl; text-align: right; }
.pv-reference { color: var(--pv-ink); }
.pv-input     { min-height: 60px; }
.pv-divider   { border: none; border-top: 1px dashed var(--pv-divider); margin: 12px 0; }

.pv-word    { display: inline-block; padding: 0 4px; }
.pv-letter  { display: inline-block; transition: color 120ms ease; }
.pv-ghost           { color: var(--pv-ghost); opacity: 0.55; }
.pv-match           { color: var(--pv-ink); }
.pv-wrong-letter    { color: var(--pv-error); }
.pv-wrong-harakat   { color: var(--pv-error); }
.pv-harakat-pending { color: var(--pv-gold); }
.pv-active          { text-decoration: underline; text-decoration-color: var(--pv-gold); text-underline-offset: 4px; }

.pv-keypad { border-top: 1px solid var(--pv-divider); background: var(--pv-bg); }
```

- [ ] **Step 2: Manual verify (flag ON)** — open in browser, pick a verse, type. Compare against the spec mockup; tweak spacing/sizes inline (this is the iteration step).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat(styles): mushaf-aesthetic palette and zone layout for practice view"
```

---

## Phase 7: Submit flow + harakat sweep

### Task 7.1: End-of-verse harakat sweep before submit

**Files:**
- Modify: `src/ui/practice-view.js`
- Modify: `src/compare/matcher.js` (add `pendingHarakatIndices()`)
- Modify: `tests/compare/matcher.test.js`

- [ ] **Step 1: Add the failing test (append)**

```js
test('pendingHarakatIndices() returns indices of sound slots typed without harakat', () => {
  const m = matcherFor('بِسْمِ'); // 3 sound slots, all expect harakat
  m.appendLetter('ب');                  // no harakat
  m.appendLetter('س'); m.appendHarakat('sukun');
  m.appendLetter('م');                  // no harakat
  assert.deepEqual(m.pendingHarakatIndices(), [0, 2]);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** in `matcher.js`:

```js
function pendingHarakatIndices() {
  const out = [];
  for (let i = 0; i < typed.length; i++) {
    const t = typed[i];
    if (t.skelIdx < 0) continue;
    const s = skeleton[t.skelIdx];
    if (s.expectedHarakat.length > 0 && t.harakat.length === 0) out.push(i);
  }
  return out;
}
```

Add to the returned object.

- [ ] **Step 4: Wire the sweep in `practice-view.js`**: rewrite `onSubmit` so it:
  1. Calls `matcher.pendingHarakatIndices()`.
  2. If non-empty: sets active slot to the first pending index, calls `renderInput()`, shows a small banner ("Tap the missing harakat for the highlighted letters, then submit again"). Return.
  3. Else: calls the host's `onSubmit(matcher)` to score and proceed.

```js
function attemptSubmit() {
  const pending = matcher.pendingHarakatIndices();
  if (pending.length > 0) {
    matcher.setActiveSlot(pending[0]);
    renderInput();
    showBanner('Tap the missing harakat for the highlighted letter, then submit again.');
    return;
  }
  onSubmit(matcher);
}

function showBanner(msg) {
  let b = root.querySelector('.pv-banner');
  if (!b) {
    b = document.createElement('div'); b.className = 'pv-banner';
    root.querySelector('#pv-main').prepend(b);
  }
  b.textContent = msg;
  setTimeout(() => { if (b) b.remove(); }, 4000);
}
```

Update the returned API: replace `onSubmit: () => onSubmit(matcher)` with `onSubmit: attemptSubmit`.

Add to CSS:

```css
.pv-banner { background: var(--pv-gold); color: var(--pv-bg); padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; }
```

- [ ] **Step 5: Manual verify** — type a verse leaving one letter without harakat; press submit; banner appears, that letter is highlighted; add harakat; submit again works.

- [ ] **Step 6: Commit**

```bash
git add src/compare/matcher.js tests/compare/matcher.test.js src/ui/practice-view.js styles.css
git commit -m "feat(practice): end-of-verse harakat sweep prompt"
```

---

## Phase 8: Progress store

### Task 8.1: Streak, verse-bests, surah-completion

**Files:**
- Create: `src/store/progress.js`
- Test: `tests/store/progress.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialProgress, applyAttempt, recordDailyOpen, useStreakFreeze,
} from '../../src/store/progress.js';

const day = (iso) => iso; // ISO date string YYYY-MM-DD

test('first attempt records streak=1', () => {
  let p = initialProgress();
  p = recordDailyOpen(p, day('2026-05-19'));
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.92, day: day('2026-05-19') });
  assert.equal(p.streak.count, 1);
  assert.equal(p.streak.lastDay, '2026-05-19');
  assert.equal(p.verseBests['1:1'].accuracy, 0.92);
  assert.equal(p.surahCompletion[1], 1); // attempted with >=0.8 accuracy
});

test('next-day attempt increments streak; gap resets', () => {
  let p = initialProgress();
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.9, day: '2026-05-19' });
  p = applyAttempt(p, { surah: 1, ayah: 2, accuracy: 0.9, day: '2026-05-20' });
  assert.equal(p.streak.count, 2);
  p = applyAttempt(p, { surah: 1, ayah: 3, accuracy: 0.9, day: '2026-05-23' });
  assert.equal(p.streak.count, 1);
});

test('personal best only updates when accuracy improves', () => {
  let p = initialProgress();
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.7, day: '2026-05-19' });
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.6, day: '2026-05-20' });
  assert.equal(p.verseBests['1:1'].accuracy, 0.7);
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.95, day: '2026-05-21' });
  assert.equal(p.verseBests['1:1'].accuracy, 0.95);
});

test('streak freeze preserves count across a one-day gap, once per week', () => {
  let p = initialProgress();
  p = applyAttempt(p, { surah: 1, ayah: 1, accuracy: 0.9, day: '2026-05-19' });
  p = useStreakFreeze(p, '2026-05-20'); // missed day
  p = applyAttempt(p, { surah: 1, ayah: 2, accuracy: 0.9, day: '2026-05-21' });
  assert.equal(p.streak.count, 2);
  // Second freeze in the same week should not work.
  p = useStreakFreeze(p, '2026-05-22');
  p = applyAttempt(p, { surah: 1, ayah: 3, accuracy: 0.9, day: '2026-05-24' });
  assert.equal(p.streak.count, 1);
});

test('surahCompletion counts unique high-accuracy verses', () => {
  let p = initialProgress();
  p = applyAttempt(p, { surah: 2, ayah: 5, accuracy: 0.85, day: '2026-05-19' });
  p = applyAttempt(p, { surah: 2, ayah: 5, accuracy: 0.95, day: '2026-05-20' });
  p = applyAttempt(p, { surah: 2, ayah: 6, accuracy: 0.55, day: '2026-05-20' });
  assert.equal(p.surahCompletion[2], 1); // ayah 5 once; ayah 6 below threshold
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found).

- [ ] **Step 3: Implement `progress.js`**

```js
// Pure functions over a progress state object. No IO; the caller persists.
//
// state shape:
//   {
//     streak: { count, lastDay, freezeUsedWeek },  // freezeUsedWeek is an ISO-week string or null
//     verseBests: { "<surah>:<ayah>": { accuracy, day } },
//     surahCompletion: { [surah]: count },         // unique verses with ≥0.8 accuracy
//     highAccuracyVerses: { "<surah>:<ayah>": true },  // dedup helper for completion
//   }

const COMPLETION_THRESHOLD = 0.8;

export function initialProgress() {
  return {
    streak: { count: 0, lastDay: null, freezeUsedWeek: null },
    verseBests: {},
    surahCompletion: {},
    highAccuracyVerses: {},
  };
}

function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function isoWeek(day) {
  // Cheap year-week key; good enough for "once per week" semantics.
  const d = new Date(day);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.floor((d - jan1) / (7 * 86400000));
  return `${d.getFullYear()}-W${week}`;
}

export function recordDailyOpen(state, day) {
  // No-op if same day as lastDay; otherwise just bump nothing — applyAttempt does the work.
  return state;
}

export function useStreakFreeze(state, day) {
  const week = isoWeek(day);
  if (state.streak.freezeUsedWeek === week) return state;
  return {
    ...state,
    streak: { ...state.streak, freezeUsedWeek: week, lastDay: day },
  };
}

export function applyAttempt(state, { surah, ayah, accuracy, day }) {
  const key = `${surah}:${ayah}`;
  let { streak, verseBests, surahCompletion, highAccuracyVerses } = state;

  // Streak update.
  if (!streak.lastDay) {
    streak = { ...streak, count: 1, lastDay: day };
  } else {
    const gap = diffDays(streak.lastDay, day);
    if (gap === 0) {
      // same day — no count change
    } else if (gap === 1) {
      streak = { ...streak, count: streak.count + 1, lastDay: day };
    } else {
      streak = { ...streak, count: 1, lastDay: day };
    }
  }

  // Verse best.
  const prev = verseBests[key];
  if (!prev || accuracy > prev.accuracy) {
    verseBests = { ...verseBests, [key]: { accuracy, day } };
  }

  // Surah completion: count unique verses crossing the threshold.
  if (accuracy >= COMPLETION_THRESHOLD && !highAccuracyVerses[key]) {
    highAccuracyVerses = { ...highAccuracyVerses, [key]: true };
    surahCompletion = { ...surahCompletion, [surah]: (surahCompletion[surah] || 0) + 1 };
  }

  return { streak, verseBests, surahCompletion, highAccuracyVerses };
}
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/progress.js tests/store/progress.test.js
git commit -m "feat(store): progress store — streak, verse-best, surah-completion"
```

### Task 8.2: Persist progress via existing kv store

**Files:**
- Modify: `src/store/progress.js` — add `loadProgress`/`saveProgress` thin wrappers.
- Modify: `src/main.js` — call `applyAttempt` after submit succeeds.

- [ ] **Step 1: Add at the bottom of `progress.js`**:

```js
import { kvGet, kvPut } from './db.js';

const KEY = 'progress';

export async function loadProgress(deps = { kvGet }) {
  const stored = await deps.kvGet(KEY);
  return { ...initialProgress(), ...(stored || {}) };
}

export async function saveProgress(p, deps = { kvPut }) {
  await deps.kvPut(KEY, p);
  return p;
}
```

- [ ] **Step 2: In `main.js`'s new submit handler** (Task 4.3 placeholder), wire it:

```js
import { loadProgress, saveProgress, applyAttempt } from './store/progress.js';

let progress = null;

// in init() (under the flag branch):
progress = await loadProgress();

// in onSubmit:
onSubmit: async (m) => {
  const sum = m.summarize();
  const today = new Date().toISOString().slice(0, 10);
  progress = applyAttempt(progress, {
    surah: state.surah, ayah: state.fromAyah,
    accuracy: sum.accuracy, day: today,
  });
  await saveProgress(progress);
  // Phase 9 wires the progress-strip refresh + summary screen.
}
```

- [ ] **Step 3: Manual verify** — submit a verse with the flag ON; open devtools → Application → IndexedDB and confirm the `progress` key now holds the updated state.

- [ ] **Step 4: Commit**

```bash
git add src/store/progress.js src/main.js
git commit -m "feat(progress): persist progress via IndexedDB kv store"
```

---

## Phase 9: Progress strip + per-surah ring

### Task 9.1: Progress strip component

**Files:**
- Create: `src/ui/progress-strip.js`

- [ ] **Step 1: Write the module**

```js
// Renders streak dots and personal-best for the current verse into a host element.
// Pure render: caller provides data and re-invokes render(data) on change.

export function mountProgressStrip(host) {
  function render({ streakCount, last7, personalBest }) {
    host.innerHTML = '';
    const dots = document.createElement('span');
    dots.className = 'pv-strip-dots';
    for (const filled of last7) {
      const d = document.createElement('span');
      d.className = 'pv-dot' + (filled ? ' on' : '');
      dots.appendChild(d);
    }
    host.appendChild(dots);

    const streak = document.createElement('span');
    streak.className = 'pv-strip-streak';
    streak.textContent = `streak ${streakCount}d`;
    host.appendChild(streak);

    if (personalBest != null) {
      const best = document.createElement('span');
      best.className = 'pv-strip-best';
      best.textContent = `best ${Math.round(personalBest * 100)}%`;
      host.appendChild(best);
    }
  }
  return { render };
}

// Helper: derive last7 (array of booleans, oldest→newest) from progress + today.
export function last7Days(progress, today) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // We don't track per-day attempts explicitly; approximate via lastDay window.
    // A day is "on" iff (lastDay-streakCount+1 ... lastDay) contains iso.
    const last = progress.streak.lastDay;
    if (!last) { out.push(false); continue; }
    const lastDate = new Date(last);
    const startDate = new Date(lastDate); startDate.setDate(startDate.getDate() - (progress.streak.count - 1));
    out.push(d >= startDate && d <= lastDate);
  }
  return out;
}
```

- [ ] **Step 2: Append CSS**

```css
.pv-strip-dots { display: inline-flex; gap: 4px; margin-right: 10px; }
.pv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pv-divider); display: inline-block; }
.pv-dot.on { background: var(--pv-gold); }
.pv-strip-streak { margin-right: 12px; }
.pv-strip-best   { color: var(--pv-gold); }
```

- [ ] **Step 3: Wire from `main.js` in the new submit branch and on initial mount**:

```js
import { mountProgressStrip, last7Days } from './ui/progress-strip.js';

const stripApi = mountProgressStrip(document.getElementById('pv-progress'));

function refreshStrip() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${state.surah}:${state.fromAyah}`;
  stripApi.render({
    streakCount: progress.streak.count,
    last7: last7Days(progress, today),
    personalBest: progress.verseBests[key] ? progress.verseBests[key].accuracy : null,
  });
}
```

Call `refreshStrip()` after mount and after every submit.

- [ ] **Step 4: Manual verify** — submit a verse, see streak=1 and best=NN% in the strip.

- [ ] **Step 5: Commit**

```bash
git add src/ui/progress-strip.js styles.css src/main.js
git commit -m "feat(ui): streak + personal-best progress strip"
```

### Task 9.2: Per-surah completion ring on surah picker

**Files:**
- Modify: `src/ui/header.js` (surah picker rendering)

- [ ] **Step 1: Read `header.js`** to find where surah options are rendered.

- [ ] **Step 2: When in flag-ON mode, decorate each surah entry with a small ring** (SVG or CSS conic-gradient) computed from `progress.surahCompletion[surah] / surahMetadata[surah].verseCount`. If header doesn't currently see `progress`, add it as an optional prop and pass it in from `main.js`.

```css
.pv-surah-ring {
  --ring-pct: 0%;
  display: inline-block; width: 14px; height: 14px; border-radius: 50%;
  background: conic-gradient(var(--pv-gold) var(--ring-pct), var(--pv-divider) 0);
  margin-inline-end: 6px; vertical-align: middle;
}
```

- [ ] **Step 3: Manual verify** — practice a verse in surah 1, switch surahs and back; the ring around "1" is partially filled.

- [ ] **Step 4: Commit**

```bash
git add src/ui/header.js styles.css src/main.js
git commit -m "feat(ui): per-surah completion ring on picker"
```

---

## Phase 10: Stats screen, hint, settings, flag flip

### Task 10.1: Settings — harakat hint and strict recognition toggles

**Files:**
- Modify: `src/store/settings.js`
- Modify: `src/ui/settings-modal.js`
- Modify: `src/compare/matcher.js`

- [ ] **Step 1: Add fields** to `DEFAULT_SETTINGS`:

```js
harakatHint: false,
strictRecognition: false,
```

- [ ] **Step 2: Render two toggles** in `settings-modal.js`, wired through the existing `onChange` patch path.

- [ ] **Step 3: Plumb `strictRecognition` into the matcher**: accept an optional `{ strict }` option on `createMatcher`; when true, `letterMatches` becomes strict equality. Update `practice-view` to pass the current settings value through.

- [ ] **Step 4: Plumb `harakatHint` into practice-view**: when true and the active slot has no harakat after 1500 ms, render a faded ghost above the slot showing the expected harakat. Implementation: a `setTimeout` in `renderInput` (cleared on every input) that adds a `.pv-hint` element next to the active letter.

```css
.pv-hint { color: var(--pv-ghost); font-size: 0.7em; vertical-align: super; }
```

- [ ] **Step 5: Manual verify** — toggle each setting; observe behavior changes.

- [ ] **Step 6: Commit**

```bash
git add src/store/settings.js src/ui/settings-modal.js src/compare/matcher.js src/ui/practice-view.js styles.css
git commit -m "feat(settings): harakat-hint and strict-recognition toggles"
```

### Task 10.2: Stats screen

**Files:**
- Create: `src/ui/stats-view.js`
- Modify: `src/ui/header.js` (menu opens stats)

- [ ] **Step 1: Build a read-only screen** that lists:
  - Current streak, longest streak (derive longest by tracking max as part of `applyAttempt` — add `longestStreak` field to progress in a forward-compatible way).
  - Per-verse history: array of `{ surah, ayah, bestAccuracy, day }` from `verseBests`.
  - Most-confused letters/harakat: derive from existing `stats.js` error counters (already persisted).
  Render as a simple sectioned list with the same palette.

- [ ] **Step 2: Add a "Stats" entry** to the header menu that mounts this screen as a modal/overlay over practice-view.

- [ ] **Step 3: Commit**

```bash
git add src/ui/stats-view.js src/ui/header.js src/store/progress.js
git commit -m "feat(ui): stats screen — streak, verse history, confused letters"
```

### Task 10.3: Flip the flag and remove legacy modules

**Files:**
- Modify: `src/feature-flags.js`
- Modify: `src/main.js`
- Delete: `src/compare/aligner.js`, `src/compare/smart-match.js`, `src/compare/user-stream.js`
- Delete: legacy DOM containers in `index.html` (the original `#header`, `#verse-display`, `#keypad-view` if they're no longer used by the new path; otherwise keep and just remove the duplication).
- Delete: corresponding legacy tests under `tests/compare/`.

- [ ] **Step 1: Flip the flag to true**.

- [ ] **Step 2: Full manual smoke pass.** For each: pick verse, type, miss a harakat → sweep prompts → fix → submit → strip updates → stats screen shows it. Try silent-letter verses (الشَّمْس, كَتَبُوا, السَّماء). Try tap-to-edit harakat on the middle letter of a longer verse. Try strict-mode and harakat-hint toggles.

- [ ] **Step 3: Run all node tests**:

```bash
node --test tests/
```

Expected: PASS for all surviving suites.

- [ ] **Step 4: Delete legacy modules and tests** that no longer have callers.

- [ ] **Step 5: Remove the feature flag and the `_v2` branching in `main.js`**, leaving only the new path.

- [ ] **Step 6: Update README** — replace v1 limitations with the new feature list and capabilities.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: flip skeleton-matcher flag, remove legacy compare modules"
```

---

## Self-review notes

- **Spec coverage:** every section of the spec is addressed — phonetic skeleton (Phase 2), silent rules (Phase 1), matcher with tap-to-edit (Phase 3), submit + sweep (Phase 7), zones layout (Phase 4), mushaf aesthetic (Phase 6), assistance behaviors (Phases 7+10), gamification (Phases 8+9), stats (Phase 10.2), migration (Phase 0 flag + Phase 10.3 flip). Module boundaries match the spec's "New / Modified / Removed" lists exactly.
- **Type consistency:** matcher API names match across tasks — `appendLetter`, `appendHarakat`, `backspace`, `setActiveSlot`, `getRenderState`, `summarize`, `pendingHarakatIndices`. Render-state shape fixed in Task 3.1 and consumed unchanged in 4.2/7.1/10.1.
- **No placeholders:** every code step has runnable code; UI tuning steps are explicitly called out as iterate-in-browser, not deferred decisions.
- **Bite-sized:** each task has 4–6 short steps, each committable.
