# UX Overhaul — Phonetic Skeleton & Mushaf-Aesthetic Practice

Date: 2026-05-19
Status: Approved for planning

## Problem

The current app verifies handwriting against the canonical Uthmani string. In practice this creates friction that distracts from the user's real goal — *verifying that he has memorized the correct letters and harakat of a verse*:

1. Word boundaries are user-supplied via the space key, but users who learned by listening rarely know where one word ends and the next begins. Their input clumps and looks ugly next to the clean canonical render.
2. Silent script-only letters (definite-article alif before sun letters, dagger alif, the alif in صلوة, etc.) must be typed even though they add no value to verification — and missing them flags the attempt as wrong.
3. To fix a missed harakat on an earlier letter, the user must backspace through every letter typed since.
4. The app waits passively for spaces and accepts no in-flow assistance. There is no intelligent help for the parts the user does not care about.
5. There is no sense of progress or habit.
6. The UI is dull and buttons are placed ad-hoc.

## Goal

Make the app focus the user's attention on the *one thing they came to verify* — pronounced consonants and their harakat — and take care of everything else (clustering, silent letters, layout, motivation) on their behalf.

## Non-goals

- Speech-recognition input. The point of typing is that it is a different verification mode from listening.
- Spaced repetition. "Quiet progress" gamification does not require it.
- Auto-correcting wrong letters. Would defeat the verification objective.
- Social features, leaderboards, XP, badges.

## Architectural shift: the phonetic skeleton

Today the matcher compares a flat user string against a flat canonical string. The redesign introduces an intermediate representation derived from the canonical verse at load time: the **phonetic skeleton**.

A skeleton is an ordered list of **slots**, each of three kinds:

- `sound` — a pronounced consonant. Fields: `letter`, `expectedHarakat` (or `none`), `word` (word index), `canonicalIndex` (pointer back into the Uthmani string).
- `silent` — a script-only letter the user should not have to type. Same fields plus `silent: true`.
- `wordEnd` — boundary marker after the last slot of a word.

The user's input is a parallel list of **typed slots** `{letter, harakat?}`. The matcher walks both lists in lock-step, auto-consuming `silent` and `wordEnd` slots. Scoring counts only `sound` slots.

### Silent-letter detection

A precomputed rule table covers the recurring cases:

- Definite-article alif before sun letters
- Plural masculine alif (e.g. كَتَبُوا)
- Dagger alif (e.g. هَٰذَا)
- Silent waw in عَمْرو, داوود
- Alif in صلوة, زكوة, حيوة
- Other ornamental alifs flagged in source

When the table is ambiguous, the matcher errs toward `sound` — better to ask the user to type than to silently skip something they wanted to verify. The rule table lives in `src/verse/silent-rules.js` and is exercised by unit tests.

## Input flow

**Typing a letter:** appended as a new typed-slot with no harakat. Matcher advances through the skeleton, auto-consuming any `silent` and `wordEnd` slots until the next `sound` slot. View redraws with the new letter and any silent letters that were auto-inserted (rendered faded, not flagged as wrong).

**Typing a harakat:** applied to the most recently typed sound-slot. Replaces any existing harakat on that slot.

**Tap-to-edit:** tap any already-typed letter to make it the *active slot* (subtle caret underline). The harakat row now applies to that slot. Typing a new *letter* while a past slot is active first returns the caret to the end, then appends — there is no mid-stream insertion. A "resume" affordance also returns the caret.

**Backspace:** removes the last typed slot. Any silent letters that were rendered after it disappear from the view (they are not in the typed list, only in the rendered output).

**Word boundaries:** never typed by the user. The matcher emits them. The view groups typed slots by their `word` index with proper spacing.

**Live correctness states per typed slot:**

- `match` — letter and harakat both correct so far
- `letter-match-harakat-pending` — correct letter, harakat not yet entered but expected
- `wrong-letter`
- `wrong-harakat`

Wrong slots are rendered in muted terracotta but **do not block progress**. The user keeps typing and can fix later.

**Submit:** if any sound-slots have no harakat, the app first highlights them and asks the user to fill them in (the *end-of-verse harakat sweep*) before locking. Scoring counts only `sound` slots; silent letters never affect accuracy.

## Assistance behaviors

1. **Auto silent-letter insertion** — handled by the matcher. Silent letters appear faded; cannot be missed.
2. **Auto word segmentation** — handled by `wordEnd` slots. No space key.
3. **Harakat hint (opt-in, off by default)** — if a sound-slot sits without harakat for ~1.5 s, the expected harakat appears as a faint ghost above the letter. Tap to accept, or type something else to dismiss. Toggle in settings.
4. **End-of-verse harakat sweep** — see above.
5. **Forgiving letter recognition** — existing smart-match logic preserved (ت/ة, ا/أ/إ/آ confusables tolerated). User can opt into strict mode in settings.

## UI zones — mushaf aesthetic

Three fixed zones, always in the same place. No floating buttons.

