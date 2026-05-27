# Quran Handwriting Practice

A mobile-first Progressive Web App for learning the Quran by typing each
letter and harakat of every verse from an on-screen Arabic keypad. The
matcher accepts only the correct keystroke (with configurable auto-fill
for letters and diacritics the user does not want to drill), records
per-surah accuracy, and runs a short retry test after every 20 verses.

## Run locally

No build step. Serve the project root with any static server:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Run tests

```
node --test tests/
```

Only pure-logic modules are covered by automated tests (parser, skeleton,
live-matcher, transliterate, store, integration). UI / DOM / canvas
modules are exercised manually in the browser.

## Service worker

`service-worker.js` precaches the JSON Quran data and PWA assets, and
serves JS modules cache-first. The `CACHE` constant at the top is bumped
on every release that ships behavior or layout changes — phones reload
the new SW on the second page load after each bump.

## Documentation

- **`docs/ARCHITECTURE.md`** — current design (data flow, modules, data
  model, practice loop, settings, retry test, rolling strip). Refreshed
  in lockstep with the code; the canonical reference for handing off to
  another agent.
- Historical plans and specs live under `docs/superpowers/`. Those are a
  record of how the app got here, not the current state.
