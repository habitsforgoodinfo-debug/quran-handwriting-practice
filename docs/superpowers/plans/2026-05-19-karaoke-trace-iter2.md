# Karaoke Trace Iter-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live matcher accept any valid recitation form (stacked marks, hamzatul-wasl, waqf) and add a next-ayah button plus delayed-hint policy.

**Architecture:** Reshape `expectedHarakat` from `{shadda, vowel}` to `{required: string[]}` so the matcher gates on every present diacritic (incl. dagger-alif and madda). Add a `firstSoundOverride` skeleton rule to promote verse-leading alif-wasla to a sound slot, and an `acceptWaqf` flag on each verse's last sound slot which widens accepted marks. Add a per-slot reject counter; main routes hints based on a new `hintPolicy` setting.

**Tech Stack:** Vanilla ES modules, `node:test`, in-house DOM stub.

**Spec:** `docs/superpowers/specs/2026-05-19-karaoke-trace-iter2-design.md`

**Conventions:**
- Test runner: `node --test tests/<path>/<file>.test.js`
- Full suite: `node --test tests/`
- Each task ends with a green commit. Commit prefixes: `feat:`, `test:`, `refactor:`.
- Do NOT touch `src/main.js`, `styles.css`, or `index.html` until Task 5+.
- Schema migration is one-way and lazy: any `hintLevel` key in stored settings is replaced by `hintPolicy` on first read.

---

## File map

**Modified:**
- `src/store/settings.js` (Task 1)
- `src/verse/silent-rules.js` (Task 2)
- `src/verse/skeleton.js` (Task 2)
- `src/compare/live-matcher.js` (Task 3)
- `src/ui/keypad.js` (Task 4)
- `src/ui/practice-view.js` (Task 5)
- `src/main.js` (Task 5)
- `src/ui/settings-modal.js` (Task 6)
- `styles.css` (Task 6)

**Tests modified or created:**
- `tests/store/settings.test.js`
- `tests/verse/silent-rules.test.js`
- `tests/verse/skeleton.test.js`
- `tests/compare/live-matcher.test.js`
- `tests/ui/keypad.test.js`
- `tests/ui/practice-view.test.js`

---

## Task 1: Settings — `hintPolicy` + migration

**Files:**
- Modify: `src/store/settings.js`
- Modify: `tests/store/settings.test.js`

- [ ] **Step 1: Failing tests**

Append to `tests/store/settings.test.js`:

```js
test('settings: defaults include hintPolicy="auto"', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
  // legacy key should be gone
  assert.equal(s.hintLevel, undefined);
});

test('settings: legacy hintLevel="none" migrates to hintPolicy="none"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'none' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'none');
  assert.equal(s.hintLevel, undefined);
});

test('settings: legacy hintLevel="letter" migrates to hintPolicy="auto"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'letter' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
});

test('settings: legacy hintLevel="full" migrates to hintPolicy="auto"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'full' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
});
```

- [ ] **Step 2: Confirm failure**

`node --test tests/store/settings.test.js` — expect 4 new failures.

- [ ] **Step 3: Implement**

Replace `src/store/settings.js` with:

```js
import { kvGet, kvPut } from './db.js';

export const DEFAULT_SETTINGS = Object.freeze({
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4,
  script: 'indopak',
  hintPolicy: 'auto',
  strict: false
});

function migrate(stored) {
  if (!stored) return {};
  const out = { ...stored };
  if ('hintLevel' in out) {
    out.hintPolicy = out.hintLevel === 'none' ? 'none' : 'auto';
    delete out.hintLevel;
  }
  return out;
}

export async function getSettings(deps = { kvGet, kvPut }) {
  const stored = await deps.kvGet('settings');
  return { ...DEFAULT_SETTINGS, ...migrate(stored) };
}

export async function updateSettings(patch, deps = { kvGet, kvPut }) {
  const current = await getSettings(deps);
  const next = { ...current, ...patch };
  await deps.kvPut('settings', next);
  return next;
}
```

- [ ] **Step 4: Re-run, confirm 4/4 new pass + no regressions**

The existing iter-1 test `'settings: defaults include hintLevel="letter" and strict=false'` will now fail (it checks the removed key). Update it to:

```js
test('settings: defaults include strict=false', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.strict, false);
});
```

And update `'settings: hintLevel can be updated and persists'` to use `hintPolicy`:

```js
test('settings: hintPolicy can be updated and persists', async () => {
  const db = makeMockDb();
  await updateSettings({ hintPolicy: 'always' }, db);
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'always');
});
```

- [ ] **Step 5: Commit**

```bash
git add src/store/settings.js tests/store/settings.test.js
git commit -m "feat(settings): replace hintLevel with hintPolicy + auto migrate"
```

---

## Task 2: Skeleton — `required` set, hamzatul-wasl override, `acceptWaqf`

