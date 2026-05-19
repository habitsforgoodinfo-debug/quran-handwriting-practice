# Karaoke Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the batch-submit practice loop with a live per-keystroke karaoke-trace interaction backed by a phonetic-skeleton matcher, slim the keypad, swap the palette to Duolingo-light, and kill the session-end modal.

**Architecture:** A canonical verse is preprocessed into an ordered list of slots (`sound` / `silent` / `wordEnd`). A stateful matcher walks the skeleton, accepting only the expected letter then the expected harakat for each sound slot. Wrong keystrokes hard-block (no insertion) and are logged. Silent letters and word boundaries are auto-consumed. The view re-renders from matcher state.

**Tech Stack:** Vanilla ES modules, `node:test` runner, in-house DOM stub (`tests/_helpers/dom-stub.js`), IndexedDB persistence, no build step.

**Spec:** `docs/superpowers/specs/2026-05-19-karaoke-trace-design.md`

**Conventions:**
- Test runner: `node --test tests/<path>/<file>.test.js`
- Full suite: `node --test tests/`
- Every task ends with a green-test commit. Commit message prefix matches the change: `feat:`, `test:`, `refactor:`, `chore:`.
- Do **not** touch `src/main.js`, `styles.css`, or `index.html` until Task 8. All earlier tasks add isolated modules that the new main wires together at the end.

---

## File map

**New (created by this plan):**
- `src/verse/silent-rules.js`
- `src/verse/skeleton.js`
- `src/compare/live-matcher.js`
- `src/ui/practice-view.js`
- `src/ui/heatmap-strip.js`
- `tests/verse/silent-rules.test.js`
- `tests/verse/skeleton.test.js`
- `tests/compare/live-matcher.test.js`
- `tests/ui/practice-view.test.js`
- `tests/ui/heatmap-strip.test.js`

**Rewritten:**
- `src/ui/keypad.js`
- `src/store/settings.js` (new fields only)
- `src/ui/settings-modal.js` (one new row)
- `src/store/stats.js` (adds `getWorst`)
- `src/main.js`
- `styles.css`
- `service-worker.js` (cache bump only)
- `tests/ui/keypad.test.js` (if exists) — otherwise created

**Deleted (in Task 8):**
- `src/ui/verse-display.js` (and its test)
- `src/ui/summary.js`
- `src/ui/canvas-view.js` (already unused)
- `src/compare/user-stream.js` (no longer needed — see Task 5 note)
- `src/compare/smart-match.js` *public* API; tolerance helpers extracted to `src/compare/tolerance.js` in Task 4

---

## Task 1: Add `hintLevel` and `strict` to settings

**Files:**
- Modify: `src/store/settings.js`
- Modify: `tests/store/settings.test.js`

- [ ] **Step 1: Add the failing test**

Append to `tests/store/settings.test.js`:

```js
test('settings: defaults include hintLevel="letter" and strict=false', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.hintLevel, 'letter');
  assert.equal(s.strict, false);
});

test('settings: hintLevel can be updated and persists', async () => {
  const db = makeMockDb();
  await updateSettings({ hintLevel: 'full' }, db);
  const s = await getSettings(db);
  assert.equal(s.hintLevel, 'full');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/store/settings.test.js`
Expected: 2 failing tests with `undefined !== 'letter'` and `undefined !== false`.

- [ ] **Step 3: Implement**

Edit `src/store/settings.js` — extend `DEFAULT_SETTINGS`:

```js
export const DEFAULT_SETTINGS = Object.freeze({
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4,
  script: 'indopak',
  hintLevel: 'letter',
  strict: false
});
```

- [ ] **Step 4: Re-run tests, confirm green**

Run: `node --test tests/store/settings.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/settings.js tests/store/settings.test.js
git commit -m "feat(settings): add hintLevel and strict toggles"
```

---

## Task 2: `stats.getWorst(n, window)` for heatmap

**Files:**
- Modify: `src/store/stats.js`
- Modify: `tests/store/stats.test.js`

**Note:** The current `recordError` only tracks counts, not timestamps, so a true rolling window requires schema work. For v1 we store *all-time* counts and expose `getWorst(n)` ignoring the window arg. Document this in code and revisit when usage warrants. (This is intentional YAGNI — the heatmap UI does not depend on the windowing.)

- [ ] **Step 1: Write the failing test**

Append to `tests/store/stats.test.js`:

```js
import { getWorst } from '../../src/store/stats.js';

test('getWorst: returns top-n letter and diacritic errors by count', async () => {
  const letterMap = new Map([['ع', 5], ['ت', 2], ['ج', 9]]);
  const diaMap    = new Map([['shadda', 7], ['fatha', 1]]);
  const deps = {
    counterAll: async (store) =>
      store === 'letterErrors'
        ? Object.fromEntries(letterMap)
        : Object.fromEntries(diaMap)
  };
  const worst = await getWorst(3, deps);
  // expect 3 chips, sorted by count desc, across both kinds
  assert.equal(worst.length, 3);
  assert.deepEqual(worst[0], { kind: 'letter', value: 'ج', count: 9 });
  assert.deepEqual(worst[1], { kind: 'diacritic', value: 'shadda', count: 7 });
  assert.deepEqual(worst[2], { kind: 'letter', value: 'ع', count: 5 });
});

test('getWorst: returns empty array when no errors recorded', async () => {
  const deps = { counterAll: async () => ({}) };
  const worst = await getWorst(3, deps);
  assert.deepEqual(worst, []);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/store/stats.test.js`
Expected: `getWorst` is not exported.

- [ ] **Step 3: Implement**

Append to `src/store/stats.js`:

```js
// Returns the top-n (letter, diacritic) error counts sorted desc.
// `window` arg reserved for future timestamped rollup; ignored for now.
export async function getWorst(n, deps = { counterAll }) {
  const [letters, dias] = await Promise.all([
    deps.counterAll('letterErrors'),
    deps.counterAll('diacriticErrors')
  ]);
  const items = [
    ...Object.entries(letters).map(([value, count]) => ({ kind: 'letter', value, count })),
    ...Object.entries(dias).map(([value, count]) => ({ kind: 'diacritic', value, count }))
  ];
  items.sort((a, b) => b.count - a.count);
  return items.slice(0, n);
}
```

- [ ] **Step 4: Re-run, confirm green**

- [ ] **Step 5: Commit**

```bash
git add src/store/stats.js tests/store/stats.test.js
git commit -m "feat(stats): add getWorst(n) for heatmap surface"
```

---

## Task 3: Silent-letter rule predicates

**Files:**
- Create: `src/verse/silent-rules.js`
- Create: `tests/verse/silent-rules.test.js`

