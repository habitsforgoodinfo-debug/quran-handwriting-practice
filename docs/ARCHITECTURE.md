# Architecture — Current State

A snapshot of the design and implementation as it stands today. Use this
as the canonical reference; the dated specs/plans in
`docs/superpowers/specs/` and `docs/superpowers/plans/` are kept only as
history.

---

## 1. What the app does

The user picks a surah and starting verse, sees its transliteration in
the upper pane, and types each Arabic letter and harakat using an
on-screen keypad. The matcher accepts only the correct keystroke; the
correct key glows green after two wrong attempts. When the verse is
complete the app moves to the next ayah automatically. Settings let the
user narrow which letters or harakat actually require a keypress —
everything else is auto-filled on entry. A rolling strip between the
canvas and keypad keeps the last few completed verses visible like a
mushaf paragraph. After every 20 completed verses, any verses the user
slipped on are queued for a quick retry pass; the next batch starts
afterwards.

---

## 2. Top-level files

| File                  | Role |
|-----------------------|------|
| `index.html`          | Three sections in body: `#header`, `#verse-display`, `#rolling-strip`, `#keypad-view`. Loads `src/main.js` as a module. |
| `service-worker.js`   | `qhp-vNN` cache; bump version with every shipped change. Pre-caches Quran JSON + PWA assets; network-first then cache. |
| `manifest.webmanifest`| PWA manifest. |
| `styles.css`          | All styling. CSS is plain (no preprocessor). |
| `src/main.js`         | Boots the app, owns global state, wires the components together. |

---

## 3. Directory layout

```
src/
├── main.js                  – app bootstrap, controllers
├── audio/
│   └── player.js            – AyahPlayer, reciter URL builder
├── canvas/                  – legacy stroke recognition, kept for the
│   ├── input.js               my-book review mode and rapid-fire flows;
│   ├── gestures.js            NOT used in the keypad practice loop
│   └── segmenter.js
├── compare/
│   ├── tolerance.js         – lettersEquivalent() (Indo-Pak ↔ Uthmani
│   │                          variant tolerance for the matcher)
│   ├── aligner.js           – DTW alignment (legacy canvas mode)
│   └── live-matcher.js      – the keypad matcher (see §5)
├── data/
│   ├── quran-loader.js      – loads quran-indopak.json or quran-uthmani.json
│   ├── surah-metadata.js    – SURAHS array (number, name_en, name_ar, verses)
│   └── word-meanings.js     – word-level meanings (used only by my-book hovers)
├── recognition/             – DTW templates etc., legacy canvas pipeline
├── store/
│   ├── db.js                – IndexedDB primitives (kv + counters + verse store)
│   ├── settings.js          – DEFAULT_SETTINGS + migrate
│   └── stats.js             – accuracy + verse completion + per-surah stats
├── ui/
│   ├── header.js            – surah/ayah picker, stats banner, dropdown badges
│   ├── practice-view.js     – translit pane + user pane + progress strip
│   ├── keypad.js            – harakat row + 3 letter rows + 3 action buttons
│   ├── rolling-strip.js     – session-scoped mushaf-style recent verses
│   ├── settings-modal.js    – settings panel
│   ├── my-book.js           – modal: every verse the user has written
│   ├── intro.js             – the step-by-step tutorial (replaces old welcome)
│   ├── feedback.js          – haptics + chime
│   ├── heatmap-strip.js     – the small progress / word-of-verse strip
│   └── rapid-fire.js        – pop-quiz picker
└── verse/
    ├── parser.js            – per-letter glyph parser, cleanVerseForDisplay()
    ├── skeleton.js          – buildSkeleton(rawText) → slots array
    ├── silent-rules.js      – which letters are silent for a given context
    ├── transliterate.js     – verse → English transliteration per word
    └── renderer.js          – legacy renderer for canvas mode
```

---

## 4. Data model

### Settings (`src/store/settings.js`)

Stored as a single KV entry under key `settings`. Defaults:

```js
{
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4,
  script: 'indopak',              // 'indopak' | 'uthmani'
  hintPolicy: 'auto',             // 'auto' | 'always' | 'none'
  strict: false,
  hideIntro: false,
  autoPlayOnAyahLoad: false,
  requiredLetters: DEFAULT_REQUIRED_LETTERS,
  requiredHarakat: ALL_HARAKAT,
  quickTestEvery20: true
}
```

- `DEFAULT_REQUIRED_LETTERS` = 17 letters the user practices regularly
  (`ث ح د ذ ز س ش ص ض ط ظ ع ف ق ك ه و`). Everything else auto-fills.
- `ALL_HARAKAT` = the 12 diacritic names. The settings UI exposes a
  single "Auto-fill all harakat" toggle that sets this to `[]` or back
  to all 12.
- `migrate()` keeps backwards compatibility:
  - Old `hintLevel` → `hintPolicy`.
  - Old `optionalLetters` → `requiredLetters` (only if the user had
    customized; empty list falls through to the new default).