**Files:**
- Modify: `src/verse/silent-rules.js`
- Modify: `src/verse/skeleton.js`
- Modify: `tests/verse/silent-rules.test.js`
- Modify: `tests/verse/skeleton.test.js`

### Subtask 2a — `firstSoundOverride` in silent-rules

- [ ] **Step 1: Failing tests**

Append to `tests/verse/silent-rules.test.js`:

```js
import { firstSoundOverride } from '../../src/verse/silent-rules.js';

test('firstSoundOverride: alif-wasla at verse start → fatha', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, true), 'fatha');
});

test('firstSoundOverride: bare alif at verse start with no vowel → fatha', () => {
  const glyphs = parseWord('الْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, true), 'fatha');
});

test('firstSoundOverride: alif-wasla NOT at verse start → null', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, false), null);
});

test('firstSoundOverride: leading letter with diacritic → null (no override needed)', () => {
  const glyphs = parseWord('قَالَ');
  assert.equal(firstSoundOverride(glyphs, 0, true), null);
});

test('firstSoundOverride: only fires at index 0', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 1, true), null);
});
```

- [ ] **Step 2: Implement** — append to `src/verse/silent-rules.js`:

```js
const VOWEL_DIACRITICS = new Set([
  'fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm'
]);

// At the start of an utterance, an alif-wasla (ٱ) or a bare alif (ا)
// of the definite article is pronounced as fatha (hamzatul-wasl rule).
// Returns the vowel name to require, or null if no override.
export function firstSoundOverride(glyphs, index, isVerseStart) {
  if (!isVerseStart || index !== 0) return null;
  const g = glyphs[0];
  if (!g) return null;
  if (g.letter !== 'ا' && g.letter !== 'ٱ') return null;
  const hasVowel = g.diacritics.some(d => VOWEL_DIACRITICS.has(d));
  if (hasVowel) return null;
  return 'fatha';
}
```

- [ ] **Step 3: Tests pass.**

### Subtask 2b — `expectedHarakat.required` + `acceptWaqf` + `isVerseStart`

- [ ] **Step 1: Modify skeleton tests**

Replace the existing iter-1 tests in `tests/verse/skeleton.test.js` that assert the old `{vowel: 'damma'}` shape with the new `{required: [...]}` shape, and add new tests. After editing, the file should contain (full replacement):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';

function kinds(slots) { return slots.map(s => s.kind); }
function reqSet(slot) { return new Set(slot.expectedHarakat.required || []); }

test('skeleton: simple verse — sound + wordEnd per word', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  assert.deepEqual(kinds(slots), ['sound','sound','wordEnd','sound','sound','wordEnd']);
  assert.deepEqual(reqSet(slots[0]), new Set(['damma']));
  assert.deepEqual(reqSet(slots[1]), new Set(['sukun']));
});

test('skeleton: madd alif becomes silent slot', () => {
  const slots = buildSkeleton('قَالَ');
  assert.deepEqual(kinds(slots), ['sound','silent','sound','wordEnd']);
});

test('skeleton: shadda + fatha → required contains both', () => {
  const slots = buildSkeleton('إِنَّا');
  const nun = slots.find(s => s.letter === 'ن');
  assert.deepEqual(reqSet(nun), new Set(['shadda','fatha']));
});

test('skeleton: shadda + dagger_alif (لَّٰ) → required contains both', () => {
  // ٱللَّٰهِ — the lam after the silent lam has shadda+dagger_alif, no regular vowel
  const slots = buildSkeleton('ٱللَّٰهِ');
  const shaddaLam = slots.find(s => s.letter === 'ل' && s.expectedHarakat.required?.includes('shadda'));
  assert.ok(shaddaLam, 'should find a lam with shadda');
  assert.deepEqual(reqSet(shaddaLam), new Set(['shadda','dagger_alif']));
});

test('skeleton: sun-letter article — alif and lam both silent', () => {
  const slots = buildSkeleton('الشَّمْسِ');
  assert.deepEqual(kinds(slots).slice(0, 5), ['silent','silent','sound','sound','sound']);
});

test('skeleton: wordIdx tracks words', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const w0 = slots.filter(s => s.wordIdx === 0 && s.kind !== 'wordEnd');
  const w1 = slots.filter(s => s.wordIdx === 1 && s.kind !== 'wordEnd');
  assert.equal(w0.length, 2);
  assert.equal(w1.length, 2);
});

test('skeleton: bare sound slot (no marks) has hasNone=true and required is empty', () => {
  const slots = buildSkeleton('ة');
  const s = slots.find(x => x.kind === 'sound' || x.kind === 'silent');
  assert.ok(s);
  // hasNone is true when there are no required marks
  assert.equal(s.expectedHarakat.hasNone, true);
  assert.deepEqual(reqSet(s), new Set());
});

