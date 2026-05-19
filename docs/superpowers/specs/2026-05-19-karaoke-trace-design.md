# Karaoke Trace — Live Per-Keystroke Practice

Date: 2026-05-19
Status: Approved for planning
Supersedes: `2026-05-19-ux-overhaul-design.md` (phonetic-skeleton core retained; practice loop and visual direction replaced).

## Problem

The current app asks the user to type a whole verse and then submit it for batch comparison against the canonical string. Four things break that loop:

1. **Blank canvas.** When a range is picked, the practice pane is empty. The user must either remember the verse cold or press Reveal — which defeats verification.
2. **Keypad overload.** The on-screen keyboard now carries 8 basic harakat, 16 extras (pause marks, small high glyphs, ayah-end markers), 33 letters, space, ⌫, Clear, Submit. Most of the extras are silent script-only marks the user should never need to type.
3. **No live feedback.** Errors only surface after Submit. The user cannot tell, while typing, whether a given letter+harakat is right — so they cannot build muscle memory on the slot they just produced.
4. **No mastery signal.** Sessions feel identical. The per-(letter,harakat) error counters in the stats store are never surfaced.

A session-end summary modal also interrupts the user after the final verse of a range, even though the user is often in flow.

## Goal

Refocus the app on the user's stated objective: *master the pronounced letters and their harakat in his recitation by writing each one and getting it verified*. The unit of practice becomes the **slot** (one pronounced letter + its expected harakat). The verse provides context; the slot is the exercise.

## Non-goals

- Speech input. Typing is the verification mode.
- Auto-correction of wrong letters.
- Spaced repetition, XP, badges, leaderboards.
- Memorization training. The canonical text is always visible.

## Practice loop (karaoke trace)

1. User picks a surah and ayah range.
2. The canonical verse renders in the upper **canonical pane**. The first slot is highlighted with a soft green glow.
3. User taps a letter key.
   - **Wrong letter** → key shakes red; nothing is inserted. The error is logged for the heatmap. The glow does not move.
   - **Correct letter** → the letter is appended to the **user pane** in mushaf ink; the canonical glow on that slot turns green-sealed; the slot now awaits its harakat.
4. User taps a harakat key.
   - Same hard-block rule. Correct → harakat is rendered on the user pane, slot is fully sealed, glow jumps to the next slot.
   - Slots whose `expectedHarakat` is `none` skip step 4 entirely; the glow advances on the correct letter press.
5. If the next slot is `silent` (script-only) or `wordEnd`, the matcher auto-consumes it: silent letters appear faded in the user pane; word boundaries become spaces. Glow continues to land only on `sound` slots.
6. Last slot of last verse sealed → no modal. A quiet "✓ range complete — pick a new range above" banner appears in the canonical pane and the heatmap strip refreshes. The user can pick a new range or repeat the same one.

### Wrong-key behavior — hard block

A wrong keypress is registered as an error event (for the heatmap) but produces no insertion. The user cannot proceed past a mistake. This is the central pedagogical choice: it forces the user to mentally retrieve the correct slot before the keypress, which is how muscle memory is built.

### Hint levels

A `hintLevel` setting controls the keypad's glow behavior:

- `letter` (default) — only the correct letter key glows. Harakat row gives no hint.
- `full` — the correct letter and the correct harakat both glow.
- `none` — no glow. The hard-block still tells the user when they're wrong, but they must find the key themselves.

The canonical pane's slot glow (in the verse render) is independent of this setting and is always shown — it tells the user *where* they are in the verse, not *what* to press.

## Architecture

### Phonetic skeleton

At range load, each canonical verse is converted into an ordered list of **slots**:

- `sound` — a pronounced consonant. Fields: `letter`, `expectedHarakat` (one of fatha/kasra/damma/sukun/shadda+x/tanwin × 3/none), `wordIdx`, `canonicalIdx`.
- `silent` — a script-only letter inserted automatically. Same fields plus `silent: true`.
- `wordEnd` — boundary marker emitted after the last slot of a word.

Silent-letter rules cover the recurring cases: sun-letter alif after the definite article (الشَّمْس), dagger alif (هَٰذَا), plural-masculine alif (كَتَبُوا), ornamental waw (دَاوُود, عَمْرو), ornamental alif in صلوة / زكوة / حيوة. When a rule table is ambiguous the matcher emits `sound` — better to ask the user to type than to skip something they wanted to verify.