```
┌────────────────────────────────────────┐
│  ◀  Al-Baqarah · 2:255         ☰      │  Header
│      ●●●○○  streak 7d  •  best 96%    │  Progress strip
├────────────────────────────────────────┤
│                                        │
│   اللَّهُ لَا إِلَٰهَ إِلَّا              │  Reference (canonical)
│   هُوَ الْحَيُّ الْقَيُّومُ              │
│                                        │
│  ────────── your recall ──────────     │
│                                        │
│   الله لا إله إلا                       │  Your input
│   هو الحي القي│                         │  (auto-segmented)
│                                        │
├────────────────────────────────────────┤
│   َ   ُ   ِ   ْ   ّ   ً   ٌ   ٍ        │  Harakat row
│  ┌──────────────────────────────────┐  │
│  │     Gboard-style letter grid     │  │  Letters
│  └──────────────────────────────────┘  │
│   ⌫        (no space key)        ✓   │  Action row
└────────────────────────────────────────┘
```

- **Header:** surah name, ayah number, menu. Back arrow when inside a verse.
- **Progress strip:** last-7-day streak dots and personal-best accuracy for this verse. Only gamification surface on the practice screen.
- **Reference pane:** canonical verse. Tap to toggle Uthmani / Indo-Pak. Long-press to dim (self-test mode).
- **Your input pane:** what the user typed, auto-segmented, silent letters faded, caret on the active slot.
- **Keypad:** harakat row pinned at the top of the keypad area (always reachable). Letter grid below. Backspace left, done right, no space bar.

### Palette and typography

- Background: `#f6efdc` (parchment)
- Ink: `#2a2118`
- Gold accents: `#b08a3e`
- Terracotta (error): `#a55a3a`
- Faded grey (silent letters): `#8a8377`
- Arabic font: a high-quality Uthmani face (e.g. KFGQPC Uthmanic Hafs) for both reference and input panes — same font means user input visually mirrors the canonical render, satisfying observation #1.

## Gamification — quiet progress

Three signals on the practice screen.

1. **Daily streak.** Consecutive days with at least one verse attempted. Row of dots in the progress strip. One "freeze" per week protects against a missed day (one-tap activation if the app was opened but no verse finished).
2. **Per-surah completion ring.** On the surah picker, each surah shows a thin ring around its number, filled in proportion to verses attempted with ≥80% accuracy.
3. **Personal best per verse.** Highest accuracy on the verse plus the date. Shown in the progress strip. When beaten: a brief, calm "New best" fade-in — no confetti, no sound.

**Stats screen** (separate, accessed from the menu): per-verse history, longest streak, most-improved verses this week, most-confused letters and harakat. Optional surface; never pushed.

**Excluded:** XP, levels, badges, leagues, avatars, missions, push notifications, social.

## Module boundaries

### New
- `src/verse/skeleton.js` — pure: `(parsedVerse, silentRules) → Skeleton`.
- `src/verse/silent-rules.js` — silent-letter rule table.
- `src/compare/matcher.js` — stateful: holds typed slots, advances through the skeleton. API: `appendLetter`, `appendHarakat`, `backspace`, `setActiveSlot`, `getRenderState`. Replaces `smart-match.js`.
- `src/ui/practice-view.js` — three-zone layout. Replaces ad-hoc layout in `main.js`.
- `src/store/progress.js` — pure functions over a persisted state object: streak, per-verse best, per-surah completion.
- `src/ui/stats-view.js` — the separate stats screen.

### Modified
- `src/ui/verse-display.js` — renders from `matcher.getRenderState()`; gains faded silent-letter style and tap-to-edit hit testing.
- `src/ui/keypad.js` — harakat row always reachable, no space key.
- `src/data/quran-loader.js` — wraps each loaded verse with its skeleton at load time.
- `styles.css` — full rewrite for mushaf aesthetic + zone layout.

### Removed / folded in
- `src/compare/aligner.js` and `src/compare/user-stream.js` — folded into `matcher.js`. The forgiving-recognition logic from the old smart-match becomes an internal branch of the matcher.

## Data migration

Existing persisted stats use a per-letter error counter. That table is preserved (used by the stats screen). New fields are added with defaults on first load:

- `streak: { count: 0, lastDay: null, freezeUsedWeek: null }`
- `verseBests: {}` — keyed by `surah:ayah`
- `surahCompletion: {}` — keyed by surah, value = count of verses attempted with ≥80% accuracy
- `settings.harakatHint: false`
- `settings.strictRecognition: false`

Nothing is dropped. No migration script needed beyond default-fill on load.

## Rollout sequencing

Implementation will be sequenced as small, independently testable steps with commits and manual browser checks between them:

1. Skeleton + silent-rules + matcher (node tests, no UI changes).
2. Wire matcher into existing UI behind a feature flag; verify functional parity.
3. Practice-view layout rewrite (zones, no styling yet).
4. Visual redesign (palette, typography, spacing).
5. Tap-to-edit harakat.
6. Auto silent-letter rendering + auto word segmentation in the view.
7. Harakat hint and end-of-verse sweep.
8. Progress store + streak + personal best + completion ring.
9. Stats screen.
10. Remove the feature flag and the old comparison modules.

Each step ends with a commit and a manual run in the browser. The app remains usable at every step.

## Open questions

None at design time. Specific UI dimensions and exact font choice will be confirmed during step 4 in the browser.