// New iter-2 tests
test('skeleton: isVerseStart=true → leading alif-wasla becomes sound with required=[fatha]', () => {
  const slots = buildSkeleton('ٱلْحَمْدُ', { isVerseStart: true });
  assert.equal(slots[0].kind, 'sound');
  assert.equal(slots[0].letter, 'ٱ');
  assert.deepEqual(reqSet(slots[0]), new Set(['fatha']));
});

test('skeleton: isVerseStart=true → leading bare alif also gets fatha', () => {
  const slots = buildSkeleton('الْحَمْدُ', { isVerseStart: true });
  assert.equal(slots[0].kind, 'sound');
  assert.deepEqual(reqSet(slots[0]), new Set(['fatha']));
});

test('skeleton: isVerseStart defaults false → alif-wasla stays silent', () => {
  const slots = buildSkeleton('ٱلْحَمْدُ');
  assert.equal(slots[0].kind, 'silent');
});

test('skeleton: last sound slot of verse carries acceptWaqf=true', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const soundSlots = slots.filter(s => s.kind === 'sound');
  const last = soundSlots[soundSlots.length - 1];
  assert.equal(last.acceptWaqf, true);
  // others do not
  const others = soundSlots.slice(0, -1);
  for (const s of others) assert.notEqual(s.acceptWaqf, true);
});
```

- [ ] **Step 2: Implement skeleton**

Replace `src/verse/skeleton.js` with:

```js
import { parseVerse } from './parser.js';
import { isSilentInWord, firstSoundOverride } from './silent-rules.js';

const GATED_DIACRITICS = new Set([
  'fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm',
  'shadda',
  'dagger_alif',
  'maddah_above',
  'high_madda'
]);

function harakatFor(glyph, extraRequired = []) {
  const required = [];
  for (const d of glyph.diacritics) {
    if (GATED_DIACRITICS.has(d) && !required.includes(d)) required.push(d);
  }
  for (const d of extraRequired) {
    if (!required.includes(d)) required.push(d);
  }
  const ornaments = glyph.diacritics.filter(d => !GATED_DIACRITICS.has(d));
  const out = { required };
  if (required.length === 0) out.hasNone = true;
  if (ornaments.length) out.ornaments = ornaments;
  return out;
}

export function buildSkeleton(rawVerse, { isVerseStart = false } = {}) {
  const words = parseVerse(rawVerse);
  const slots = [];
  let canonicalIdx = 0;

  for (let wi = 0; wi < words.length; wi++) {
    const glyphs = words[wi];
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      const isFirstOfVerse = wi === 0 && gi === 0;
      const override = isFirstOfVerse
        ? firstSoundOverride(glyphs, gi, isVerseStart)
        : null;

      let silent = isSilentInWord(glyphs, gi);
      const extra = [];
      if (override) {
        silent = false;
        extra.push(override);
      }

      slots.push({
        kind: silent ? 'silent' : 'sound',
        letter: g.letter,
        expectedHarakat: harakatFor(g, extra),
        wordIdx: wi,
        canonicalIdx: canonicalIdx++
      });
    }
    slots.push({ kind: 'wordEnd', wordIdx: wi });
  }

  // Mark the last sound slot of the verse as waqf-eligible.
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].kind === 'sound') {
      slots[i].acceptWaqf = true;
      break;
    }
  }

  return slots;
}
```

- [ ] **Step 3: Run skeleton tests, confirm green**

Run: `node --test tests/verse/skeleton.test.js`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/verse/silent-rules.js src/verse/skeleton.js \
        tests/verse/silent-rules.test.js tests/verse/skeleton.test.js
git commit -m "feat(verse): required-set + hamzatul-wasl + waqf-eligible flag"
```

---

## Task 3: Live matcher — `pendingMarks` + waqf + reject counter

**Files:**
- Modify: `src/compare/live-matcher.js`
- Modify: `tests/compare/live-matcher.test.js`

- [ ] **Step 1: Modify tests**

The existing iter-1 tests still pass conceptually but reference the old `pendingShadda`/`pendingVowel` shape in their assertions. Edit `tests/compare/live-matcher.test.js`: keep all existing tests that only assert through public API (tryLetter, tryHarakat, backspace, nextHint, state.awaiting), and APPEND these new tests:

```js
test('matcher: لَّٰ — shadda + dagger_alif both required, any order seals', () => {
  // Use a fixture skeleton matching ٱللَّٰهِ — find the shadda'd lam
  const sk = buildSkeleton('ٱللَّٰهِ');
  const m = new LiveMatcher(sk);
  // Walk to the shadda'd lam (kind=sound, required includes shadda + dagger_alif)
  // The first two slots in ٱللَّٰهِ are: ٱ (silent), ل (silent — sun-letter? actually lam-lam is not sun-letter so the first lam should be sound)
  // Track explicitly via stepping until we hit the shadda'd lam.
  // Just type whatever the matcher accepts until we find the slot with required containing 'shadda' and 'dagger_alif'.

  // Step until matcher awaits letter on the shadda'd lam.
  while (m.state.awaiting !== 'done') {
    const slot = sk[m.state.slotIdx];
    if (slot && slot.kind === 'sound'
        && slot.expectedHarakat.required?.includes('shadda')
        && slot.expectedHarakat.required?.includes('dagger_alif')) {
      // Found it. Type the letter.
      const r = m.tryLetter(slot.letter);
      assert.equal(r.accepted, true);
      // Now in harakat mode. Type shadda first.
      assert.equal(m.tryHarakat('ّ').accepted, true);
      // Then dagger_alif (ٰ)
      const sealed = m.tryHarakat('ٰ');
      assert.equal(sealed.accepted, true);
      // Slot should be sealed (matcher has moved past it)
      assert.notEqual(m.state.slotIdx, slot.canonicalIdx);
      return;
    }
    // Otherwise advance with whatever's expected
    if (m.state.awaiting === 'letter') {
      const r = m.tryLetter(slot.letter);
      if (!r.accepted) throw new Error('failed to advance letter at ' + m.state.slotIdx);
    } else if (m.state.awaiting === 'harakat') {
      const need = slot.expectedHarakat.required.find(d =>
        !m.state.typed.at(-1)?.harakat?.includes(HARAKAT[d]));
      const r = m.tryHarakat(HARAKAT[need]);
      if (!r.accepted) throw new Error('failed to advance harakat ' + need);
    }
  }
  throw new Error('did not encounter a shadda+dagger_alif slot');
});

test('matcher: dagger_alif then shadda (reverse order) also seals', () => {
  // Make a minimal fake skeleton with one sound slot requiring shadda + dagger_alif
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

test('matcher: rejectCount increments on wrong letter, resets on correct', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  assert.equal(m.state.rejectCount, 0);
  m.tryLetter('ك');
  assert.equal(m.state.rejectCount, 1);
  m.tryLetter('ت');
  assert.equal(m.state.rejectCount, 2);
  m.tryLetter('ق');
  assert.equal(m.state.rejectCount, 0); // resets on accept
});

test('matcher: rejectCount also tracks wrong harakat', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ'));
  m.tryLetter('ق');
  assert.equal(m.state.rejectCount, 0);
  m.tryHarakat('َ'); // fatha, wrong (expects damma)
  assert.equal(m.state.rejectCount, 1);
  m.tryHarakat('ُ'); // correct
  assert.equal(m.state.rejectCount, 0);
});

test('matcher: waqf-eligible slot accepts sukun in place of canonical mark', () => {
  // Build a verse where the last sound slot has a vowel
  const sk = buildSkeleton('قُلْ هُوَ');
  // last sound is و with fatha; expect acceptWaqf
  const last = sk.filter(s => s.kind === 'sound').at(-1);
  assert.equal(last.acceptWaqf, true);
  const m = new LiveMatcher(sk);
  // walk through: ق+damma ل+sukun ه+damma و+ ... at و, instead of fatha, type sukun
  assert.equal(m.tryLetter('ق').accepted, true); m.tryHarakat('ُ');
  assert.equal(m.tryLetter('ل').accepted, true); m.tryHarakat('ْ');
  assert.equal(m.tryLetter('ه').accepted, true); m.tryHarakat('ُ');
  assert.equal(m.tryLetter('و').accepted, true);
  const r = m.tryHarakat('ْ'); // sukun (waqf) — should be accepted
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});

test('matcher: non-waqf slot rejects sukun when canonical is not sukun', () => {
  const m = new LiveMatcher(buildSkeleton('قُلْ هُوَ'));
  m.tryLetter('ق');
  const r = m.tryHarakat('ْ'); // wrong — canonical is damma; ق is not last sound
  assert.equal(r.accepted, false);
});

test('matcher: waqf-eligible tanween_fath slot accepts bare fatha', () => {
  // Fake skeleton with one sound slot tanween_fath + acceptWaqf
  const fake = [
    { kind: 'sound', letter: 'ا', expectedHarakat: { required: ['tanween_fath'] }, wordIdx: 0, canonicalIdx: 0, acceptWaqf: true },
    { kind: 'wordEnd', wordIdx: 0 }
  ];
  const m = new LiveMatcher(fake);
  assert.equal(m.tryLetter('ا').accepted, true);
  const r = m.tryHarakat('َ'); // fatha alone — waqf long-a form
  assert.equal(r.accepted, true);
  assert.equal(r.complete, true);
});
```

At the top of the file, after the existing `HARAKAT` constant, ensure dagger_alif and madda chars are present:

```js
const HARAKAT = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ'
};
```

And add the `buildSkeleton` import at the top:

```js
import { buildSkeleton } from '../../src/verse/skeleton.js';
```

- [ ] **Step 2: Confirm new tests fail**

- [ ] **Step 3: Implement matcher**

Replace `src/compare/live-matcher.js` with:

```js
import { lettersEquivalent } from './tolerance.js';

const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ'
};
const HARAKAT_NAME = Object.fromEntries(
  Object.entries(HARAKAT_CHAR).map(([n, c]) => [c, n])
);
// U+06E4 (high madda, Indo-Pak madda) also maps to 'maddah_above' for input purposes.
HARAKAT_NAME['ۤ'] = 'maddah_above';

const AUTO_CONSUME_SILENT = new Set(['ا', 'و', 'ي', 'ى', 'ل', 'ٱ']);

// Hint display order — first remaining required mark wins.
const HINT_ORDER = ['shadda','fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm',
  'dagger_alif','maddah_above','high_madda'];

export class LiveMatcher {
  constructor(skeleton, { strict = false } = {}) {
    this.skeleton = skeleton;
    this.strict = strict;
    this.state = {
      slotIdx: 0,
      awaiting: 'letter',
      typed: [],
      pendingMarks: new Set(),
      rejectCount: 0
    };
    this._advanceToNextSound([]);
  }

  _isAutoConsumed(slot) {
    if (slot.kind === 'wordEnd') return true;
    if (slot.kind === 'silent' && AUTO_CONSUME_SILENT.has(slot.letter)) return true;
    return false;
  }

  _advanceToNextSound(inserted) {
    while (this.state.slotIdx < this.skeleton.length) {
      const s = this.skeleton[this.state.slotIdx];
      if (this._isAutoConsumed(s)) {
        inserted.push(s);
        this.state.typed.push({ kind: s.kind, letter: s.letter, slotIdx: this.state.slotIdx });
        this.state.slotIdx++;
        continue;
      }
      this.state.awaiting = 'letter';
      this._resetPendingForCurrent();
      this.state.rejectCount = 0;
      return;
    }
    this.state.awaiting = 'done';
  }

  _resetPendingForCurrent() {
    const slot = this.skeleton[this.state.slotIdx];
    this.state.pendingMarks = new Set();
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) return;
    const required = slot.expectedHarakat.required || [];
    for (const m of required) this.state.pendingMarks.add(m);
  }

  // Returns true if the given harakat name is acceptable at the current
  // slot given waqf rules. Mutates `state.pendingMarks` and `usedForm` when accepted.
  _acceptHarakat(name) {
    const slot = this.skeleton[this.state.slotIdx];
    const eh = slot.expectedHarakat;
    const required = new Set(eh.required || []);

    if (this.state.pendingMarks.has(name)) {
      this.state.pendingMarks.delete(name);
      return true;
    }

    // Waqf alternates only at last sound slot of verse.
    if (!slot.acceptWaqf) return false;

    // Form 1: sukun in place of any pending vowel/tanwīn.
    if (name === 'sukun') {
      const vowelLike = [...this.state.pendingMarks].find(m =>
        m === 'fatha' || m === 'kasra' || m === 'damma' ||
        m === 'tanween_fath' || m === 'tanween_kasr' || m === 'tanween_damm'
      );
      if (vowelLike) {
        this.state.pendingMarks.delete(vowelLike);
        slot.usedForm = 'waqf-sukun';
        return true;
      }
    }

    // Form 2: bare fatha when canonical is tanween_fath.
    if (name === 'fatha' && this.state.pendingMarks.has('tanween_fath')) {
      this.state.pendingMarks.delete('tanween_fath');
      slot.usedForm = 'waqf-long-a';
      return true;
    }

    return false;
  }

  tryLetter(ch) {
    if (this.state.awaiting !== 'letter') return { accepted: false, autoInserted: [] };
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) {
      this.state.rejectCount++;
      return { accepted: false, autoInserted: [] };
    }
    if (!lettersEquivalent(ch, slot.letter, { strict: this.strict })) {
      this.state.rejectCount++;
      return { accepted: false, autoInserted: [] };
    }
    this.state.typed.push({ kind: 'sound', letter: slot.letter, slotIdx: this.state.slotIdx });
    this.state.rejectCount = 0;

    if (slot.expectedHarakat.hasNone || (slot.expectedHarakat.required || []).length === 0) {
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
    const name = HARAKAT_NAME[ch];
    if (!name) {
      this.state.rejectCount++;
      return { accepted: false };
    }
    if (!this._acceptHarakat(name)) {
      this.state.rejectCount++;
      return { accepted: false };
    }

    this.state.rejectCount = 0;
    const lastSound = [...this.state.typed].reverse().find(t => t.kind === 'sound');
    if (lastSound) lastSound.harakat = (lastSound.harakat || '') + ch;

    if (this.state.pendingMarks.size === 0) {
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, complete: this.state.awaiting === 'done', autoInserted: inserted };
    }
    return { accepted: true, complete: false, autoInserted: [] };
  }

  backspace() {
    while (this.state.typed.length) {
      const last = this.state.typed[this.state.typed.length - 1];
      this.state.typed.pop();
      this.state.slotIdx = last.slotIdx;
      if (last.kind === 'sound') break;
    }
    this._resetPendingForCurrent();
    this.state.awaiting = 'letter';
    this.state.rejectCount = 0;
  }

  nextHint() {
    if (this.state.awaiting === 'letter') {
      const slot = this.skeleton[this.state.slotIdx];
      return slot ? { letter: slot.letter } : {};
    }
    if (this.state.awaiting === 'harakat') {
      for (const name of HINT_ORDER) {
        if (this.state.pendingMarks.has(name)) return { harakat: HARAKAT_CHAR[name] };
      }
    }
    return {};
  }
}
```