A *silent* letter is one that exists in the canonical script but is not pronounced — it should be auto-inserted by the matcher instead of typed by the user. Rules operate on the **glyph list** produced by `parseWord(word)` (see `src/verse/parser.js`), which gives us `{ letter, diacritics }` per glyph plus already-computed `isSilent` and `isMaddAlif` flags.

For the karaoke-trace skeleton we need a single predicate `isSilentInWord(glyphs, index)` that returns true when glyph `index` should be a `silent` skeleton slot rather than a `sound` slot. We *reuse* the existing parser's `isSilent` (bare letter with no harakat) and `isMaddAlif` (alif lengthening a preceding fatha) flags, and add the specific patterns the spec calls out beyond those.

- [ ] **Step 1: Write the failing tests**

Create `tests/verse/silent-rules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWord } from '../../src/verse/parser.js';
import { isSilentInWord } from '../../src/verse/silent-rules.js';

function silentMap(word) {
  const glyphs = parseWord(word);
  return glyphs.map((_, i) => isSilentInWord(glyphs, i));
}

test('silent-rules: sun-letter alif after definite article (الشَّمْس)', () => {
  // ا ل ش(shadda+fatha) م(sukun) س
  // Index 0 = alif → silent (definite article alif before sun letter)
  // Index 1 = lam → silent (assimilated into shadda)
  const m = silentMap('الشَّمْسِ');
  assert.equal(m[0], true);   // alif silent
  assert.equal(m[1], true);   // lam silent (sun-letter assimilation)
});

test('silent-rules: moon-letter lam after definite article (الْقَمَر) — lam pronounced', () => {
  const m = silentMap('الْقَمَرِ');
  assert.equal(m[0], true);   // alif still silent
  assert.equal(m[1], false);  // lam pronounced (has sukun → sound slot)
});

test('silent-rules: plural-masculine alif (كَتَبُوا) — final alif silent', () => {
  const m = silentMap('كَتَبُوا');
  assert.equal(m[m.length - 1], true);
});

test('silent-rules: madd alif (قَالَ) — alif silent', () => {
  const glyphs = parseWord('قَالَ');
  // alif at idx 1 lengthens fatha on قَ → silent
  assert.equal(isSilentInWord(glyphs, 1), true);
});

test('silent-rules: ordinary letter with harakat is NOT silent', () => {
  const m = silentMap('قَالَ');
  assert.equal(m[0], false); // ق with fatha
  assert.equal(m[2], false); // ل with fatha
});

test('silent-rules: dagger alif on base letter — the base letter is sound, dagger alif itself is a diacritic not a glyph', () => {
  // Confirm the parser produces no separate alif glyph for ٰ (it is a combining mark).
  const glyphs = parseWord('هَٰذَا');
  assert.ok(glyphs.every(g => g.letter !== 'ٰ'));
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/verse/silent-rules.test.js`
Expected: `Cannot find module` / `isSilentInWord is not exported`.

- [ ] **Step 3: Implement**

Create `src/verse/silent-rules.js`:

```js
// A glyph at `index` in a parsed word is "silent" (skeleton emits a silent slot)
// when:
//   1. The parser already flagged it (no diacritic AND not a madd alif extending
//      a preceding fatha — wait, isSilent is set true when no mark AND not madd).
//      We invert that: anything the parser flagged `isSilent` is silent here too.
//   2. It is a madd alif (alif lengthening a preceding fatha) — pronounced as
//      vowel lengthening, not a separate consonant. We treat as silent.
//   3. Sun-letter assimilation: a lam carrying sukun after a definite-article
//      alif but immediately followed by a "sun letter" (the letter that absorbs
//      the lam). The parser does not detect this; we add a rule.
//
// All other glyphs are sound.

const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

const ALIF = 'ا';
const ALIF_WASLA = 'ٱ';
const LAM = 'ل';

export function isSilentInWord(glyphs, index) {
  const g = glyphs[index];
  if (!g) return false;
  if (g.isSilent) return true;
  if (g.isMaddAlif) return true;

  // Sun-letter rule: definite-article alif (idx 0 = ا or ٱ) + lam (idx 1)
  // followed by a sun letter (idx 2). The lam is silent in pronunciation.
  if (index === 1
      && g.letter === LAM
      && (glyphs[0]?.letter === ALIF || glyphs[0]?.letter === ALIF_WASLA)
      && glyphs[2]
      && SUN_LETTERS.has(glyphs[2].letter)
      && glyphs[2].diacritics.includes('shadda')) {
    return true;
  }

  return false;
}
```

- [ ] **Step 4: Re-run, confirm all pass**

Run: `node --test tests/verse/silent-rules.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/verse/silent-rules.js tests/verse/silent-rules.test.js
git commit -m "feat(verse): silent-letter rules incl. sun-letter assimilation"
```

---

## Task 4: Skeleton builder + tolerance extraction

**Files:**
- Create: `src/verse/skeleton.js`
- Create: `src/compare/tolerance.js`
- Create: `tests/verse/skeleton.test.js`

The skeleton flattens a parsed verse into one linear `Slot[]` with stable indices. Each `sound` slot's `expectedHarakat` is computed from its glyph's `diacritics`:

- `none` if empty.
- `{ shadda: true, vowel: <one of fatha|kasra|damma|tanween_*> }` if both shadda and a vowel are present.
- `{ shadda: true }` if only shadda.
- `{ vowel: <name> }` otherwise.

Diacritics that aren't part of this set (e.g. dagger alif, high madda) are stored on the slot under `extraDiacritics` so the renderer can show them but the matcher does not gate on them.

**Tolerance extraction:** `src/compare/smart-match.js` already exists with letter-set tolerances. Pull the equivalence sets into `src/compare/tolerance.js` so both the old batch matcher and the new live matcher import from one place. The old `smart-match.js` keeps working until Task 8 deletes it; this task only *adds* `tolerance.js` without touching `smart-match.js`.

- [ ] **Step 1: Write the failing tests**