Shadda is modeled as a modifier on `expectedHarakat`: `{ shadda: true, vowel: 'fatha'|... }`. The matcher accepts shadda-then-vowel in either order.

### Live matcher

A stateful walker over a skeleton:

```
state: {
  slotIdx: number,          // index into skeleton
  awaiting: 'letter' | 'harakat' | 'done',
  typed: TypedSlot[]        // what to render in the user pane
}

tryLetter(ch)   → { accepted: bool, autoInserted: Slot[] }
tryHarakat(ch)  → { accepted: bool, complete: bool }
backspace()     → undoes last accepted sound slot + any auto-inserted slots that followed it
nextHint()      → { letter?: char, harakat?: char }
```

Tolerance from the existing `smart-match` helpers (ت/ة, ا/أ/إ/آ confusables) is preserved inside `tryLetter`. Strict mode disables it.

### Modules

- **New:** `src/verse/skeleton.js`, `src/verse/silent-rules.js`, `src/compare/live-matcher.js`, `src/ui/practice-view.js` (orchestrates canonical-pane + user-pane + heatmap-strip), `src/ui/heatmap-strip.js`.
- **Rewritten:** `src/ui/keypad.js` (slimmed; adds `setHint`, `flashWrong`, absorbs the ▶-audio button into the action row, removes Submit/Space/Clear/extras-row), `src/ui/verse-display.js` → folded into practice-view (file deleted), `styles.css` (Duolingo-light palette).
- **Trimmed:** `src/compare/smart-match.js` keeps its tolerance helpers (consumed by live-matcher) but loses its public batch-verse entry point.
- **Deleted:** `src/ui/summary.js` (popup gone), `src/ui/canvas-view.js` (already unused).
- **Touched:** `src/main.js` — wires practice-view, removes Submit/showSummary code paths; `src/store/settings.js` — adds `hintLevel`; `src/ui/settings-modal.js` — adds hint-level row.
- **Untouched:** `src/store/stats.js` (existing per-(letter,harakat) counters feed the heatmap as-is), `src/data/quran-loader.js`, `src/audio/player.js`, `src/ui/header.js`.

### Data flow per keystroke

```
keypress → keypad → main.handleKey(kind, char)
                  → matcher.tryLetter|tryHarakat(char)
                  ↳ on accepted:
                     practice-view.applyDelta(matcher.state)
                     stats.recordHit(letter, harakat)
                     keypad.setHint(matcher.nextHint())
                  ↳ on rejected:
                     keypad.flashWrong(char)
                     stats.recordError({ kind, value })
                     heatmap-strip.maybeRefresh()
```

The view is a pure function of matcher state plus settings — no per-key DOM diffing logic in the matcher.

## Visual design

### Palette (Duolingo-light)

- Background: `#fffaf2` (warm off-white)
- Surface: `#ffffff`
- Ink (primary text, Arabic): `#1c1c1c`
- Muted (silent letters, future slots, chrome): `#9aa0a6`
- Sealed / correct: `#58cc02`
- Wrong / shake: `#ff4b4b`
- Heatmap dot: `#ffc800` (amber, for "still working on")
- Accent secondary: `#1cb0f6` (audio button, links)

### Typography

- Chrome (header, buttons, labels): `Nunito`, fallback `Inter`, fallback system sans.
- Arabic (canonical + user panes, keypad letter faces): `Amiri`, fallback `NotoNaskhArabic`, fallback serif.
- Sizes: canonical 32px / 2.2 line-height; user pane 28px / 2.2; keypad letter face 22px; harakat key face 22px; header 16px.

### Layout

Three fixed zones — header, practice pane, keypad — same as today, but the practice pane now contains stacked canonical + user sub-panes and a slim heatmap strip.

