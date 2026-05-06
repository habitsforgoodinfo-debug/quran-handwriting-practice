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