Create `tests/verse/skeleton.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';

function kinds(slots) { return slots.map(s => s.kind); }

test('skeleton: simple verse — sound slots + wordEnd marker per word', () => {
  // "قُلْ هُوَ"  → ق(damma) ل(sukun) [wordEnd] ه(damma) و(fatha) [wordEnd]
  const slots = buildSkeleton('قُلْ هُوَ');
  assert.deepEqual(kinds(slots), ['sound','sound','wordEnd','sound','sound','wordEnd']);
  assert.equal(slots[0].letter, 'ق');
  assert.deepEqual(slots[0].expectedHarakat, { vowel: 'damma' });
  assert.equal(slots[1].letter, 'ل');
  assert.deepEqual(slots[1].expectedHarakat, { vowel: 'sukun' });
});

test('skeleton: madd alif becomes silent slot', () => {
  // "قَالَ" → ق(fatha, sound) | ا (silent — madd) | ل(fatha, sound) | [wordEnd]
  const slots = buildSkeleton('قَالَ');
  assert.deepEqual(kinds(slots), ['sound','silent','sound','wordEnd']);
  assert.equal(slots[1].letter, 'ا');
});

test('skeleton: shadda + fatha → expectedHarakat has both', () => {
  // first letter of "إِنَّا" — ن with shadda+fatha
  const slots = buildSkeleton('إِنَّا');
  const nun = slots.find(s => s.letter === 'ن');
  assert.deepEqual(nun.expectedHarakat, { shadda: true, vowel: 'fatha' });
});

test('skeleton: sun-letter article — alif and lam both silent', () => {
  // "الشَّمْسِ" → silent ا, silent ل, sound ش(shadda+fatha), sound م(sukun), sound س(kasra)
  const slots = buildSkeleton('الشَّمْسِ');
  assert.deepEqual(
    kinds(slots).slice(0, 5),
    ['silent','silent','sound','sound','sound']
  );
});

test('skeleton: wordIdx increases per word, canonicalIdx points into raw string', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const w0 = slots.filter(s => s.wordIdx === 0 && s.kind !== 'wordEnd');
  const w1 = slots.filter(s => s.wordIdx === 1 && s.kind !== 'wordEnd');
  assert.equal(w0.length, 2);
  assert.equal(w1.length, 2);
});

test('skeleton: tanween fath at end of word', () => {
  const slots = buildSkeleton('كِتَابً'); // contrived; ب + tanween_fath
  const last = slots[slots.length - 2]; // before wordEnd
  assert.deepEqual(last.expectedHarakat, { vowel: 'tanween_fath' });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/verse/skeleton.test.js`
Expected: module-not-found.

- [ ] **Step 3: Implement skeleton**

Create `src/verse/skeleton.js`:

```js
import { parseVerse } from './parser.js';
import { isSilentInWord } from './silent-rules.js';

const VOWELS = new Set(['fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm']);

function harakatFor(glyph) {
  const has = (n) => glyph.diacritics.includes(n);
  const shadda = has('shadda');
  const vowel = glyph.diacritics.find(d => VOWELS.has(d));
  const extra = glyph.diacritics.filter(d => d !== 'shadda' && !VOWELS.has(d));
  if (!shadda && !vowel) return { none: true, extra };
  const out = {};
  if (shadda) out.shadda = true;
  if (vowel)  out.vowel  = vowel;
  if (extra.length) out.extra = extra;
  return out;
}

export function buildSkeleton(rawVerse) {
  const words = parseVerse(rawVerse);
  const slots = [];
  let canonicalIdx = 0; // approximate — count base letters
  for (let wi = 0; wi < words.length; wi++) {
    const glyphs = words[wi];
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      const silent = isSilentInWord(glyphs, gi);
      slots.push({
        kind: silent ? 'silent' : 'sound',
        letter: g.letter,
        expectedHarakat: harakatFor(g),
        wordIdx: wi,
        canonicalIdx: canonicalIdx++
      });
    }
    slots.push({ kind: 'wordEnd', wordIdx: wi });
  }
  return slots;
}
```

- [ ] **Step 4: Re-run skeleton tests, confirm green**

Run: `node --test tests/verse/skeleton.test.js`
Expected: 6/6 pass.

- [ ] **Step 5: Extract tolerance module**

Create `src/compare/tolerance.js`:

```js
// Letter-equivalence sets used by the live matcher. A user-typed letter
// counts as "accepted" against an expected letter if they share a class.
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
```

- [ ] **Step 6: Commit**

```bash
git add src/verse/skeleton.js src/compare/tolerance.js tests/verse/skeleton.test.js
git commit -m "feat(verse): phonetic skeleton builder + tolerance module"
```

---

## Task 5: Live matcher

**Files:**
- Create: `src/compare/live-matcher.js`
- Create: `tests/compare/live-matcher.test.js`

The matcher is the heart of the karaoke loop. It is a pure stateful object — no DOM, no IO. Given a skeleton, it accepts one keypress at a time and reports accepted/rejected.

**Mental model of `awaiting`:**
- `letter` — pointing at a `sound` slot and expecting its letter as the next event.
- `harakat` — letter was just accepted; expecting that slot's vowel/shadda diacritics. If the slot's `expectedHarakat` is `{ none: true }`, the matcher auto-advances without ever entering `harakat`.
- `done` — past the last slot.

**Auto-consume rule:** after any successful advance, the matcher walks forward over consecutive `silent` and `wordEnd` slots, emitting them into `autoInserted`, until it lands on either a `sound` slot (set `awaiting = 'letter'`) or the end (set `awaiting = 'done'`).

**Shadda handling:** if `expectedHarakat.shadda === true`, both shadda and the vowel must be entered (in either order) before the slot is sealed. Internally track `pendingShadda: bool` and `pendingVowel: bool`.

- [ ] **Step 1: Write the failing tests**

Create `tests/compare/live-matcher.test.js`:

```js
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
  const before = { ...m.state };
  const r = m.tryLetter('ك');
  assert.equal(r.accepted, false);
  assert.equal(m.state.slotIdx, before.slotIdx);
  assert.equal(m.state.awaiting, 'letter');
});

test('matcher: accepts correct letter, moves to harakat', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  const r = m.tryLetter('ق');
  assert.equal(r.accepted, true);
  assert.equal(m.state.awaiting, 'harakat');
});

test('matcher: rejects wrong harakat, no advance', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق');
  const r = m.tryHarakat(HARAKAT.fatha);
  assert.equal(r.accepted, false);
  assert.equal(m.state.awaiting, 'harakat');
});

test('matcher: full word قُلْ → all four keypresses accepted, then done', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.tryLetter('ق').accepted, true);
  assert.equal(m.tryHarakat(HARAKAT.damma).accepted, true);
  assert.equal(m.tryLetter('ل').accepted, true);
  const last = m.tryHarakat(HARAKAT.sukun);
  assert.equal(last.accepted, true);
  assert.equal(last.complete, true);
  assert.equal(m.state.awaiting, 'done');
});

test('matcher: silent slots auto-consumed — قَالَ skips madd alif', () => {
  const m = new LiveMatcher(buildSkeleton('قَالَ'));
  m.tryLetter('ق');
  m.tryHarakat(HARAKAT.fatha);
  // Next expected sound is ل (not ا)
  assert.equal(m.state.awaiting, 'letter');
  assert.equal(m.tryLetter('ا').accepted, false);
  assert.equal(m.tryLetter('ل').accepted, true);
});

test('matcher: shadda+fatha accepted in either order', () => {
  // إنَّا — first sound after silent alif is ن(shadda+fatha)
  const m1 = new LiveMatcher(buildSkeleton('إِنَّا'));
  // walk past initial epsilon: hamza-alif glyph is sound? Actually إ has kasra.
  // ا (idx 0) → sound ا with kasra; ن (idx 1) → sound shadda+fatha; ا (idx 2) → silent madd.
  m1.tryLetter('ا'); m1.tryHarakat(HARAKAT.kasra);
  m1.tryLetter('ن'); m1.tryHarakat(HARAKAT.shadda); m1.tryHarakat(HARAKAT.fatha);
  assert.equal(m1.state.awaiting, 'letter'); // moved past ن

  const m2 = new LiveMatcher(buildSkeleton('إِنَّا'));
  m2.tryLetter('ا'); m2.tryHarakat(HARAKAT.kasra);
  m2.tryLetter('ن'); m2.tryHarakat(HARAKAT.fatha); m2.tryHarakat(HARAKAT.shadda);
  assert.equal(m2.state.awaiting, 'letter');
});

test('matcher: tolerance — ت accepted for expected ة', () => {
  const m = new LiveMatcher(buildSkeleton('ة'), { strict: false });
  // 1-glyph "verse" — sound ة with no harakat
  assert.equal(m.tryLetter('ت').accepted, true);
});

test('matcher: strict mode disables tolerance', () => {
  const m = new LiveMatcher(buildSkeleton('ة'), { strict: true });
  assert.equal(m.tryLetter('ت').accepted, false);
});

test('matcher: backspace undoes last sound slot', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق'); m.tryHarakat(HARAKAT.damma);
  m.tryLetter('ل');
  m.backspace();
  assert.equal(m.state.awaiting, 'letter');
  assert.equal(m.state.slotIdx, 2); // back to ل-expecting slot (after ق at idx 0,1)
});

test('matcher: nextHint returns expected letter when awaiting letter', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.nextHint().letter, 'ق');
  assert.equal(m.nextHint().harakat, undefined);
  m.tryLetter('ق');
  assert.equal(m.nextHint().letter, undefined);
  assert.equal(m.nextHint().harakat, HARAKAT.damma);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/compare/live-matcher.test.js`
Expected: module-not-found.

- [ ] **Step 3: Implement**

Create `src/compare/live-matcher.js`:

```js
import { lettersEquivalent } from './tolerance.js';

const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ'
};
const HARAKAT_NAME = Object.fromEntries(
  Object.entries(HARAKAT_CHAR).map(([n, c]) => [c, n])
);

export class LiveMatcher {
  constructor(skeleton, { strict = false } = {}) {
    this.skeleton = skeleton;
    this.strict = strict;
    this.state = {
      slotIdx: 0,
      awaiting: 'letter',
      typed: [],
      pendingShadda: false,
      pendingVowel: false
    };
    this._advanceToNextSound(/*emitAutoInserted*/ []);
  }

  // Walk past silent / wordEnd from current slotIdx, recording them in `inserted`.
  // Sets awaiting='letter' if it lands on a sound slot, 'done' at end.
  _advanceToNextSound(inserted) {
    while (this.state.slotIdx < this.skeleton.length) {
      const s = this.skeleton[this.state.slotIdx];
      if (s.kind === 'silent' || s.kind === 'wordEnd') {
        inserted.push(s);
        this.state.typed.push({ kind: s.kind, letter: s.letter, slotIdx: this.state.slotIdx });
        this.state.slotIdx++;
        continue;
      }
      // sound slot
      this.state.awaiting = 'letter';
      this._resetPendingForCurrent();
      return;
    }
    this.state.awaiting = 'done';
  }

  _resetPendingForCurrent() {
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || slot.kind !== 'sound') return;
    const eh = slot.expectedHarakat;
    this.state.pendingShadda = !!eh.shadda;
    this.state.pendingVowel  = !!eh.vowel;
  }

  tryLetter(ch) {
    if (this.state.awaiting !== 'letter') {
      return { accepted: false, autoInserted: [] };
    }
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || slot.kind !== 'sound') return { accepted: false, autoInserted: [] };
    if (!lettersEquivalent(ch, slot.letter, { strict: this.strict })) {
      return { accepted: false, autoInserted: [] };
    }
    this.state.typed.push({ kind: 'sound', letter: slot.letter, slotIdx: this.state.slotIdx });

    if (slot.expectedHarakat.none) {
      // seal immediately, advance past this sound slot
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, autoInserted: inserted, complete: this.state.awaiting === 'done' };
    }
    this.state.awaiting = 'harakat';
    return { accepted: true, autoInserted: [] };
  }

  tryHarakat(ch) {
    if (this.state.awaiting !== 'harakat') return { accepted: false };
    const slot = this.skeleton[this.state.slotIdx];
    const eh = slot.expectedHarakat;
    const name = HARAKAT_NAME[ch];
    if (!name) return { accepted: false };

    if (name === 'shadda') {
      if (!this.state.pendingShadda) return { accepted: false };
      this.state.pendingShadda = false;
    } else {
      if (!this.state.pendingVowel || eh.vowel !== name) return { accepted: false };
      this.state.pendingVowel = false;
    }

    // attach to the most recent typed sound
    const lastSound = [...this.state.typed].reverse().find(t => t.kind === 'sound');
    lastSound.harakat = (lastSound.harakat || '') + ch;

    if (!this.state.pendingShadda && !this.state.pendingVowel) {
      // slot sealed
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, complete: this.state.awaiting === 'done', autoInserted: inserted };
    }
    return { accepted: true, complete: false, autoInserted: [] };
  }

  backspace() {
    // Pop trailing silent/wordEnd entries, then one sound entry.
    while (this.state.typed.length) {
      const last = this.state.typed[this.state.typed.length - 1];
      this.state.typed.pop();
      this.state.slotIdx = last.slotIdx;
      if (last.kind === 'sound') break;
    }
    this._resetPendingForCurrent();
    this.state.awaiting = 'letter';
  }

  nextHint() {
    if (this.state.awaiting === 'letter') {
      const slot = this.skeleton[this.state.slotIdx];
      return { letter: slot?.letter };
    }
    if (this.state.awaiting === 'harakat') {
      const slot = this.skeleton[this.state.slotIdx];
      const eh = slot.expectedHarakat;
      // Show shadda first if pending, else vowel.
      if (this.state.pendingShadda) return { harakat: HARAKAT_CHAR.shadda };
      if (this.state.pendingVowel && eh.vowel) return { harakat: HARAKAT_CHAR[eh.vowel] };
    }
    return {};
  }
}
```

- [ ] **Step 4: Run, iterate until all 10 tests pass**

Run: `node --test tests/compare/live-matcher.test.js`
Expected: 10/10 pass. If something fails, narrow in on the failing case before adjusting code — do not rewrite the matcher wholesale.

- [ ] **Step 5: Commit**