```
┌───────────────────────────────────────────┐
│  Al-Baqarah   2:255            ⚙          │  header
├───────────────────────────────────────────┤
│   ٱللَّهُ لَا إِلَ⟨ٰ⟩هَ إِلَّا              │  canonical pane (always visible)
│   هُوَ الْحَيُّ الْقَيُّومُ                 │   • sealed: ink
│                                           │   • current: green glow
│   ─────────────────────────────           │   • future: muted
│                                           │   • silent: muted italic
│   ٱللَّهُ لَا إِلَ▍                          │  user pane (mushaf ink)
├───────────────────────────────────────────┤
│  weakest:  ّ shadda   ٌ tanwīn-ḍ   ع +ُ   │  heatmap strip
├───────────────────────────────────────────┤
│   َ   ُ   ِ   ْ   ّ   ً   ٌ   ٍ            │  harakat row (8 keys)
│   ض ص ث ق ف غ ع ه خ ح ج د                 │  letter grid
│   ش س ي ب ل ا ت ن م ك ط                   │
│   ئ ء ؤ ر لا ى ة و ز ظ                    │
│   ⌫                              ▶ audio  │  action row
└───────────────────────────────────────────┘
```

### Glow and shake

- `.key--glow` — 2px green outline + soft 4px halo. Applied to one letter key (and optionally one harakat key) based on `hintLevel`.
- `.canonical-slot--current` — same green halo on the canonical slot.
- `.canonical-slot--sealed` — full green ink.
- `.canonical-slot--silent` — muted gray italic.
- `.shake` — 220ms 3-cycle horizontal shake keyframe, red border flash.
- `.silent` (user pane) — gray, 80% opacity.

## Heatmap strip

A single horizontal row of up to three chips, between user pane and keypad. Each chip is a (letter, harakat) pair or a bare harakat from the user's worst-3 in the rolling 7-day window (read from `stats.getWorst(3, '7d')`). Tapping a chip filters the next range pick to verses containing that pair (deferred; for v1 the chip is informational only). Refreshes after each verse completes.

If there is no data yet (first session), the strip says "build a baseline — start writing" in muted text.

## Settings

Existing settings retained: script (Uthmani/Indo-Pak), reciter, reset stats. Added:

- **Hint level** — `letter` (default) / `full` / `none`.
- **Strict mode** — off by default. When on, disables ت/ة and alif-family tolerance in `tryLetter`.

## Removed

- Submit button. Verse completion is implicit.
- Space key. Word boundaries are auto-inserted.
- Clear key. Excessive; ⌫ is enough.
- Reveal button. Canonical is always shown — there is nothing to reveal.
- Extras keypad row (pause marks, small high glyphs, ayah-end markers). They are silent slots, not user input.
- `showSummary` modal. Replaced by an inline "✓ range complete" banner in the canonical pane.
- Per-verse correction line (the post-Submit annotated render). With live hard-block, the user pane *is* the correction.

## Testing strategy (TDD)

Each new module ships with its own test file, written first:

- `tests/verse/skeleton.test.js` — given canonical strings, expect the right slot sequence; covers sun-letter alif, dagger alif, ornamental waw, shadda, tanween.
- `tests/verse/silent-rules.test.js` — rule predicates in isolation.
- `tests/compare/live-matcher.test.js` — keystroke sequences against fixture skeletons; covers tolerance, backspace, auto-consume of silent/wordEnd, completion event.
- `tests/ui/keypad.test.js` — `setHint` glow class application, `flashWrong` shake, removed-key absence.
- `tests/ui/practice-view.test.js` — DOM-stubbed end-to-end: feed keypress sequence, assert canonical pane glow state and user pane content.
- `tests/store/stats.test.js` — `getWorst(n, window)` returns top-n by error count.

Existing tests for `smart-match` batch entry point and `verse-display` are deleted with their modules. Existing tolerance-helper tests inside `smart-match` are preserved.

## Migration

The redesign replaces enough of the running surface that there is no incremental fallback. A single feature branch builds the new modules under TDD, swaps `main.js` at the end, deletes the dead files in the same commit. Service worker cache bumped to v3 to invalidate the old shell.

## Open questions deferred to v1.1

- Should the heatmap chips be tappable to filter range picks? (Currently informational only.)
- Should a wrong harakat after a correct letter "unseal" the letter, or only block the harakat? (Current spec: block only the harakat; the letter stays sealed.)
- Should we surface a per-verse accuracy number in the canonical pane after completion? (Currently no — silent completion only.)
