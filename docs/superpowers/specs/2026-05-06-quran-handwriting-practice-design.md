# Quran Handwriting Practice — Design Spec

**Date:** 2026-05-06
**Status:** Approved (pending user review of this document)

## 1. Purpose

A mobile-first web application for practicing handwritten Arabic Quranic verses. The user writes verses freehand on a canvas, one word at a time, and the app compares each word against the canonical text letter-by-letter (and diacritic-by-diacritic). Errors are surfaced immediately so the user can identify which letters or harakat they consistently misremember.

The intended user is someone working from memory who wants targeted feedback on their recall — not a beginner learning the alphabet.

## 2. Goals

- Practice writing any user-selected verse range from any surah.
- Get immediate, letter-level + harakah-level feedback after each word.
- Optionally hear verse audio to assist recall.
- Build, over time, a profile of which letters/harakat the user most often gets wrong.
- Work on a phone, including offline (except for streaming audio).

## 3. Non-goals

- Not a beginner alphabet trainer.
- Not a tajweed coach.
- Not a translation/tafsir tool.
- No accounts, no cloud sync, no social features.
- Not aimed at desktop-first usage (works there, but design priority is mobile).

## 4. Key product decisions

These were settled during brainstorming and shape the rest of the design:

1. **Recognition approach: hybrid (constrained classification).** The app knows the expected verse, so it constrains letter recognition to "which of the expected letters did you draw?" rather than open-vocabulary handwriting recognition. This sidesteps the accuracy trap of general Arabic HWR.
2. **Comparison granularity: per-letter, harakat as separate units.** Each letter is one check; each diacritic is a separate check. The user sees exactly which letter and which harakah was wrong.
3. **Commit gesture: right-to-left swipe.** Matches Arabic flow, won't fire accidentally during writing, no visual button needed.
4. **Per-word feedback, immediate.** A word is graded the moment it's committed. Errors show immediately in the verse display.
5. **Verse display populates only after commit.** No live preview of the word being written; positions are empty until that word is committed.
6. **Silent letter rule:** Any letter with no diacritic is auto-filled (rendered in gray) — the user is not graded on it.
7. **Madd-alif exception:** An alif immediately following a fatha is required user input (it carries the elongation sound), even though it has no diacritic. The parallel cases for waw-after-damma and ya-after-kasra are NOT exceptions, because in Indo-Pak script those letters carry a sukun and are therefore already covered by the "has a diacritic = user writes" rule.
8. **Tech: vanilla JS PWA.** No framework. Static site. Mobile-first.
9. **Text source:** Tanzil Indo-Pak script JSON, bundled (~4 MB).
10. **Audio source:** EveryAyah.com, streamed per verse, default reciter Mishary Alafasy.
11. **Persistence:** IndexedDB. No backend, no accounts.

## 5. Architecture

A single-page client-side web app, installable as a PWA.

**Bundled assets:**
- Full Tanzil Indo-Pak script Quran JSON
- Indo-Pak font file(s) for verse rendering
- Surah metadata (114 surahs, names + verse counts)
- App code

**Runtime external dependencies:**
- EveryAyah.com (audio streaming only)

**Client-side stores:**
- IndexedDB: settings + per-letter/per-harakah error counters + last session state

**Offline behavior:**
- Service worker caches all bundled assets after first load.
- All practice features work offline. Only audio streaming requires network.

## 6. Screen layout

Mobile-first, single screen, three vertical zones (portrait):

```
┌─────────────────────────────────┐
│ [Surah ▼] [From: 1] [To: 7] [⚙]│  Header (~60px)
├─────────────────────────────────┤
│  (verse display — committed     │  Verse display (flex)
│   words appear here in proper   │
│   font; positions empty until   │
│   committed; auto-filled silent │
│   letters in gray)              │
│                                 │
│  [▶ play verse]    [↺ undo]    │
├─────────────────────────────────┤
│                                 │
│       (drawing canvas)          │  Canvas (40-50% viewport)
│                                 │
│  ← swipe right-to-left to commit│
└─────────────────────────────────┘
```