```bash
git add src/compare/live-matcher.js tests/compare/live-matcher.test.js
git commit -m "feat(compare): live matcher with hard-block + auto-consume + shadda"
```

---

## Task 6: Rewrite the keypad

**Files:**
- Rewrite: `src/ui/keypad.js`
- Rewrite or create: `tests/ui/keypad.test.js`

New keypad contract — slimmer surface, hint and shake APIs:

```js
mountKeypad(root, {
  onLetter(ch),       // user tapped a letter key
  onHarakat(ch),      // user tapped a harakat key (incl. shadda + tanween)
  onBackspace(),
  onPlayAudio()
}) → {
  setHint({ letter, harakat }),   // glow the indicated keys (undefined = clear that side)
  flashWrong(ch),                 // shake the key whose face is `ch`
  destroy()
}
```

What is gone vs. current keypad: the extras row, the input preview div, the space key, the clear key, the submit key, and the long-press madd. Long-press behavior is dropped — every harakat is a single tap (the madd char `ٓ` is rarely a user input target anyway; if needed we add it to the extras palette later).

What stays: top harakat row, three letter rows. Action row now has `⌫` and `▶`.

- [ ] **Step 1: Write the failing tests**

Replace (or create) `tests/ui/keypad.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountKeypad } from '../../src/ui/keypad.js';

function setup() {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { letter: [], harakat: [], backspace: 0, audio: 0 };
  const api = mountKeypad(root, {
    onLetter:    (c) => calls.letter.push(c),
    onHarakat:   (c) => calls.harakat.push(c),
    onBackspace: () => calls.backspace++,
    onPlayAudio: () => calls.audio++
  });
  return { root, api, calls };
}

test('keypad: tapping a letter key fires onLetter with that char', () => {
  const { root, calls } = setup();
  const qaf = root.querySelectorAll('.key--letter').find(b => b.textContent === 'ق');
  qaf.dispatch('click');
  assert.deepEqual(calls.letter, ['ق']);
});

test('keypad: tapping a harakat key fires onHarakat with the combining char', () => {
  const { root, calls } = setup();
  const fatha = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('َ'));
  fatha.dispatch('click');
  assert.deepEqual(calls.harakat, ['َ']);
});

test('keypad: ⌫ fires onBackspace, ▶ fires onPlayAudio', () => {
  const { root, calls } = setup();
  const back  = root.querySelectorAll('.key--action').find(b => b.textContent === '⌫');
  const audio = root.querySelectorAll('.key--action').find(b => b.textContent.includes('▶'));
  back.dispatch('click');
  audio.dispatch('click');
  assert.equal(calls.backspace, 1);
  assert.equal(calls.audio, 1);
});

test('keypad: no Submit, no Space, no Clear, no extras row', () => {
  const { root } = setup();
  const labels = root.querySelectorAll('.key').map(b => b.textContent);
  assert.ok(!labels.some(l => /submit/i.test(l)));
  assert.ok(!labels.some(l => /space/i.test(l) || l === ' '));
  assert.ok(!labels.some(l => /clear/i.test(l)));
  assert.equal(root.querySelectorAll('.keypad-extras').length, 0);
});

test('keypad: setHint({letter}) puts key--glow on exactly that letter key', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق' });
  const glowing = root.querySelectorAll('.key--glow');
  assert.equal(glowing.length, 1);
  assert.equal(glowing[0].textContent, 'ق');
});

test('keypad: setHint({letter, harakat}) glows both', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق', harakat: 'َ' });
  const glowing = root.querySelectorAll('.key--glow');
  assert.equal(glowing.length, 2);
});

test('keypad: setHint(empty) clears all glow', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق' });
  api.setHint({});
  assert.equal(root.querySelectorAll('.key--glow').length, 0);
});

test('keypad: flashWrong adds .shake to the matching key', () => {
  const { root, api } = setup();
  api.flashWrong('ك');
  const kaf = root.querySelectorAll('.key--letter').find(b => b.textContent === 'ك');
  assert.ok(kaf.classList.contains('shake'));
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test tests/ui/keypad.test.js`
Expected: many failures (old keypad still present).

- [ ] **Step 3: Implement**

Replace `src/ui/keypad.js` entirely:

```js
const HARAKAT = [
  { name: 'fatha',        char: 'َ' },
  { name: 'damma',        char: 'ُ' },
  { name: 'kasra',        char: 'ِ' },
  { name: 'sukun',        char: 'ْ' },
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_damm', char: 'ٌ' },
  { name: 'tanween_kasr', char: 'ٍ' }
];

const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

export function mountKeypad(root, { onLetter, onHarakat, onBackspace, onPlayAudio }) {
  root.innerHTML = '';

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(harakatRow, lettersWrap, actionRow);

  // index: char → key element
  const byChar = new Map();

  function mkKey(label, cls, ch, handler) {
    const b = document.createElement('button');
    b.className = 'key ' + cls;
    b.textContent = label;
    b.addEventListener('click', handler);
    if (ch) byChar.set(ch, b);
    return b;
  }

  for (const h of HARAKAT) {
    harakatRow.appendChild(mkKey('ـ' + h.char, 'key--harakah', h.char, () => onHarakat(h.char)));
  }

  for (const row of LAYOUT) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const ch of row) {
      rowEl.appendChild(mkKey(ch, 'key--letter', ch, () => onLetter(ch)));
    }
    lettersWrap.appendChild(rowEl);
  }

  actionRow.append(
    mkKey('⌫', 'key--action back',  null, onBackspace),
    mkKey('▶ audio', 'key--action audio', null, onPlayAudio)
  );

  function setHint({ letter, harakat } = {}) {
    for (const el of byChar.values()) el.classList.remove('key--glow');
    if (letter)  byChar.get(letter)?.classList.add('key--glow');
    if (harakat) byChar.get(harakat)?.classList.add('key--glow');
  }

  function flashWrong(ch) {
    const el = byChar.get(ch);
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 250);
  }

  return { setHint, flashWrong, destroy: () => { root.innerHTML = ''; } };
}
```

- [ ] **Step 4: Run keypad tests, confirm green**