- [ ] **Step 4: Run all matcher tests, iterate until green**

Run: `node --test tests/compare/live-matcher.test.js`
Expected: all old + new tests pass.

Run full suite: `node --test tests/`. Some tests outside this task may break:
- Old skeleton-test assertions on `expectedHarakat.vowel` should already have been updated in Task 2.
- If a test relies on `pendingShadda`/`pendingVowel` state fields by name, update it to read from `state.pendingMarks` or remove the assertion (these are private-ish).

- [ ] **Step 5: Commit**

```bash
git add src/compare/live-matcher.js tests/compare/live-matcher.test.js
git commit -m "feat(compare): pendingMarks set, waqf alternates, reject counter"
```

---

## Task 4: Keypad — dagger-alif, madda, next-ayah

**Files:**
- Modify: `src/ui/keypad.js`
- Modify: `tests/ui/keypad.test.js`

- [ ] **Step 1: Failing tests**

Append to `tests/ui/keypad.test.js`:

```js
test('keypad: dagger-alif key exists on harakat row and fires onHarakat with ٰ', () => {
  const { root, calls } = setup();
  const k = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ٰ'));
  assert.ok(k, 'dagger-alif key missing');
  k.dispatch('click');
  assert.deepEqual(calls.harakat, ['ٰ']);
});

test('keypad: madda key exists on harakat row and fires onHarakat with ٓ', () => {
  const { root, calls } = setup();
  const k = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ٓ'));
  assert.ok(k, 'madda key missing');
  k.dispatch('click');
  assert.deepEqual(calls.harakat, ['ٓ']);
});

test('keypad: → next ayah action key fires onNextAyah', () => {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { next: 0 };
  mountKeypad(root, {
    onLetter: () => {}, onHarakat: () => {}, onBackspace: () => {},
    onPlayAudio: () => {}, onNextAyah: () => calls.next++
  });
  const nextBtn = root.querySelectorAll('.key--action').find(b => /next/i.test(b.textContent));
  assert.ok(nextBtn);
  nextBtn.dispatch('click');
  assert.equal(calls.next, 1);
});

test('keypad: harakat row has exactly 10 keys', () => {
  const { root } = setup();
  assert.equal(root.querySelectorAll('.key--harakah').length, 10);
});
```

- [ ] **Step 2: Confirm failure**

- [ ] **Step 3: Implement**

Replace `src/ui/keypad.js` with:

```js
const HARAKAT = [
  { name: 'fatha',        char: 'َ' },
  { name: 'damma',        char: 'ُ' },
  { name: 'kasra',        char: 'ِ' },
  { name: 'sukun',        char: 'ْ' },
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_damm', char: 'ٌ' },
  { name: 'tanween_kasr', char: 'ٍ' },
  { name: 'dagger_alif',  char: 'ٰ' },
  { name: 'maddah_above', char: 'ٓ' }
];

const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

export function mountKeypad(root, { onLetter, onHarakat, onBackspace, onPlayAudio, onNextAyah }) {
  root.innerHTML = '';

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(harakatRow, lettersWrap, actionRow);

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
    mkKey('⌫', 'key--action back', null, onBackspace),
    mkKey('→ next ayah', 'key--action next', null, () => onNextAyah && onNextAyah()),
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

- [ ] **Step 4: Confirm green**

Run: `node --test tests/ui/keypad.test.js`. Existing iter-1 test "no Submit/Space/Clear/extras" should still pass — none of the new keys match those patterns.

- [ ] **Step 5: Commit**

```bash
git add src/ui/keypad.js tests/ui/keypad.test.js
git commit -m "feat(ui): keypad gains dagger-alif, madda, → next ayah"
```

---

## Task 5: Practice-view + main — `advance()` + delayed hint policy

**Files:**
- Modify: `src/ui/practice-view.js`
- Modify: `src/main.js`
- Modify: `tests/ui/practice-view.test.js`

### Subtask 5a — practice-view: `advance({skipped})` and `buildSkeleton` with `isVerseStart`

- [ ] **Step 1: Failing tests**

Append to `tests/ui/practice-view.test.js`:

```js
test('practice-view: advance({skipped:true}) mid-verse loads next verse', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ', 'هُوَ']);
  // type partial input on verse 1
  const m1 = api.getMatcher();
  m1.tryLetter('ق');
  api.advance({ skipped: true });
  const m2 = api.getMatcher();
  assert.notEqual(m1, m2);
  // canonical pane should now show هُوَ — find a current slot whose letter is ه
  const current = root.querySelectorAll('.canonical-slot--current')[0];
  assert.equal(current.textContent, 'ه');
});