**Landscape:** header full width on top; verse display + canvas side-by-side below.

**Settings modal (⚙):** reciter, font, silent-letter color toggle, stroke color/width, reset stats.

## 7. Data model

### 7.1 Parsed verse structure

Each verse is parsed once at session start into:

```
verse = [word1, word2, ...]
word  = [glyph1, glyph2, ...]
glyph = {
  letter:        "ك",                    // base Arabic letter
  diacritics:    ["fatha"],               // any of: fatha, kasra, damma,
                                          //         sukun, shadda, tanween_fath,
                                          //         tanween_kasr, tanween_damm
  isSilent:      false,                   // true if no diacritic AND not madd-alif
  isMaddAlif:    false                    // true if alif following a fatha
}
```

The parser applies the rule:
- No diacritic on letter AND not a madd-alif → `isSilent = true` → auto-fill (gray).
- Has any diacritic OR is madd-alif → user must write.

### 7.2 Comparison result (per word)

```
result = [
  {
    expected: glyph,
    letterMatch:    "ok" | "wrong" | "missing" | "extra" | "unclear",
    diacriticMatch: "ok" | "wrong" | "missing" | "n/a"
  },
  ...
]
```

### 7.3 Persisted stats (IndexedDB)

```
letterErrors:    Map<arabicLetter, count>
diacriticErrors: Map<diacriticName, count>
lastSession:     { surah, fromAyah, toAyah, currentWordIndex }
settings:        { reciter, font, silentLetterColorOn, strokeColor, strokeWidth }
```

## 8. Recognition pipeline

When the user swipes to commit a word:

1. **Look up expected word** at the current position from the parsed verse structure.
2. **Filter** to non-silent glyphs (the ones the user must write).
3. **Segment strokes** into letter clusters using horizontal-gap analysis (RTL-aware).
4. **Classify each cluster** against the *expected* letters using DTW (Dynamic Time Warping) on font-derived shape templates. Constrained classification: cluster N is matched only against expected non-silent letters in order.
5. **Detect diacritics:** isolated small marks above/below baseline; classify by position + shape.
6. **Align** to produce per-glyph match results (✓ / ✗ / missing / extra / unclear).
7. **Render** to verse display: insert word in proper font; color letters (black/red/gray); color diacritics (red if wrong, normal otherwise).
8. **Update stats** in IndexedDB.
9. **Advance** to next word position. If verse complete → next verse. If range complete → session summary.

### 8.1 Recognition technique

DTW with font-derived shape templates (no ML model). Templates are generated from the bundled Indo-Pak font at build time (or on first load, cached in IndexedDB).

Rationale: the constrained problem (matching against ~3-7 expected letters in a word, not all 28+) makes DTW sufficient. No model download, deterministic, debuggable, mobile-friendly. If accuracy proves insufficient, a TensorFlow.js classifier can be added later without rewriting surrounding modules.

### 8.2 Confidence handling

If DTW score is below a tunable confidence threshold for a cluster, mark the letter as `unclear` (orange, not red), with a tooltip prompting the user to undo + rewrite. Prevents falsely flagging good handwriting as wrong.

## 9. Component breakdown (file structure)