Run: `node --test tests/ui/keypad.test.js`
Expected: 8/8 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/keypad.js tests/ui/keypad.test.js
git commit -m "feat(ui): slim keypad with setHint/flashWrong, drops submit/space/clear/extras"
```

---

## Task 7: Heatmap strip + practice view

**Files:**
- Create: `src/ui/heatmap-strip.js`
- Create: `src/ui/practice-view.js`
- Create: `tests/ui/heatmap-strip.test.js`
- Create: `tests/ui/practice-view.test.js`

### 7a — heatmap strip

A tiny dumb component. Props: an array from `stats.getWorst(3)`. Renders chips; renders a fallback when empty.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/heatmap-strip.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountHeatmapStrip } from '../../src/ui/heatmap-strip.js';

test('heatmap-strip: renders one chip per worst item', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update([
    { kind: 'diacritic', value: 'shadda', count: 9 },
    { kind: 'letter',    value: 'ع',     count: 4 }
  ]);
  assert.equal(root.querySelectorAll('.heatmap-chip').length, 2);
});

test('heatmap-strip: shows fallback text when empty', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update([]);
  assert.ok(root.textContent.includes('build a baseline'));
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Create `src/ui/heatmap-strip.js`:

```js
const HARAKAT_LABEL = {
  shadda: 'shadda', fatha: 'fatha', kasra: 'kasra', damma: 'damma',
  sukun: 'sukun',
  tanween_fath: 'tanwīn-a', tanween_kasr: 'tanwīn-i', tanween_damm: 'tanwīn-u'
};

export function mountHeatmapStrip(root) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' heatmap-strip';

  function update(items) {
    root.innerHTML = '';
    if (!items || items.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'heatmap-empty';
      empty.textContent = 'build a baseline — start writing';
      root.appendChild(empty);
      return;
    }
    const label = document.createElement('span');
    label.className = 'heatmap-label';
    label.textContent = 'weakest:';
    root.appendChild(label);
    for (const it of items) {
      const chip = document.createElement('span');
      chip.className = 'heatmap-chip';
      chip.textContent = it.kind === 'letter' ? it.value : (HARAKAT_LABEL[it.value] || it.value);
      root.appendChild(chip);
    }
  }

  return { update };
}
```

- [ ] **Step 4: Run, confirm green**

- [ ] **Step 5: Commit**

```bash
git add src/ui/heatmap-strip.js tests/ui/heatmap-strip.test.js
git commit -m "feat(ui): heatmap strip component"
```

### 7b — practice view

This is the orchestrator. It owns:
- a `LiveMatcher` instance (one per ayah; reinitialized on verse advance)
- a **canonical pane** that renders the current verse with per-slot CSS state classes
- a **user pane** that renders `matcher.state.typed`
- the **heatmap strip** instance

`mountPracticeView(root, { onAllVersesComplete })` returns an API:

```js
{
  setVerses(rawVerses),       // resets to first verse of new range
  applyKeyResult(result),     // re-render after a matcher operation
  setHint(hintFromMatcher),   // forwards to keypad; here just for testability
  refreshHeatmap(worstArr),
  showRangeCompleteBanner(),
  getMatcher()                // exposed for the keypress handlers in main.js
}
```

The keypress handlers themselves live in `main.js` — practice-view does not own input events. It only owns rendering plus the matcher lifecycle.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/practice-view.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountPracticeView } from '../../src/ui/practice-view.js';

function setup() {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const events = { complete: 0 };
  const api = mountPracticeView(root, { onAllVersesComplete: () => events.complete++ });
  return { root, api, events };
}

test('practice-view: setVerses renders canonical pane with current slot glow', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ']);
  assert.ok(root.querySelectorAll('.canonical-slot--current').length === 1);
  assert.equal(root.querySelectorAll('.canonical-slot--current')[0].textContent, 'ق');
});

test('practice-view: after correct letter, prior slot is sealed and user pane updates', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ']);
  const m = api.getMatcher();
  const r = m.tryLetter('ق');
  api.applyKeyResult(r);
  assert.equal(root.querySelectorAll('.canonical-slot--sealed').length, 1);
  assert.ok(root.querySelector('.user-pane').textContent.includes('ق'));
});

test('practice-view: completing the last verse triggers onAllVersesComplete and shows banner', () => {
  const { root, api, events } = setup();
  api.setVerses(['ا']); // one-glyph verse with no harakat → completes in one keypress
  const m = api.getMatcher();
  api.applyKeyResult(m.tryLetter('ا'));
  // single-verse range, single slot, done
  assert.equal(events.complete, 1);
  assert.ok(root.textContent.includes('range complete'));
});

test('practice-view: silent slots render with --silent class in canonical pane', () => {
  const { root, api } = setup();
  api.setVerses(['قَالَ']);
  // قَالَ has a silent madd alif at glyph index 1
  const silents = root.querySelectorAll('.canonical-slot--silent');
  assert.ok(silents.length >= 1);
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Create `src/ui/practice-view.js`:

```js
import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';