test('practice-view: advance from last verse shows range-complete banner', () => {
  const { root, api, events } = setup();
  api.setVerses(['قُلْ']);
  api.advance({ skipped: true });
  assert.ok(root.textContent.includes('range complete'));
  assert.equal(events.complete, 1);
});

test('practice-view: first verse uses isVerseStart=true (leading ٱ becomes sound)', () => {
  const { root, api } = setup();
  api.setVerses(['ٱلْحَمْدُ']);
  // ٱ should be the current sound slot (not auto-consumed as silent)
  const current = root.querySelectorAll('.canonical-slot--current')[0];
  assert.equal(current?.textContent, 'ٱ');
});
```

- [ ] **Step 2: Implement**

Replace `src/ui/practice-view.js` with:

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
    // Every verse is its own utterance start for hamzatul-wasl purposes.
    skeleton = buildSkeleton(rawVerses[idx], { isVerseStart: true });
    matcher = new LiveMatcher(skeleton);
    render();
  }

  function setVerses(verses) {
    rawVerses = verses.slice();
    banner.style.display = 'none';
    canonicalPane.innerHTML = '';
    userPane.innerHTML = '';
    if (rawVerses.length === 0) { matcher = null; skeleton = []; return; }
    loadVerse(0);
  }

  function render() {
    if (!matcher) return;
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
      const sealedUpTo = matcher.state.awaiting === 'harakat'
        ? matcher.state.slotIdx
        : matcher.state.slotIdx - 1;
      if (i <= sealedUpTo) classes.push('canonical-slot--sealed');
      else if (i === matcher.state.slotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
      else classes.push('canonical-slot--future');
      span.className = classes.join(' ');
      canonicalPane.appendChild(span);
    }
    userPane.innerHTML = '';
    for (const t of matcher.state.typed) {
      if (t.kind === 'wordEnd') { userPane.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.textContent = (t.letter || '') + (t.harakat || '');
      s.className = t.kind === 'silent' ? 'user-glyph silent' : 'user-glyph';
      userPane.appendChild(s);
    }
  }

  function advance({ skipped = false } = {}) {
    if (verseIdx + 1 < rawVerses.length) {
      loadVerse(verseIdx + 1);
    } else {
      matcher = null;
      banner.textContent = '✓ range complete — pick a new range above';
      banner.style.display = '';
      if (onAllVersesComplete) onAllVersesComplete();
    }
  }

  function applyKeyResult(result) {
    if (!matcher) return;
    render();
    if (result?.complete) advance({ skipped: false });
  }

  return {
    setVerses,
    applyKeyResult,
    advance,
    refreshHeatmap: (worst) => heatmap.update(worst),
    getMatcher: () => matcher
  };
}
```

- [ ] **Step 3: Run, confirm green**

### Subtask 5b — main.js: wire onNextAyah + hintPolicy

- [ ] **Step 1: Modify `src/main.js`**

Replace the `keypadApi = mountKeypad(...)` call with:

```js
keypadApi = mountKeypad(keypadEl, {
  onLetter:    handleLetter,
  onHarakat:   handleHarakat,
  onBackspace: handleBackspace,
  onPlayAudio: playCurrentVerse,
  onNextAyah:  handleNextAyah
});
```

Replace the `refreshHints` function with:

```js
function refreshHints() {
  const m = practiceApi.getMatcher();
  if (!m) return keypadApi.setHint({});
  const policy = state.settings.hintPolicy;
  if (policy === 'none') return keypadApi.setHint({});

  const hint = m.nextHint();
  if (policy === 'always') {
    keypadApi.setHint(hint);
    return;
  }
  // policy === 'auto'
  const rc = m.state.rejectCount;
  if (rc === 0) {
    keypadApi.setHint({});
    return;
  }
  // After at least one wrong press: show the primary hint key.
  const out = {};
  if (m.state.awaiting === 'letter' && hint.letter) out.letter = hint.letter;
  if (m.state.awaiting === 'harakat' && hint.harakat) out.harakat = hint.harakat;
  keypadApi.setHint(out);
}
```

Add a `handleNextAyah` function:

