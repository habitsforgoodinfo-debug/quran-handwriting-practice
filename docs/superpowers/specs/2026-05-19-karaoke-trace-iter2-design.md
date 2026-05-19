# Karaoke Trace — Iteration 2: Recitation Flexibility & Friction Reduction

Date: 2026-05-19
Status: Approved for planning
Supersedes-in-part: `2026-05-19-karaoke-trace-design.md` (iter-1 core retained; matcher and UX evolved).

## Problem

Iteration 1 delivered live per-keystroke matching against a phonetic skeleton, a slim keypad, and a Duolingo-light palette. Real use surfaced five gaps:

1. **No verse navigation.** Once the matcher loaded a verse, there was no way to move on — only completion advanced the cursor. A user who wanted to skip a verse or move to the next ayah for any reason had to re-pick the range.
2. **Missing harakat prompts on stacked marks.** Words like لِلّٰهِ carry shadda + dagger-alif but no traditional vowel on the lam. The matcher only required the shadda and then advanced — the dagger-alif was silently swallowed, so the user was never asked to type it. Same problem with high-madda (ٓ) when paired with shadda.
3. **Hints arrive too early.** The keypad glow appeared as soon as the matcher entered a slot, removing any recall demand. The user wanted to try once before being shown the answer.
4. **Alif-wasla at verse start treated as silent.** Hamzatul-wasl (the alif of the definite article and of certain imperatives) is silent mid-recitation but pronounced at the start of an utterance. The iter-1 skeleton always marked it silent. So a verse beginning with ٱلْحَمْدُ skipped the user past the first pronounced sound.
5. **Single canonical ending only.** A verse-final glyph carrying tanwīn-a, fatha, or a vowel is pronounced as-written if the reciter continues into the next verse (waṣl) and pronounced with sukun — or, for tanwīn-a, with a long-a — if the reciter stops (waqf). The matcher accepted only the written form, so anyone reciting in stop-style at the end of an ayah was hard-blocked.

## Goal

Make the matcher accept *any correct recitation form* and reduce keypad-search friction, while preserving iteration 1's hard-block per-keystroke pedagogy.

## Non-goals

- Multi-qira'ah support (Warsh, Qalun, etc.). The matcher widens accepted forms within Ḥafṣ; alternate readings remain out of scope.
- Auto-detection of which form the user is reciting from audio.
- Per-verse mastery dashboards or gamification.
- Changing the keypad letter layout. The delayed-hint behavior is the friction fix.

---

## 1. Required-harakat set (fixes #2)

### Current shape (iter 1)

`expectedHarakat` is `{ shadda?: bool, vowel?: name, extra?: string[], none?: bool }`. The matcher tracks `pendingShadda` and `pendingVowel` only; everything in `extra` is ignored for gating.

### New shape

`expectedHarakat = { required: Set<string>, hasNone?: true }`.

`required` contains the names of every diacritic the user must type to seal the slot. The set is built from `glyph.diacritics` by including any of:

- `fatha`, `kasra`, `damma`, `sukun`
- `tanween_fath`, `tanween_kasr`, `tanween_damm`
- `shadda`
- `dagger_alif`
- `maddah_above`
- `high_madda` (the Indo-Pak U+06E4 form of maddah)

All other parser-recognized marks (high-pause symbols, place-of-sajdah, rub-el-hizb, etc.) are stored on `slot.ornaments: string[]` for render-only purposes and are not in `required`.

If `required` is empty, `hasNone: true` and the slot seals on letter alone.

### Matcher changes

`pendingMarks: Set<string>` replaces `pendingShadda` + `pendingVowel`. On a correct letter press, the matcher copies `slot.expectedHarakat.required` into `pendingMarks`. `tryHarakat(ch)`:

1. Map `ch` → name (table extended to include `ٰ → dagger_alif` and `ٓ → maddah_above`).
2. If name ∉ `pendingMarks` → reject.
3. Else remove from `pendingMarks`, attach the char to the most recent typed sound entry's `.harakat`, and seal the slot when the set is empty.

Any of the required marks may be typed in any order. `nextHint()` returns the first remaining mark in a fixed display order: shadda → vowel → tanwīn → dagger_alif → maddah_above.

### Keypad

Two keys added to the harakat row:
- `ـٰ` — dagger alif (U+0670)
- `ـٓ` — madda above (U+0653)

Harakat row now has 10 keys (was 8). Grid is `repeat(10, 1fr)` for that row.

---

## 2. Recitation flexibility (fixes #4, #5)

### 2a. Hamzatul-wasl at verse start

A new rule in `silent-rules.js`:

```
firstSoundOverride(glyphs, index, isVerseStart):
  if !isVerseStart || index !== 0: return null
  if g0.letter ∈ {ا, ٱ} and g0.diacritics has no vowel: return 'fatha'
  return null
```

The skeleton builder gains an `isVerseStart` parameter (true for index 0 of every verse). When the rule fires, the slot is emitted as `sound` (overriding the silent classification) with `expectedHarakat.required = {fatha}`. At any other position the existing silent classification stands.

Edge case: if the verse begins with a different vowel context (e.g., the imperative `ٱقْرَأْ` would technically take kasra), iter-2 defaults to fatha. The user can press any vowel — the matcher accepts only fatha. Iter-3 may extend the rule with a small lookup table; this is out of scope here.

### 2b. Waqf alternates at verse end

The skeleton builder marks every verse's *last sound slot* with `acceptWaqf: true`. The matcher reads this flag and, when sealing such a slot:

- Accepts the canonical `required` set as today, **or**
- Accepts `sukun` alone in place of any vowel (canonical vowel/tanwīn is replaced; shadda still required if present), **or**
- If the canonical mark is `tanween_fath`, also accepts `fatha` alone (the alif-extension stop form).

For shadda'd final letters the user types shadda then either canonical-vowel, sukun, or fatha-on-tanwīn-fath.

The matcher records `slot.usedForm: 'wasl' | 'waqf-sukun' | 'waqf-long-a'` on the sealed slot for future analytics. Iter-2 does not surface this — the field exists for future use only.

Heatmap counts only true mismatches, not waqf-vs-wasl choices.

### 2c. Sound recording when waqf is used

When the user types the waqf form, the user pane renders what they typed (sukun, fatha+alif, etc.) — not the canonical mark. The canonical pane still shows the original mark in green-sealed color. No mismatch is flagged.

---

## 3. UX: next-verse + delayed hint (fixes #1, #3)

### 3a. Next-ayah action

Keypad action row becomes a 3-column grid: `⌫ | → next ayah | ▶ audio`.

`onNextAyah()` from keypad → main → `practiceApi.advance({ skipped: true })`:
- Drops the current matcher's in-progress state. No errors recorded for unfinished slots.
- If a next verse exists in the range, loads it and resets hints.
- If on the last verse, shows the "✓ range complete" banner and clears the matcher.

The button is always enabled (also during verse completion, in which case it simply advances).

### 3b. Delayed hint

A new `hintPolicy` controls the keypad glow timeline per slot:

- `auto` (new default): no glow when a slot is entered. On the slot's first reject, glow the key the matcher's `nextHint()` returns. On the second reject, additionally glow the harakat hint when awaiting a letter (full hint). On a correct press, glow clears and the next slot starts at no-glow.
- `always`: glow from slot-entry (iter-1 `letter` and `full` behavior).
- `none`: never glow.

Setting key in `settings`: `hintPolicy: 'auto' | 'always' | 'none'`. Migration: any persisted `hintLevel === 'none'` becomes `hintPolicy: 'none'`, otherwise `hintPolicy: 'auto'`.