```
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── styles.css
│
├── src/
│   ├── main.js
│   ├── data/
│   │   ├── quran-loader.js
│   │   └── surah-metadata.js
│   ├── verse/
│   │   ├── parser.js              # text → structured glyphs
│   │   └── renderer.js            # glyphs → DOM with color states
│   ├── canvas/
│   │   ├── input.js               # stroke capture
│   │   ├── gestures.js            # commit-swipe detection
│   │   └── segmenter.js           # strokes → letter clusters
│   ├── recognition/
│   │   ├── templates.js           # font-derived templates
│   │   ├── dtw.js
│   │   ├── classifier.js          # constrained matching
│   │   └── diacritic-detector.js
│   ├── compare/
│   │   └── aligner.js             # produces match results
│   ├── audio/
│   │   └── player.js              # EveryAyah URL + playback
│   ├── store/
│   │   ├── settings.js
│   │   └── stats.js
│   └── ui/
│       ├── header.js
│       ├── verse-display.js
│       ├── canvas-view.js
│       ├── settings-modal.js
│       └── summary.js
│
├── assets/
│   ├── fonts/
│   ├── quran/
│   └── icons/
│
└── tests/
    ├── parser.test.js
    ├── dtw.test.js
    ├── segmenter.test.js
    ├── aligner.test.js
    └── ...
```

**Boundaries:**
- `verse/parser.js`, `canvas/segmenter.js`, `recognition/dtw.js`, `compare/aligner.js` are pure functions — no DOM, no state, no IndexedDB. Testable in Node.
- UI modules are the only ones touching the DOM.
- Store modules are the only ones touching IndexedDB.

## 10. Error handling & edge cases

**Recognition:**
- Low DTW confidence → mark letter `unclear` (orange) instead of wrong (red).
- More clusters than expected letters → flag extras as red "extra letter".
- Fewer clusters than expected → missing letters shown as red placeholders.

**Verse parsing:**
- Unknown character in Tanzil text → log + skip, don't crash.
- Invalid range (To < From or out of bounds) → commit disabled until valid.

**Canvas / gestures:**
- Distinguish commit-swipe from stroke by velocity + length + straightness thresholds.
- Empty canvas + swipe → ignored.
- Stray dot → treated as diacritic candidate, not a letter.
- `touch-action: none` on canvas to prevent pinch/scroll interference.

**Audio:**
- Network failure → toast + retry button.
- Browser autoplay policy: first play always requires user tap (already the case).

**Storage:**
- IndexedDB unavailable → fall back to in-memory; warn user that stats won't persist.
- Quota exceeded (extremely unlikely) → drop oldest stat entries.

**Lifecycle:**
- Page reload mid-session → restore last session state (surah/range/current word index) from IndexedDB.
- Service worker update → silent on next visit.

**Assets:**
- Font fails → fall back to system Arabic font; warn in settings.
- Quran JSON fails on first load → error screen with retry. Cached after first success.

## 11. Testing strategy

**Unit tests (Node, no browser):**
- Parser: silent-letter rule, madd-alif exception, shadda + harakah combos, tanween, hand-curated cases from Al-Fatiha, Al-Ikhlas, Ayat al-Kursi.
- DTW: known-pair distance tests, regression cases.
- Segmenter: synthetic stroke inputs → expected cluster counts.
- Aligner: expected + recognized glyphs → correct match labels.
- Settings/stats stores: with mocked IndexedDB.

**Integration tests (Playwright, headless):**
- Load app → select Al-Fatiha 1-1 → simulate "بِسْمِ" strokes → swipe → verify word appears with correct color states.
- Deliberate-error path: simulate wrong letter → verify red in correct position.
- Audio play button triggers fetch (mocked).
- Session summary appears after final verse.

**Manual mobile QA:**
- iOS Safari, Chrome Android: drawing latency, swipe reliability, font rendering, PWA install, offline mode.
- Portrait + landscape.
- Apple Pencil + finger.

## 12. Out of scope (for v1)

- Multiple users / accounts / sync.
- Tajweed feedback.
- Open handwriting recognition (general HWR).
- Translation/tafsir display.
- Word-by-word audio (only verse-level).
- Custom verse ranges across surahs.
- Stats visualizations beyond the end-of-session summary.

## 13. Open questions for implementation

- Specific Indo-Pak font to bundle (license-permitting). Candidates: Noto Naskh Arabic, "Mushaf"-style fonts.
- DTW confidence threshold value — to be tuned empirically during integration testing.
- Build tooling: plain ES modules vs. Vite for dev convenience (decision deferred to plan phase).