### Stats (`src/store/stats.js`)

| Store / KV key            | Shape                                | Purpose |
|---------------------------|--------------------------------------|---------|
| `accCounters` (kv)        | `{hits, attempts}`                   | Lifetime accuracy across all surahs (legacy; still used by My Book) |
| `accBySurah` (kv)         | `{ "1": {hits, attempts}, ... }`     | Per-surah accuracy — drives the header banner + dropdown badges |
| `letterErrors` (counter)  | `{ "ض": 3, "ص": 1, ... }`            | Mistake heatmap by letter |
| `diacriticErrors`(counter)| `{ "ٌ": 2, ... }`                    | Mistake heatmap by harakat char |
| `verses` store            | `{key: "S:A", value: {...}}`         | Every completed/skipped verse |

A completed-verse value:
```js
{ surah, ayah, rawText, perfect, skipped: false, completedAt }
```

`recordAttempt({correct, surah})` writes to both the lifetime counter
*and* the per-surah counter when `surah` is given.

`getSurahAccuracy(surah)` and `getAllSurahAccuracy()` expose per-surah
accuracy; `getSurahProgress(surah)` returns how many ayahs of that
surah have been completed (non-skipped).

`resetStats()` clears all four KVs and the verse store.

---

## 5. The practice loop

`LiveMatcher` (`src/compare/live-matcher.js`) is the entire matching
engine. The flow per verse:

1. `main.js` reads the raw verse text from `getVerse(surah, ayah)`.
2. `practiceApi.setVerse({surah, ayah, rawText, requiredLetters, requiredHarakat})`.
3. `practice-view.js` parses the verse with `parseVerse()` for the
   transliteration pane, builds the skeleton with `buildSkeleton()`, and
   instantiates `new LiveMatcher(skeleton, {requiredLetters, requiredHarakat})`.

A skeleton is an array of slots — `sound`, `silent`, or `wordEnd`. Each
sound/silent slot has `letter` and `expectedHarakat: {required: [names...]}`.

`LiveMatcher` walks the skeleton with a cursor `state.slotIdx`:

- `_isAutoConsumed(slot)`: true for `wordEnd`, for built-in silent
  letters (`ا و ي ى ل ٱ`), and for any letter NOT in
  `requiredLetters` (when that set is provided).
- `_advanceToNextSound()`: pushes auto-consumed slots into
  `state.typed` (with their full harakat for user-marked optional
  letters), stops at the next user-required slot.
- `_resetPendingForCurrent()`: for the slot the cursor just arrived at,
  splits the required harakat into:
  - `state.pendingMarks` — harakat the user must still type
    (i.e. `requiredHarakat` intersect slot harakat)
  - `state.autoHarakat` — harakat that will auto-attach to the user's
    next-typed letter
- `tryLetter(ch)` — if `lettersEquivalent(ch, slot.letter)`, pushes a
  sound entry (with `entry.harakat = state.autoHarakat` pre-attached),
  advances if `pendingMarks` is now empty, otherwise sets
  `awaiting = 'harakat'`.
- `tryHarakat(ch)` — looks up the harakat name, accepts if it is in
  `pendingMarks` (with a small "waqf" tolerance for end-of-ayah
  substitutions). On accept, appends the char to the last sound entry's
  `harakat` and advances when `pendingMarks` is empty.
- `backspace()` rewinds to the previous sound slot.
- `nextHint()` returns `{letter}` or `{harakat: HARAKAT_CHAR[name]}` —
  consumed by `main.refreshHints()` to glow keypad keys via
  `keypadApi.setHint()`.

### Hint glow timing

In `main.refreshHints()`:
- `hintPolicy === 'none'`: never glow.
- `hintPolicy === 'always'`: glow continuously.
- `hintPolicy === 'auto'`: glow only after `m.state.rejectCount >= 2` on
  the current slot.

The keypad maps both Uthmani `ْ` and Indo-Pak `ۡ` to the same sukun key
(jazm visual). Same for the maddah-on-tap (`ٓ`) and high madda
(`ۤ`, long-press on the same key).

### Verse completion + retry test

`practiceApi.onVerseComplete(...)` calls `handleVerseComplete` in
`main.js`, which:

1. Plays the chime, pushes the verse to the rolling strip.
2. `markVerseComplete()` persists.
3. If we are inside a retry-mode pass, dequeue the next retry or exit
   retry mode.
4. Otherwise, increments `batchState.count`. If `!perfect`, pushes the
   verse onto `batchState.mistakes`.
5. When `count >= 20` and `settings.quickTestEvery20`:
   - If there are any mistakes, `practiceApi.showPrompt(...)` offers
     "Retry N verses" / "Skip".
   - "Retry" stores the live position in `batchState.resumeSurah/Ayah`,
     then `jumpToVerse()` walks the mistakes one by one.
   - When the queue is empty, `exitRetryFlow()` restores the live
     position via `jumpToVerse(resumeSurah, resumeAyah)`.
   - "Skip" resets `count`/`mistakes` and advances normally.