```js
function handleNextAyah() {
  practiceApi.advance({ skipped: true });
  refreshHints();
}
```

- [ ] **Step 2: Tests** — main.js has no direct tests. Verify integration by running `node --test tests/` — expect 0 failures.

- [ ] **Step 3: Commit (5a and 5b together)**

```bash
git add src/ui/practice-view.js src/main.js tests/ui/practice-view.test.js
git commit -m "feat(ui): next-ayah advance + delayed-hint policy"
```

---

## Task 6: Settings modal label rename + harakat row CSS

**Files:**
- Modify: `src/ui/settings-modal.js`
- Modify: `styles.css`

- [ ] **Step 1: Settings modal — rename row**

In `src/ui/settings-modal.js`, find the block created in iter-1 for hint level. Replace it with:

```js
const labHint = document.createElement('label');
labHint.append('Hint timing ');
const hint = document.createElement('select');
hint.className = 'hint-policy';
const OPTS = [
  ['auto',   'Try first, then help'],
  ['always', 'Always show'],
  ['none',   'Never show']
];
for (const [val, label] of OPTS) {
  const opt = document.createElement('option');
  opt.value = val; opt.textContent = label;
  hint.appendChild(opt);
}
hint.value = settings.hintPolicy || 'auto';
labHint.appendChild(hint);
hint.addEventListener('change', () => onChange({ hintPolicy: hint.value }));
```

Remove the old `labHint` block that used `settings.hintLevel` and the option list `['letter','full','none']`. The `panel.append(...)` order stays the same; just the variable now produces the new control.

- [ ] **Step 2: CSS — widen harakat row to 10 columns and action row to 3**

In `styles.css`, find:

```css
.keypad-harakat { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
```

Change to:

```css
.keypad-harakat { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
```

Find:

```css
.keypad-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
```

Change to:

```css
.keypad-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
```

And add a styling rule for the new "next" action key:

```css
.key--action.next { background: #f1fbe6; color: #1c1c1c; border-color: #b8e08a; }
```

- [ ] **Step 3: Bump SW cache to v9**

In `service-worker.js`, change `qhp-v8` to `qhp-v9`.

- [ ] **Step 4: Run full test suite, confirm green**

`node --test tests/`

- [ ] **Step 5: Manual smoke test**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Verify:
1. Harakat row has 10 keys including dagger-alif `ٰ` and madda `ٓ`.
2. Action row shows `⌫ | → next ayah | ▶ audio`.
3. Picking a verse starting with `ٱ` (e.g., Al-Fatiha 1:2 `ٱلْحَمْدُ`) shows ٱ as the current glowing sound slot (not silent).
4. On `لِلَّٰهِ`, typing `ل` after the silent al- prefix requires you to press both `ّ` shadda and `ٰ` dagger-alif before advancing to `ه`.
5. With default `hintPolicy=auto`: first keypress is unaided (no glow on keypad). Press a wrong key → letter key glows green.
6. Press `→ next ayah` mid-verse → matcher moves to next verse, no errors logged.
7. At the last sound slot of a verse, pressing sukun in place of the canonical fatha/kasra/damma is accepted (waqf form).

- [ ] **Step 6: Commit**

```bash
git add src/ui/settings-modal.js styles.css service-worker.js
git commit -m "feat(ui): hint-timing setting label + 10-col harakat + 3-col actions"
```

---

## Self-review

**Spec coverage:**
- §1 Required-harakat set → Task 2 (skeleton emits `{required:[]}`), Task 3 (matcher uses `pendingMarks`), Task 4 (dagger-alif + madda keys). ✓
- §2a Hamzatul-wasl → Task 2 (silent-rules `firstSoundOverride`, skeleton accepts `isVerseStart`), Task 5 (practice-view passes `isVerseStart:true`). ✓
- §2b Waqf alternates → Task 2 (skeleton marks `acceptWaqf`), Task 3 (`_acceptHarakat` widens at acceptWaqf slots). ✓
- §3a Next-ayah → Task 4 (keypad button + callback), Task 5 (advance + main wiring). ✓
- §3b Delayed hint → Task 1 (hintPolicy setting + migration), Task 3 (rejectCount), Task 5 (refreshHints policy logic), Task 6 (settings UI label). ✓
- §3c Settings UI → Task 6. ✓

**Placeholder scan:** None — every step contains complete code or commands.

**Type consistency:**
- `expectedHarakat.required` used as array in skeleton (`[...]`), converted to `Set` in matcher constructor and tests (`new Set(slot.expectedHarakat.required || [])`). Consistent.
- `state.rejectCount` field referenced in matcher tests and in main's refreshHints. Consistent.
- `practiceApi.advance({skipped})` signature consistent across practice-view, main, and tests.
- Keypad callback `onNextAyah` consistent across keypad, tests, and main.