export function mountPracticeView(root, { onAllVersesComplete } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  const canonicalPane = document.createElement('div'); canonicalPane.className = 'canonical-pane';
  const divider       = document.createElement('div'); divider.className = 'pane-divider';
  const userPane      = document.createElement('div'); userPane.className = 'user-pane';
  const heatmapRoot   = document.createElement('div');
  const banner        = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';
  root.append(canonicalPane, divider, userPane, heatmapRoot, banner);

  const heatmap = mountHeatmapStrip(heatmapRoot);

  let rawVerses = [];
  let verseIdx = 0;
  let skeleton = [];
  let matcher = null;

  function loadVerse(idx) {
    verseIdx = idx;
    skeleton = buildSkeleton(rawVerses[idx]);
    matcher = new LiveMatcher(skeleton);
    render();
  }

  function setVerses(verses) {
    rawVerses = verses.slice();
    banner.style.display = 'none';
    if (rawVerses.length === 0) { canonicalPane.innerHTML = ''; userPane.innerHTML = ''; matcher = null; return; }
    loadVerse(0);
  }

  function render() {
    // canonical pane
    canonicalPane.innerHTML = '';
    for (let i = 0; i < skeleton.length; i++) {
      const slot = skeleton[i];
      if (slot.kind === 'wordEnd') {
        canonicalPane.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.textContent = slot.letter;
      const classes = ['canonical-slot'];
      if (slot.kind === 'silent') classes.push('canonical-slot--silent');
      if (i < matcher.state.slotIdx) classes.push('canonical-slot--sealed');
      else if (i === matcher.state.slotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
      else classes.push('canonical-slot--future');
      span.className = classes.join(' ');
      canonicalPane.appendChild(span);
    }
    // user pane
    userPane.innerHTML = '';
    for (const t of matcher.state.typed) {
      if (t.kind === 'wordEnd') { userPane.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.textContent = (t.letter || '') + (t.harakat || '');
      s.className = t.kind === 'silent' ? 'user-glyph silent' : 'user-glyph';
      userPane.appendChild(s);
    }
  }

  function applyKeyResult(result) {
    if (!matcher) return;
    render();
    if (result?.complete) {
      // Verse done — advance.
      if (verseIdx + 1 < rawVerses.length) {
        loadVerse(verseIdx + 1);
      } else {
        banner.textContent = '✓ range complete — pick a new range above';
        banner.style.display = '';
        if (onAllVersesComplete) onAllVersesComplete();
      }
    }
  }

  return {
    setVerses,
    applyKeyResult,
    refreshHeatmap: (worst) => heatmap.update(worst),
    getMatcher: () => matcher
  };
}
```

- [ ] **Step 4: Run practice-view tests until green**

Run: `node --test tests/ui/practice-view.test.js`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/practice-view.js tests/ui/practice-view.test.js
git commit -m "feat(ui): practice-view orchestrates skeleton + matcher + render"
```

---

## Task 8: Wire up `main.js`, palette, settings UI, cleanup

**Files:**
- Rewrite: `src/main.js`
- Rewrite: `styles.css`
- Modify: `src/ui/settings-modal.js`
- Modify: `service-worker.js`
- Delete: `src/ui/verse-display.js`, `src/ui/summary.js`, `src/ui/canvas-view.js`, `src/compare/smart-match.js`, `src/compare/user-stream.js`
- Delete tests: `tests/ui/verse-display.test.js`, `tests/compare/smart-match.test.js`, `tests/compare/aligner.test.js`, `tests/ui/renderer.test.js`, `tests/canvas/*`, `tests/recognition/*` (if any reference deleted modules)

**Important:** verify each deletion. Some tests under `tests/canvas/` and `tests/recognition/` may not import the deleted modules; only delete what actually breaks. Run `node --test tests/` after deletes to confirm a clean slate.

- [ ] **Step 1: Rewrite `src/main.js`**

```js
import { loadQuran, getVerse } from './data/quran-loader.js';
import { mountHeader } from './ui/header.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, getWorst, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  settings: null
};
const player = new AyahPlayer();
let practiceApi, keypadApi;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  state.settings = await getSettings();
  await loadQuran(state.settings.script);

  const headerEl   = document.getElementById('header');
  const practiceEl = document.getElementById('verse-display'); // keep id for now
  const keypadEl   = document.getElementById('keypad-view');

  practiceApi = mountPracticeView(practiceEl, {
    onAllVersesComplete: () => { /* banner is in-pane; nothing else */ }
  });

  keypadApi = mountKeypad(keypadEl, {
    onLetter:    handleLetter,
    onHarakat:   handleHarakat,
    onBackspace: handleBackspace,
    onPlayAudio: playCurrentVerse
  });

  mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah, script: state.settings.script },
    onChange: handleRangeChange,
    onOpenSettings: openSettings,
    onScriptToggle: handleScriptToggle
  });

  // First load — pick default range
  handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah });
}

async function refreshHints() {
  const m = practiceApi.getMatcher();
  if (!m) return keypadApi.setHint({});
  const hint = m.nextHint();
  const lvl = state.settings.hintLevel;
  const out = {};
  if (lvl !== 'none' && hint.letter) out.letter = hint.letter;
  if (lvl === 'full' && hint.harakat) out.harakat = hint.harakat;
  keypadApi.setHint(out);
}

async function refreshHeatmap() {
  practiceApi.refreshHeatmap(await getWorst(3));
}

function handleLetter(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryLetter(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    recordError({ kind: 'letter', value: m.skeleton[m.state.slotIdx]?.letter || ch });
    refreshHeatmap();
    return;
  }
  practiceApi.applyKeyResult(r);
  refreshHints();
  if (r.complete) refreshHeatmap();
}

function handleHarakat(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryHarakat(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    // Best-effort error key: the expected harakat name if we have one
    recordError({ kind: 'diacritic', value: ch });
    refreshHeatmap();
    return;
  }
  practiceApi.applyKeyResult(r);
  refreshHints();
  if (r.complete) refreshHeatmap();
}

function handleBackspace() {
  const m = practiceApi.getMatcher();
  if (!m) return;
  m.backspace();
  practiceApi.applyKeyResult({ complete: false });
  refreshHints();
}

async function handleScriptToggle(nextScript) {
  state.settings = await updateSettings({ script: nextScript });
  await loadQuran(nextScript);
  handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah });
}

function handleRangeChange({ surah, fromAyah, toAyah }) {
  state.surah = surah; state.fromAyah = fromAyah; state.toAyah = toAyah;
  const verses = [];
  for (let a = fromAyah; a <= toAyah; a++) verses.push(getVerse(surah, a));
  practiceApi.setVerses(verses);
  refreshHints();
  refreshHeatmap();
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => { state.settings = await updateSettings(patch); refreshHints(); },
    onResetStats: async () => { await resetStats(); refreshHeatmap(); }
  });
}

function playCurrentVerse() {
  // Use the matcher's current verseIdx via practiceApi if needed; for v1 play first verse.
  const url = buildAyahUrl(state.settings.reciter, state.surah, state.fromAyah);
  player.play(url).catch(() => showRetryToast('Could not load audio.', playCurrentVerse));
}

function showRetryToast(message, onRetry) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  const text = document.createElement('span'); text.textContent = message + ' ';
  const retry = document.createElement('button');
  retry.textContent = 'Retry'; retry.className = 'toast-retry';
  retry.addEventListener('click', () => { toast.remove(); onRetry(); });
  const dismiss = document.createElement('button');
  dismiss.textContent = '×'; dismiss.className = 'toast-dismiss';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(text, retry, dismiss);
  document.body.appendChild(toast);
}

init().catch((err) => {
  console.error('Init failed:', err);
  showRetryToast('Failed to load app.', () => location.reload());
});
```

- [ ] **Step 2: Rewrite `styles.css`** (full replacement)

```css
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  background: #fffaf2; color: #1c1c1c;
  font-family: 'Nunito', 'Inter', system-ui, sans-serif;
}
#app { display: flex; flex-direction: column; height: 100dvh; }
#header { flex: 0 0 auto; padding: 8px 12px; background: #ffffff; border-bottom: 1px solid #eee2cf; }
#verse-display { flex: 1 1 auto; padding: 12px; overflow-y: auto; background: #fffaf2; }
#keypad-view { flex: 0 0 auto; border-top: 1px solid #eee2cf; padding: 8px; background: #ffffff; display: flex; flex-direction: column; gap: 6px; }

/* Header layout */
#header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
#header select.surah,
#header input.from, #header input.to,
#header button.settings, #header button.script-toggle {
  background: #ffffff; color: #1c1c1c; border: 1px solid #d8cdb8; border-radius: 8px; padding: 6px 8px;
}
#header select.surah { flex: 1 1 200px; min-width: 0; }
#header input.from, #header input.to { width: 60px; }

/* Practice panes */
.practice-view { display: flex; flex-direction: column; gap: 8px; }
.canonical-pane, .user-pane {
  font-family: 'Amiri', 'NotoNaskhArabic', serif;
  direction: rtl; text-align: right;
  line-height: 2.2;
}
.canonical-pane { font-size: 32px; padding: 6px 4px; }
.user-pane      { font-size: 28px; padding: 6px 4px; min-height: 2.2em; }
.pane-divider   { border-top: 1px dashed #d8cdb8; margin: 4px 0; }

.canonical-slot                  { color: #1c1c1c; }
.canonical-slot--future          { color: #9aa0a6; }
.canonical-slot--silent          { color: #9aa0a6; font-style: italic; }
.canonical-slot--sealed          { color: #58cc02; }
.canonical-slot--current         {
  color: #1c1c1c;
  background: rgba(88, 204, 2, 0.18);
  border-radius: 4px;
  box-shadow: 0 0 0 2px #58cc02 inset;
}
.user-glyph.silent { color: #9aa0a6; opacity: 0.7; }

.range-complete-banner { color: #58cc02; font-weight: 700; padding: 8px 0; }

/* Heatmap strip */
.heatmap-strip { display: flex; gap: 8px; align-items: center; padding: 4px 2px; font-size: 13px; color: #5b5346; }
.heatmap-chip {
  background: #fff3c4; color: #5b3c00; border: 1px solid #ffc800; border-radius: 999px;
  padding: 2px 10px; font-family: 'Amiri', 'NotoNaskhArabic', serif;
}
.heatmap-empty { color: #9aa0a6; font-style: italic; }

/* Keypad */
.keypad-harakat { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
.keypad-letters { display: flex; flex-direction: column; gap: 4px; }
.keypad-row     { display: grid; gap: 4px; }
.keypad-row:nth-child(1) { grid-template-columns: repeat(12, 1fr); }
.keypad-row:nth-child(2) { grid-template-columns: repeat(11, 1fr); }
.keypad-row:nth-child(3) { grid-template-columns: repeat(10, 1fr); }
.keypad-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }

.key {
  min-height: 44px; font-size: 22px;
  background: #ffffff; color: #1c1c1c;
  border: 1px solid #d8cdb8; border-radius: 8px;
  font-family: 'Amiri', 'NotoNaskhArabic', serif;
  touch-action: manipulation; padding: 0; user-select: none; cursor: pointer;
}
.key:active { background: #f7efdc; }
.key--harakah { font-size: 22px; min-height: 40px; }
.key--action  { font-family: 'Nunito', 'Inter', system-ui, sans-serif; font-size: 14px; }
.key--action.audio { background: #e8f6fe; color: #1cb0f6; border-color: #b9e3fb; }
.key--glow {
  box-shadow: 0 0 0 2px #58cc02, 0 0 8px rgba(88,204,2,0.5);
  background: #f1fbe6;
}
.key.shake {
  animation: key-shake 220ms ease;
  border-color: #ff4b4b;
  background: #ffe9e9;
}
@keyframes key-shake {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-3px); }
  40%      { transform: translateX(3px); }
  60%      { transform: translateX(-2px); }
  80%      { transform: translateX(2px); }
}

/* Modal */
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: grid; place-items: center; z-index: 100; }
.modal__panel { background: #ffffff; padding: 20px; border-radius: 12px; min-width: 280px; display: flex; flex-direction: column; gap: 12px; color: #1c1c1c; }
.modal label  { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.modal button { padding: 8px 12px; background: #f7efdc; color: #1c1c1c; border: 1px solid #d8cdb8; border-radius: 6px; }

/* Toast */
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #ff4b4b; color: white; padding: 10px 16px; border-radius: 8px; z-index: 200; display: flex; align-items: center; gap: 8px; }
.toast button.toast-retry   { background: white; color: #ff4b4b; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
.toast button.toast-dismiss { background: transparent; color: white; border: none; font-size: 18px; cursor: pointer; padding: 0 4px; }
```

- [ ] **Step 3: Add hint-level row to settings modal**

Read `src/ui/settings-modal.js` first. Append a `<select>` row with options `letter / full / none` bound to `settings.hintLevel`, calling `onChange({ hintLevel })` on change. Wrap in a `label` matching the existing pattern. No new test required (the modal currently has none); manual verification via dev server.

- [ ] **Step 4: Bump service-worker cache**

In `service-worker.js`, change the cache name constant from its current value (search for `v2`) to `v3`. This invalidates the old shell for returning users.

- [ ] **Step 5: Delete dead files**

```bash
git rm src/ui/verse-display.js src/ui/summary.js src/ui/canvas-view.js \
       src/compare/smart-match.js src/compare/user-stream.js \
       tests/ui/verse-display.test.js tests/compare/smart-match.test.js
```

Then run `node --test tests/` and remove any other test files that fail because they import the deleted modules. Likely candidates: `tests/compare/aligner.test.js`, `tests/ui/renderer.test.js`. For each, open it, confirm it depends on a deleted module, then `git rm` it.

- [ ] **Step 6: Run the full test suite, confirm all green**

Run: `node --test tests/`
Expected: zero failures.

- [ ] **Step 7: Manual smoke test in the browser**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Verify:
1. Background is warm off-white; chrome is white.
2. Picking Al-Fātiḥah 1:1 shows the canonical verse with the first letter glowed green and the matching keypad letter glowed.
3. Pressing the wrong letter shakes that key red and nothing is inserted.
4. Pressing the correct letter inserts into the user pane and advances glow.
5. After the last verse of the range completes, a green "✓ range complete" banner appears in the canonical pane — no modal pops up.
6. No Submit, Space, or Clear keys are visible.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: karaoke-trace UX — live matcher, slim keypad, Duolingo palette, no submit modal"
```

---

## Self-review notes (already addressed inline)

- Spec section "Heatmap strip" — covered by Task 2 (`getWorst`) + Task 7a (component) + Task 8 (wire `refreshHeatmap`).
- Spec section "Silent letters auto-handled" — Task 3 (rules) + Task 4 (skeleton emits silent slots) + Task 5 (matcher auto-consume) + Task 7b (silent CSS).
- Spec section "Hard block + flash" — Task 5 (reject path) + Task 6 (flashWrong) + Task 8 (wiring in main).
- Spec section "Hint levels" — Task 1 (setting) + Task 6 (setHint) + Task 8 (refreshHints respects hintLevel).
- Spec section "Duolingo palette + Nunito/Amiri" — Task 8 (styles.css).
- Spec section "Submit/Space/Clear removed, audio button in action row" — Task 6.
- Spec section "Session-end modal removed" — Task 8 (deletes summary.js, no showSummary call in new main.js).
- Spec section "Strict mode" — Task 1 (setting) + Task 4 (tolerance module exposes `strict`) + Task 5 (matcher reads `strict`). Not yet wired through main settings; deferred to v1.1 (matcher is constructed in practice-view without `strict`; flip on by passing settings through). **Track as a known v1 gap** — the toggle persists but doesn't yet affect the matcher.
- Spec "Tap-to-edit" — not mentioned in updated spec; consciously dropped because hard-block makes it largely unnecessary.
