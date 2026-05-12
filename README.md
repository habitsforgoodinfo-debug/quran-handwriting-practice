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

- Undo removes the rendered word and decrements session counters, but does NOT roll back persisted error stats (those are recorded immediately on commit). If you want a clean slate, use Settings → Reset stats.
- Diacritic detection only distinguishes 6 of 9 harakat (fatha, kasra, damma, sukun, tanween_fath, tanween_kasr). Shadda, tanween_damm, and dagger_alif are not yet recognized from handwriting.
- Letter templates use isolated forms only — initial/medial/final positional forms are not yet templated. Recognition accuracy may suffer for connected letters.
- Settings has reciter / silent-letter / stroke-width / reset-stats. Font selector and stroke-color picker are deferred.
- Mid-session reload does not restore the last session.
- Landscape orientation uses the same stacked layout as portrait (no side-by-side variant yet).
- Icons are placeholders; replace before publishing.
