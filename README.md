# Quran Handwriting Practice

A mobile-first Progressive Web App for practicing handwritten Arabic Quran verses, with letter-by-letter feedback against the canonical text.

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

Only pure-logic modules are covered by automated tests. UI / DOM / canvas modules are tested manually in the browser.

## Documentation

- Design spec: `docs/superpowers/specs/2026-05-06-quran-handwriting-practice-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-06-quran-handwriting-practice.md`

## v1 Known Limitations

- Undo is not available in keypad mode — use Clear before submitting if you want to redo input.
- Persisted error stats are recorded immediately on submit; there is no rollback. Use Settings → Reset stats for a clean slate.
- Settings has reciter / silent-letter / stroke-width / reset-stats. Font selector and stroke-color picker are deferred.
- Mid-session reload does not restore the last session.
- Landscape orientation uses the same stacked layout as portrait (no side-by-side variant yet).
- Icons are placeholders; replace before publishing.