6. Otherwise calls `advanceToNextAyah()` to load the next ayah (and
   shows the surah-complete banner at the end of a surah).

---

## 6. Keypad layout

Mounted by `mountKeypad` (`src/ui/keypad.js`):

- Row 1 — 12 harakat keys: fatha · damma · kasra · sukun(jazm ۡ) ·
  shadda · tanween-fath · tanween-damm · tanween-kasr · dagger-alif ·
  subscript-alef · inverted-damma · **maddah** (long-press toggles 6-count ۤ).
- Row 2 (letters): ض ص ث ق ف غ ع ه خ ح ج
- Row 3 (letters): ش س ي ب ل ا ت ن م ك ط
- Row 4 (letters): ذ ء ر ة و ز ظ د
- Actions row: ⌫ delete · → next ayah · ▶ audio

`byChar` maps every char (including codepoint aliases like Uthmani `ْ`
and high madda `ۤ`) to its key element so `setHint(letter/harakat)` and
`flashWrong(ch)` can glow / shake whichever form the matcher refers to.

---

## 7. UI panes

`practice-view.js` mounts three vertical sections:

- **translit-pane** (`.translit-pane`) — wrapped chips, one per word.
  States: future / current / sealed. Constrained: `width:100%`,
  `box-sizing:border-box`, `min/max-height = 2 lines`, internal
  `overflow-y:auto`. After each render the current chip is scrolled
  into view via `scrollIntoPane()`.
- **user-pane** (`.user-pane`) — the Arabic the user has typed. Same
  height/scroll constraints; `overflow-wrap:anywhere`; the last user
  glyph is scrolled into view.
- **progress strip** + **range-complete banner** (mounted from
  `heatmap-strip.js`).

Below the practice view sits **`#rolling-strip`** (mounted by
`rolling-strip.js`):

- Continuous justified RTL paragraph (mushaf feel).
- 14px serif, 2-line height cap, `overflow-y:auto`.
- **Session-only**: never seeded from history; starts empty each app
  open.
- Each verse is rendered through `cleanVerseForDisplay()` (drops PUA
  ornaments + small-high Quranic annotations that render as tofu in
  most system fonts), separated by `۝`. The latest verse is bolded.

---

## 8. Header

`mountHeader` (`src/ui/header.js`) exposes three updaters:

- `updateStats({surah, surahName, surahVerses, ayahsWritten, accuracy})`
  renders the banner:
  `"{surahName}: X/Y ayahs (Z% of surah) · A% accuracy"`.
- `updateSurahAccuracyMap(accMap)` appends a `— N%` suffix to each
  surah option label, and applies the `.surah-opt--low` class
  (red text) when `< 50%`.
- `setReviewMode(on)` toggles the forward-arrow visibility for review
  navigation.

Header surfaces only the **current surah's** accuracy and progress, not
a global Quran-wide figure.

---

## 9. Settings modal

`mountSettingsModal` (`src/ui/settings-modal.js`):

- Reciter (`<select>`), Hint timing (`<select>`), Auto-play (chk),
  Silent-letter color (chk), Stroke width (`<input number>`),
  Quick retry test (chk), Required letters grid, Auto-fill all
  harakat (chk), Reset stats, Close.
- Letters grid order **mirrors the keypad** row-for-row so the user
  scans the same arrangement in both surfaces.
- Selected chip = required letter, shown as a yellow chip
  (`.letter-chip--required` with `box-shadow` inset ring to defeat
  mobile button defaults).
- Every change calls `onChange(patch)` which immediately persists; if
  `requiredLetters` or `requiredHarakat` changed, `main.js` reloads
  the current verse so the matcher picks up the new sets.

---

## 10. Tutorial

`mountIntro` (`src/ui/intro.js`) renders a 7-step tutorial with
Next / Back navigation. Only the last step shows "Don't show again" +
"Start writing"; ticking the box persists `settings.hideIntro=true` so
the tutorial doesn't pop on next launches.

The 7 steps: Welcome → Pick a verse → Read / listen, then write →
Help when you're stuck (green glow) → Three action buttons →
Make it easier (Settings) → That's it (retry test + My Book).

---

## 11. Where to add new things

- **New setting**: add the field to `DEFAULT_SETTINGS`; add a control
  to `settings-modal.js`; read from `state.settings` in `main.js`.
- **New stat**: extend `stats.js` with a writer + reader; call the
  writer at the relevant point in `main.js`; render in `header.js` or
  `my-book.js`.
- **New behavior tied to the matcher**: prefer extending `LiveMatcher`
  via constructor options (the way `requiredLetters` / `requiredHarakat`
  are done) rather than branching in `main.js`.
- **New verse display surface**: route the rawText through
  `cleanVerseForDisplay()` from `src/verse/parser.js`.
- **New tests**: pure-logic only. `tests/_helpers/` has a mock document
  used by the keypad tests. UI/canvas-dependent code is verified in the
  browser.