Implementation:
- The matcher exposes a per-slot reject counter, exposed as part of `state`. Reset on slot-entry (auto-consume + next-slot transition).
- Main computes the desired hint on every keypress event and routes to `keypadApi.setHint`.

The **canonical pane**'s green-halo glow on the current letter is independent of `hintPolicy` — it only signals position, not the answer.

### 3c. Settings UI

The settings modal's `Hint level` row becomes `Hint timing` with options:
- `Try first, then help` (= `auto`, default)
- `Always show` (= `always`)
- `Never show` (= `none`)

---

## Architecture deltas (from iter 1)

### Files modified

- `src/verse/silent-rules.js` — adds `firstSoundOverride` exported helper.
- `src/verse/skeleton.js` — passes `isVerseStart`, applies override, marks last sound slot with `acceptWaqf`, swaps `expectedHarakat` shape to `{ required, hasNone }`, populates `ornaments`.
- `src/compare/live-matcher.js` — `pendingMarks: Set` replaces booleans; `rejectCountForCurrentSlot` field added; waqf-acceptance branch in `tryHarakat`; reject counter resets on slot transition.
- `src/store/settings.js` — adds `hintPolicy`; migrates legacy `hintLevel`.
- `src/ui/keypad.js` — adds dagger-alif and madda keys; adds 3rd action key (`→ next ayah`); accepts `onNextAyah` callback.
- `src/ui/practice-view.js` — adds `advance({skipped})`; surfaces matcher.rejectCount for the hint policy in main.
- `src/ui/settings-modal.js` — Hint timing row.
- `src/main.js` — wires `onNextAyah`; computes hint based on `hintPolicy` and matcher reject count; routes both letter and harakat hints.
- `styles.css` — `.keypad-actions { grid-template-columns: 1fr 1fr 1fr; }`, harakat row grid widened to 10 cols.

### No new files. No deletions.

---

## Testing

New / updated tests:

- `tests/verse/skeleton.test.js` — adds tests:
  - verse-start alif-wasla emits sound with required={fatha}
  - verse-start regular alif (no diacritic) also emits sound with required={fatha}
  - non-verse-start alif-wasla stays silent
  - last sound slot of a verse carries `acceptWaqf: true`
  - dagger_alif + shadda glyph produces required = {shadda, dagger_alif}

- `tests/compare/live-matcher.test.js` — adds tests:
  - typing shadda then dagger_alif seals the slot (لِلَّٰهِ-style)
  - typing them in reverse order also seals
  - second wrong press increments `rejectCountForCurrentSlot`; correct press resets it
  - at a waqf-eligible slot: canonical mark accepted
  - at a waqf-eligible slot: sukun accepted in place of canonical vowel
  - at a waqf-eligible slot with tanween_fath: bare fatha accepted
  - non-waqf slots reject sukun unless it is the canonical mark

- `tests/ui/keypad.test.js` — adds:
  - dagger-alif and madda keys exist on the harakat row
  - `→ next ayah` exists in action row, fires `onNextAyah`

- `tests/ui/practice-view.test.js` — adds:
  - `api.advance({skipped:true})` mid-verse loads the next verse with a fresh matcher
  - advance from the last verse shows the range-complete banner

- `tests/store/settings.test.js` — adds:
  - default `hintPolicy === 'auto'`
  - legacy `hintLevel === 'none'` migrates to `hintPolicy === 'none'`
  - legacy `hintLevel === 'letter' | 'full'` migrates to `hintPolicy === 'auto'`

---

## Open questions deferred to iter 3

- Imperative-form alif-wasl (e.g. ٱقْرَأْ) — currently locked to fatha. Needs a small position-aware table.
- `usedForm` field on sealed slots is recorded but not surfaced. A "verse summary" line ("you stopped with sukun") could use it.
- Per-(letter, harakat) heatmap currently doesn't separate "wrong letter" from "wrong mark" — a refinement deferred to iter 3 when the audio-playback feature lands.
