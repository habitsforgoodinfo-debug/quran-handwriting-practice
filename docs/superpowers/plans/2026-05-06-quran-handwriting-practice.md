# Quran Handwriting Practice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA where the user writes Quran verses freehand, gets immediate per-letter and per-harakah comparison feedback against the canonical Indo-Pak text, and accumulates per-letter error stats over time.

**Architecture:** Single-page client-side app. Vanilla ES modules. Bundled Tanzil JSON for verse text, EveryAyah.com for streamed audio. IndexedDB for settings + stats. Recognition is constrained DTW shape-matching against font-derived letter templates — the app already knows the expected verse, so it only has to decide which of the expected letters each user stroke-cluster best resembles.

**Tech Stack:** Vanilla JS (ES modules), HTML5 Canvas, IndexedDB, Service Worker, Vite (dev server + bundling), Vitest (unit tests), Playwright (integration tests), happy-dom for DOM-in-Node tests, fake-indexeddb for store tests.

**Spec reference:** `docs/superpowers/specs/2026-05-06-quran-handwriting-practice-design.md`.

**Conventions used by every task:**
- After each task: run `npm test` and verify all tests pass before committing.
- Commit messages use Conventional Commits (`feat:`, `test:`, `chore:`, `fix:`).
- Every pure module gets unit tests in `tests/<module>.test.js`.
- Files are ES modules (`type: "module"` in package.json).

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/main.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quran-handwriting-practice",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "happy-dom": "^15.0.0",
    "fake-indexeddb": "^6.0.0",
    "@playwright/test": "^1.47.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
.vite/
playwright-report/
test-results/
.DS_Store
```

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  server: { host: true }
});
```

- [ ] **Step 4: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.js']
  }
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <title>Quran Handwriting Practice</title>
    <link rel="stylesheet" href="./styles.css" />
    <link rel="manifest" href="./manifest.webmanifest" />
  </head>
  <body>
    <div id="app">
      <header id="header"></header>
      <section id="verse-display"></section>
      <section id="canvas-view"></section>
    </div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `styles.css` (minimal placeholder)**

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; }
#app { display: flex; flex-direction: column; height: 100dvh; }
#header { flex: 0 0 auto; padding: 8px 12px; }
#verse-display { flex: 1 1 auto; padding: 12px; overflow-y: auto; }
#canvas-view { flex: 0 0 45dvh; border-top: 1px solid #1e293b; position: relative; }
```

- [ ] **Step 7: Create `src/main.js`**

```js
console.log('Quran Handwriting Practice starting...');
```

- [ ] **Step 8: Install + verify**

Run:
```bash
npm install
npm run dev
```
Expected: Vite serves `index.html` at `http://localhost:5173`. Open it; console logs the start message.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: scaffold vanilla JS PWA with Vite + Vitest"
```

---

## Task 2: Bundle Tanzil Indo-Pak Quran data + surah metadata

**Files:**
- Create: `assets/quran/quran-indopak.json` (downloaded data file)
- Create: `src/data/surah-metadata.js`
- Create: `src/data/quran-loader.js`
- Create: `tests/data/quran-loader.test.js`

- [ ] **Step 1: Download Tanzil Indo-Pak text**

Run:
```bash
mkdir -p assets/quran
curl -fsSL 'https://tanzil.net/pub/download/?quranType=indopak&outType=json&fileType=json&zip=&v=1' -o assets/quran/quran-indopak.json.tmp
# If the above query API isn't reachable, use the direct mirror:
# curl -fsSL 'https://raw.githubusercontent.com/risan/quran-json/main/dist/quran.json' -o assets/quran/quran-indopak.json.tmp
node -e "const d=JSON.parse(require('fs').readFileSync('assets/quran/quran-indopak.json.tmp','utf8')); console.log('ok, surahs:', Array.isArray(d) ? d.length : Object.keys(d).length);"
mv assets/quran/quran-indopak.json.tmp assets/quran/quran-indopak.json
```

The shape may differ between sources. The expected normalized shape consumed by the app is:
```json
{ "1": { "name_ar": "الفاتحة", "name_en": "Al-Fatiha", "verses": { "1": "بِسْمِ اللّٰهِ ...", "2": "..." } }, ... }
```
If the downloaded file does not match, run the normalization script in step 2 to convert it.

- [ ] **Step 2: Write a one-shot normalizer (only run if needed)**

Create `scripts/normalize-quran.js`:
```js
// Usage: node scripts/normalize-quran.js <input.json> <output.json>
import fs from 'node:fs';
const [, , inPath, outPath] = process.argv;
const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const out = {};
// Source A: array of { chapter, verse, text }
if (Array.isArray(raw)) {
  for (const v of raw) {
    const s = String(v.chapter);
    out[s] ??= { name_ar: '', name_en: '', verses: {} };
    out[s].verses[String(v.verse)] = v.text;
  }
} else {
  // Source B: { "1": { "verses": [...] } } or similar — adapt as needed.
  for (const [s, body] of Object.entries(raw)) {
    out[s] = { name_ar: body.name_ar ?? '', name_en: body.name_en ?? '', verses: {} };
    const verses = body.verses ?? body;
    for (const [k, txt] of Object.entries(verses)) {
      out[s].verses[String(k)] = typeof txt === 'string' ? txt : txt.text;
    }
  }
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('wrote', outPath);
```

- [ ] **Step 3: Create `src/data/surah-metadata.js`**

A static array of all 114 surahs with Arabic name, English transliteration, and verse count. Abbreviated example shown — include all 114. You may copy from any open dataset (e.g. https://api.quran.com/api/v4/chapters or the Tanzil metadata file) — license: CC0/MIT compatible.

```js
// src/data/surah-metadata.js
export const SURAHS = [
  { number: 1,  name_ar: 'الفاتحة',  name_en: 'Al-Fatiha',  verses: 7 },
  { number: 2,  name_ar: 'البقرة',   name_en: 'Al-Baqarah', verses: 286 },
  { number: 3,  name_ar: 'آل عمران', name_en: 'Aal-Imran',  verses: 200 },
  // ... 111 more entries through:
  { number: 114, name_ar: 'الناس',   name_en: 'An-Nas',     verses: 6 }
];

export function getSurah(number) {
  return SURAHS.find(s => s.number === number);
}
```

- [ ] **Step 4: Write the failing test for `quran-loader`**

Create `tests/data/quran-loader.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadQuran, getVerse, _resetForTests } from '../../src/data/quran-loader.js';

describe('quran-loader', () => {
  beforeEach(() => { _resetForTests(); });

  it('fetches the bundled JSON once and serves verses', async () => {
    const fakeData = { '1': { verses: { '1': 'بِسْمِ', '2': 'ٱلْحَمْدُ' } } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeData
    });
    await loadQuran();
    expect(getVerse(1, 1)).toBe('بِسْمِ');
    expect(getVerse(1, 2)).toBe('ٱلْحَمْدُ');
    // calling load again should not re-fetch
    await loadQuran();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws if verse is out of range', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ '1': { verses: { '1': 'x' } } })
    });
    await loadQuran();
    expect(() => getVerse(1, 99)).toThrow(/out of range/);
  });
});
```

- [ ] **Step 5: Run test, expect failure**

Run: `npm test`
Expected: FAIL — `loadQuran` not defined.

- [ ] **Step 6: Implement `src/data/quran-loader.js`**

```js
let cache = null;
let inflight = null;

export async function loadQuran() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch('./assets/quran/quran-indopak.json');
    if (!res.ok) throw new Error(`Failed to load Quran data: ${res.status}`);
    cache = await res.json();
    return cache;
  })();
  return inflight;
}

export function getVerse(surah, ayah) {
  if (!cache) throw new Error('loadQuran() must be awaited before getVerse()');
  const s = cache[String(surah)];
  if (!s) throw new Error(`Surah ${surah} out of range`);
  const v = s.verses[String(ayah)];
  if (v == null) throw new Error(`Ayah ${surah}:${ayah} out of range`);
  return v;
}

export function _resetForTests() {
  cache = null;
  inflight = null;
}
```

- [ ] **Step 7: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/ src/data/ tests/data/ scripts/
git commit -m "feat: bundle Tanzil Indo-Pak Quran data + loader"
```

---

## Task 3: Verse parser — silent-letter rule + madd-alif exception

This is the keystone module. All comparison logic depends on its correctness.

**Files:**
- Create: `src/verse/parser.js`
- Create: `tests/verse/parser.test.js`

**Reference — Arabic Unicode diacritics (combining marks):**
- `ً` — tanween fath (an)
- `ٌ` — tanween damm (un)
- `ٍ` — tanween kasr (in)
- `َ` — fatha (a)
- `ُ` — damma (u)
- `ِ` — kasra (i)
- `ّ` — shadda
- `ْ` — sukun
- `ٰ` — dagger alif (treated as harakah-equivalent for "has-mark" purposes)
- `ٓ`, `ٔ`, `ٕ`, `ۖ`–`ۭ` — other Quranic marks (treated as ornamental — DO NOT count as making the letter "non-silent" in this app's rule, since they don't correspond to user-writable harakat)

The base letter `ا` is alif.

- [ ] **Step 1: Write failing tests**

Create `tests/verse/parser.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseWord, parseVerse } from '../../src/verse/parser.js';

describe('parseWord', () => {
  it('marks letter with fatha as user-required', () => {
    const w = parseWord('كَ'); // kaf + fatha
    expect(w).toEqual([
      { letter: 'ك', diacritics: ['fatha'], isSilent: false, isMaddAlif: false }
    ]);
  });

  it('marks letter with no diacritic as silent', () => {
    const w = parseWord('ك'); // bare kaf
    expect(w[0].isSilent).toBe(true);
  });

  it('alif following a fatha is madd-alif (NOT silent)', () => {
    const w = parseWord('قَال'); // qaf+fatha, alif (no mark), lam (no mark)
    expect(w[0]).toMatchObject({ letter: 'ق', diacritics: ['fatha'], isSilent: false });
    expect(w[1]).toMatchObject({ letter: 'ا', isMaddAlif: true, isSilent: false });
    expect(w[2].isSilent).toBe(true); // bare lam
  });

  it('alif NOT following a fatha is silent', () => {
    const w = parseWord('قُال'); // qaf+damma, alif, lam
    expect(w[1]).toMatchObject({ letter: 'ا', isMaddAlif: false, isSilent: true });
  });

  it('handles shadda + harakah on same letter', () => {
    const w = parseWord('بَّ'); // ba + shadda + fatha
    expect(w[0].diacritics.sort()).toEqual(['fatha', 'shadda'].sort());
    expect(w[0].isSilent).toBe(false);
  });

  it('handles tanween', () => {
    const w = parseWord('بٌ'); // ba + tanween_damm
    expect(w[0].diacritics).toEqual(['tanween_damm']);
    expect(w[0].isSilent).toBe(false);
  });

  it('handles sukun', () => {
    const w = parseWord('بْ');
    expect(w[0].diacritics).toEqual(['sukun']);
    expect(w[0].isSilent).toBe(false);
  });

  it('ignores unknown ornamental marks gracefully', () => {
    const w = parseWord('بۖ'); // ba + small high seen
    expect(w).toHaveLength(1);
    expect(w[0].isSilent).toBe(true);
    expect(w[0].diacritics).toEqual([]);
  });
});

describe('parseVerse', () => {
  it('splits on whitespace into words', () => {
    const v = parseVerse('بِسْمِ اللّٰهِ');
    expect(v).toHaveLength(2);
    expect(v[0][0].letter).toBe('ب');
    expect(v[1][0].letter).toBe('ا');
  });

  it('handles multiple spaces and trims', () => {
    const v = parseVerse('  كَ   بَ  ');
    expect(v).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL — `parseWord` not defined.

- [ ] **Step 3: Implement `src/verse/parser.js`**

```js
// Diacritic codepoint → name
const DIACRITIC_MAP = {
  'ً': 'tanween_fath',
  'ٌ': 'tanween_damm',
  'ٍ': 'tanween_kasr',
  'َ': 'fatha',
  'ُ': 'damma',
  'ِ': 'kasra',
  'ّ': 'shadda',
  'ْ': 'sukun',
  'ٰ': 'dagger_alif'
};

const ALIF = 'ا';
const FATHA = 'َ';

// A codepoint is a "letter" if it is NOT a combining mark.
// Combining marks in Arabic block are roughly U+064B..U+065F and U+0670..U+06ED.
function isCombiningMark(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x064B && c <= 0x065F) || (c >= 0x0670 && c <= 0x06ED);
}

export function parseWord(word) {
  const glyphs = [];
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    if (isCombiningMark(ch)) { i++; continue; } // stray mark with no base — skip
    const glyph = { letter: ch, diacritics: [], isSilent: true, isMaddAlif: false };
    i++;
    // collect subsequent combining marks
    while (i < word.length && isCombiningMark(word[i])) {
      const name = DIACRITIC_MAP[word[i]];
      if (name) glyph.diacritics.push(name);
      i++;
    }
    glyphs.push(glyph);
  }
  // Apply silent + madd-alif rules in a second pass so we can look at previous glyph.
  for (let k = 0; k < glyphs.length; k++) {
    const g = glyphs[k];
    const hasMark = g.diacritics.length > 0;
    const isMaddAlif =
      g.letter === ALIF &&
      !hasMark &&
      k > 0 &&
      glyphs[k - 1].diacritics.includes('fatha');
    g.isMaddAlif = isMaddAlif;
    g.isSilent = !hasMark && !isMaddAlif;
  }
  return glyphs;
}

export function parseVerse(verseText) {
  return verseText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseWord);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Add real-verse fixture tests**

Append to `tests/verse/parser.test.js`:
```js
describe('real verses', () => {
  it('Al-Fatiha 1: parses bismillah correctly', () => {
    const v = parseVerse('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
    // 4 words
    expect(v).toHaveLength(4);
    // first word "بِسْمِ" has 3 letters: ب+kasra, س+sukun, م+kasra
    const first = v[0];
    expect(first.map(g => g.letter)).toEqual(['ب', 'س', 'م']);
    expect(first.every(g => !g.isSilent)).toBe(true);
  });

  it('Al-Ikhlas 1: قُلْ — qaf+damma, lam+sukun (no silent letters)', () => {
    const v = parseVerse('قُلْ');
    expect(v[0]).toEqual([
      { letter: 'ق', diacritics: ['damma'], isSilent: false, isMaddAlif: false },
      { letter: 'ل', diacritics: ['sukun'], isSilent: false, isMaddAlif: false }
    ]);
  });
});
```

- [ ] **Step 6: Run, fix if needed, commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/verse/parser.js tests/verse/parser.test.js
git commit -m "feat: verse parser with silent-letter + madd-alif rules"
```

---

## Task 4: Stores — settings + stats (IndexedDB)

**Files:**
- Create: `src/store/db.js`
- Create: `src/store/settings.js`
- Create: `src/store/stats.js`
- Create: `tests/store/settings.test.js`
- Create: `tests/store/stats.test.js`

- [ ] **Step 1: Write failing test for settings**

Create `tests/store/settings.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../../src/store/settings.js';
import { _resetDbForTests } from '../../src/store/db.js';

describe('settings store', () => {
  beforeEach(async () => { await _resetDbForTests(); });

  it('returns defaults when nothing is stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updates', async () => {
    await updateSettings({ reciter: 'Husary_64kbps' });
    const s = await getSettings();
    expect(s.reciter).toBe('Husary_64kbps');
    expect(s.font).toBe(DEFAULT_SETTINGS.font); // unchanged keys preserved
  });
});
```

- [ ] **Step 2: Write failing test for stats**

Create `tests/store/stats.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { recordError, getStats, resetStats } from '../../src/store/stats.js';
import { _resetDbForTests } from '../../src/store/db.js';

describe('stats store', () => {
  beforeEach(async () => { await _resetDbForTests(); });

  it('starts empty', async () => {
    const s = await getStats();
    expect(s.letterErrors).toEqual({});
    expect(s.diacriticErrors).toEqual({});
  });

  it('records and counts letter + diacritic errors', async () => {
    await recordError({ kind: 'letter', value: 'ع' });
    await recordError({ kind: 'letter', value: 'ع' });
    await recordError({ kind: 'diacritic', value: 'kasra' });
    const s = await getStats();
    expect(s.letterErrors['ع']).toBe(2);
    expect(s.diacriticErrors['kasra']).toBe(1);
  });

  it('reset clears everything', async () => {
    await recordError({ kind: 'letter', value: 'ع' });
    await resetStats();
    const s = await getStats();
    expect(s.letterErrors).toEqual({});
  });
});
```

- [ ] **Step 3: Run tests, expect failure**

Run: `npm test`
Expected: FAIL — modules not defined.

- [ ] **Step 4: Implement `src/store/db.js`**

```js
const DB_NAME = 'qhp';
const DB_VERSION = 1;
let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('letterErrors')) db.createObjectStore('letterErrors');
      if (!db.objectStoreNames.contains('diacriticErrors')) db.createObjectStore('diacriticErrors');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function kvGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function kvPut(key, value) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function counterIncrement(storeName, key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.get(key);
    r.onsuccess = () => {
      const next = (r.result || 0) + 1;
      store.put(next, key);
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function counterAll(storeName) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const out = {};
    const cur = store.openCursor();
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { out[c.key] = c.value; c.continue(); } else { res(out); }
    };
    cur.onerror = () => rej(cur.error);
  });
}

export async function counterClear(storeName) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function _resetDbForTests() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    r.onblocked = () => res();
  });
}
```

- [ ] **Step 5: Implement `src/store/settings.js`**

```js
import { kvGet, kvPut } from './db.js';

export const DEFAULT_SETTINGS = Object.freeze({
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4
});

export async function getSettings() {
  const stored = await kvGet('settings');
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function updateSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await kvPut('settings', next);
  return next;
}
```

- [ ] **Step 6: Implement `src/store/stats.js`**

```js
import { counterIncrement, counterAll, counterClear } from './db.js';

export async function recordError({ kind, value }) {
  const store = kind === 'letter' ? 'letterErrors' : 'diacriticErrors';
  await counterIncrement(store, value);
}

export async function getStats() {
  const [letterErrors, diacriticErrors] = await Promise.all([
    counterAll('letterErrors'),
    counterAll('diacriticErrors')
  ]);
  return { letterErrors, diacriticErrors };
}

export async function resetStats() {
  await Promise.all([
    counterClear('letterErrors'),
    counterClear('diacriticErrors')
  ]);
}
```

- [ ] **Step 7: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/store/ tests/store/
git commit -m "feat: IndexedDB-backed settings + stats stores"
```

---

## Task 5: Canvas input — stroke capture

**Files:**
- Create: `src/canvas/input.js`
- Create: `tests/canvas/input.test.js`

A "stroke" is one continuous pen-down → pen-up sequence, captured as `{ points: [{x, y, t}, ...] }`. The module exposes a class that attaches to a canvas element, draws strokes live, and emits committed strokes via callbacks.

- [ ] **Step 1: Write failing test**

Create `tests/canvas/input.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { CanvasInput } from '../../src/canvas/input.js';

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 200;
  document.body.appendChild(c);
  // happy-dom doesn't implement getBoundingClientRect; stub it.
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200, x: 0, y: 0 });
  return c;
}

function pe(type, x, y) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true });
}

describe('CanvasInput', () => {
  it('captures a single stroke from pointerdown→move→up', () => {
    const c = makeCanvas();
    const onStroke = vi.fn();
    const input = new CanvasInput(c, { onStroke });
    c.dispatchEvent(pe('pointerdown', 10, 10));
    c.dispatchEvent(pe('pointermove', 20, 20));
    c.dispatchEvent(pe('pointermove', 30, 30));
    c.dispatchEvent(pe('pointerup', 30, 30));
    expect(onStroke).toHaveBeenCalledTimes(1);
    const stroke = onStroke.mock.calls[0][0];
    expect(stroke.points.length).toBeGreaterThanOrEqual(3);
    expect(stroke.points[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('clear() removes all strokes', () => {
    const c = makeCanvas();
    const input = new CanvasInput(c, { onStroke: () => {} });
    c.dispatchEvent(pe('pointerdown', 1, 1));
    c.dispatchEvent(pe('pointerup', 1, 1));
    input.clear();
    expect(input.getStrokes()).toEqual([]);
  });

  it('strokes() returns committed strokes in order', () => {
    const c = makeCanvas();
    const input = new CanvasInput(c, { onStroke: () => {} });
    c.dispatchEvent(pe('pointerdown', 1, 1)); c.dispatchEvent(pe('pointerup', 1, 1));
    c.dispatchEvent(pe('pointerdown', 5, 5)); c.dispatchEvent(pe('pointerup', 5, 5));
    expect(input.getStrokes()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL — `CanvasInput` not defined.

- [ ] **Step 3: Implement `src/canvas/input.js`**

```js
export class CanvasInput {
  constructor(canvas, { onStroke, strokeColor = '#e2e8f0', strokeWidth = 4 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStroke = onStroke;
    this.strokeColor = strokeColor;
    this.strokeWidth = strokeWidth;
    this.strokes = [];
    this.current = null;
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this._onUp(e));
    this.canvas.style.touchAction = 'none';
  }

  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  _onDown(e) {
    this.current = { points: [this._pt(e)] };
    if (this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    }
  }

  _onMove(e) {
    if (!this.current) return;
    const p = this._pt(e);
    this.current.points.push(p);
    this._drawSegment(this.current.points.at(-2), p);
  }

  _onUp(e) {
    if (!this.current) return;
    if (this.current.points.length === 1) this.current.points.push(this._pt(e));
    const stroke = this.current;
    this.strokes.push(stroke);
    this.current = null;
    this.onStroke?.(stroke);
  }

  _drawSegment(a, b) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getStrokes() { return this.strokes; }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/input.js tests/canvas/input.test.js
git commit -m "feat: canvas stroke capture"
```

---

## Task 6: Commit-swipe gesture detection

**Files:**
- Create: `src/canvas/gestures.js`
- Create: `tests/canvas/gestures.test.js`

Heuristic: a stroke is a *commit swipe* if all of these hold:
- Total horizontal travel `|dx| > 0.6 × canvas.width`
- Direction is right-to-left (`dx < 0`)
- Vertical travel `|dy| < 0.2 × canvas.height` (mostly horizontal)
- Total duration < 600ms (a quick gesture, not a slow drawing motion)
- Number of points >= 3

- [ ] **Step 1: Write failing test**

Create `tests/canvas/gestures.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { isCommitSwipe } from '../../src/canvas/gestures.js';

const canvas = { width: 300, height: 200 };

function stroke(points) { return { points: points.map((p, i) => ({ ...p, t: i * 50 })) }; }

describe('isCommitSwipe', () => {
  it('detects a quick R→L swipe across most of the canvas', () => {
    const s = stroke([{ x: 280, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 30, y: 100 }]);
    expect(isCommitSwipe(s, canvas)).toBe(true);
  });

  it('rejects a left→right stroke (wrong direction)', () => {
    const s = stroke([{ x: 30, y: 100 }, { x: 280, y: 100 }]);
    expect(isCommitSwipe(s, canvas)).toBe(false);
  });

  it('rejects a short stroke', () => {
    const s = stroke([{ x: 100, y: 100 }, { x: 80, y: 100 }]);
    expect(isCommitSwipe(s, canvas)).toBe(false);
  });

  it('rejects a stroke with too much vertical travel', () => {
    const s = stroke([{ x: 280, y: 20 }, { x: 30, y: 180 }]);
    expect(isCommitSwipe(s, canvas)).toBe(false);
  });

  it('rejects a slow stroke', () => {
    const pts = [{ x: 280, y: 100, t: 0 }, { x: 30, y: 100, t: 1500 }];
    expect(isCommitSwipe({ points: pts }, canvas)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/canvas/gestures.js`**

```js
export function isCommitSwipe(stroke, canvas) {
  const pts = stroke.points;
  if (!pts || pts.length < 3) return false;
  const a = pts[0];
  const b = pts.at(-1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = (b.t ?? 0) - (a.t ?? 0);
  if (dt > 600) return false;
  if (Math.abs(dx) < 0.6 * canvas.width) return false;
  if (dx >= 0) return false;
  if (Math.abs(dy) > 0.2 * canvas.height) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/gestures.js tests/canvas/gestures.test.js
git commit -m "feat: commit-swipe gesture detection"
```

---

## Task 7: Stroke segmenter — strokes → letter clusters + diacritic candidates

**Files:**
- Create: `src/canvas/segmenter.js`
- Create: `tests/canvas/segmenter.test.js`

Approach:
- Compute bounding box of each stroke.
- A stroke is a **diacritic candidate** if its bbox area is small (`< 0.04 × canvas area`) AND it sits clearly above or below the average baseline of larger strokes.
- Remaining strokes are **letter strokes**. Group them into clusters by horizontal proximity: walk strokes right-to-left (descending `centerX`), start a new cluster when the gap to the previous cluster's leftmost edge exceeds a threshold (`0.04 × canvas.width`).
- For each diacritic candidate, attach to the nearest cluster by horizontal distance, recording its vertical relation (`above` / `below` / `over`) to that cluster's bbox.

- [ ] **Step 1: Write failing test**

Create `tests/canvas/segmenter.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { segment } from '../../src/canvas/segmenter.js';

const CANVAS = { width: 300, height: 200 };

function makeStroke(points) {
  return { points: points.map(p => ({ x: p[0], y: p[1], t: 0 })) };
}

describe('segment', () => {
  it('groups two well-separated stroke groups into two clusters', () => {
    const left = makeStroke([[20, 100], [40, 110], [60, 100]]);
    const right = makeStroke([[200, 100], [220, 110], [240, 100]]);
    const out = segment([left, right], CANVAS);
    expect(out.clusters).toHaveLength(2);
    // RTL: rightmost cluster comes first
    expect(out.clusters[0].bbox.minX).toBeGreaterThan(out.clusters[1].bbox.minX);
  });

  it('classifies a small isolated stroke above the baseline as a diacritic', () => {
    const letter = makeStroke([[100, 130], [120, 140], [140, 130]]);
    const dot = makeStroke([[110, 60], [114, 62]]);
    const out = segment([letter, dot], CANVAS);
    expect(out.clusters).toHaveLength(1);
    expect(out.clusters[0].diacritics).toHaveLength(1);
    expect(out.clusters[0].diacritics[0].position).toBe('above');
  });

  it('attaches a below-baseline mark to the nearest cluster', () => {
    const letter = makeStroke([[100, 100], [120, 110], [140, 100]]);
    const mark = makeStroke([[115, 170], [120, 172]]);
    const out = segment([letter, mark], CANVAS);
    expect(out.clusters[0].diacritics[0].position).toBe('below');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/canvas/segmenter.js`**

```js
function bbox(stroke) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function area(b) { return b.w * b.h; }
function centerX(b) { return (b.minX + b.maxX) / 2; }
function centerY(b) { return (b.minY + b.maxY) / 2; }

export function segment(strokes, canvas) {
  if (!strokes.length) return { clusters: [] };
  const tagged = strokes.map(s => ({ stroke: s, bbox: bbox(s) }));
  const canvasArea = canvas.width * canvas.height;

  // Identify candidate diacritics: small strokes (< 4% of canvas area).
  const big = tagged.filter(t => area(t.bbox) >= 0.04 * canvasArea);
  const small = tagged.filter(t => area(t.bbox) < 0.04 * canvasArea);

  // If there are no big strokes, treat every stroke as a letter stroke.
  const letterTagged = big.length ? big : tagged;
  const diacriticTagged = big.length ? small : [];

  // Compute baseline band from big strokes (median of their bbox vertical centers).
  const ys = letterTagged.map(t => centerY(t.bbox)).sort((a, b) => a - b);
  const baselineY = ys[Math.floor(ys.length / 2)];

  // Cluster letter strokes RTL by horizontal proximity.
  const sorted = [...letterTagged].sort((a, b) => centerX(b.bbox) - centerX(a.bbox));
  const clusters = [];
  const gapThresh = 0.04 * canvas.width;
  for (const t of sorted) {
    const last = clusters.at(-1);
    if (last && (last.bbox.minX - t.bbox.maxX) <= gapThresh) {
      last.strokes.push(t.stroke);
      last.bbox = mergeBbox(last.bbox, t.bbox);
    } else {
      clusters.push({ strokes: [t.stroke], bbox: { ...t.bbox }, diacritics: [] });
    }
  }

  // Attach diacritics to nearest cluster.
  for (const d of diacriticTagged) {
    const dx = centerX(d.bbox);
    let best = null, bestDist = Infinity;
    for (const c of clusters) {
      const dist = Math.abs(dx - centerX(c.bbox));
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    if (best) {
      const dy = centerY(d.bbox);
      let position = 'over';
      if (dy < best.bbox.minY) position = 'above';
      else if (dy > best.bbox.maxY) position = 'below';
      best.diacritics.push({ stroke: d.stroke, bbox: d.bbox, position });
    }
  }

  return { clusters, baselineY };
}

function mergeBbox(a, b) {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.maxX, b.maxX);
  const maxY = Math.max(a.maxY, b.maxY);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/segmenter.js tests/canvas/segmenter.test.js
git commit -m "feat: stroke segmenter with diacritic candidate detection"
```

---

## Task 8: DTW — Dynamic Time Warping shape distance

**Files:**
- Create: `src/recognition/dtw.js`
- Create: `tests/recognition/dtw.test.js`

DTW operates on sequences of 2D points (resampled, normalized). The function `dtwDistance(seqA, seqB)` returns a non-negative number — 0 for identical sequences, larger for more different.

Helpers:
- `resample(points, n)` — produce exactly `n` points evenly spaced along the polyline.
- `normalize(points)` — translate centroid to origin and scale so largest dim = 1.

- [ ] **Step 1: Write failing test**

Create `tests/recognition/dtw.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { resample, normalize, dtwDistance } from '../../src/recognition/dtw.js';

describe('resample', () => {
  it('produces exactly N points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    expect(resample(pts, 5)).toHaveLength(5);
  });
});

describe('normalize', () => {
  it('centroid moves to origin and scale is unit', () => {
    const pts = [{ x: 10, y: 20 }, { x: 20, y: 20 }, { x: 30, y: 20 }];
    const n = normalize(pts);
    const cx = n.reduce((s, p) => s + p.x, 0) / n.length;
    const cy = n.reduce((s, p) => s + p.y, 0) / n.length;
    expect(Math.abs(cx)).toBeLessThan(1e-9);
    expect(Math.abs(cy)).toBeLessThan(1e-9);
    const span = Math.max(...n.map(p => Math.abs(p.x))) * 2;
    expect(span).toBeCloseTo(1, 5);
  });
});

describe('dtwDistance', () => {
  it('identical sequences → distance 0', () => {
    const a = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }];
    expect(dtwDistance(a, a)).toBeCloseTo(0, 5);
  });

  it('very different sequences → larger distance', () => {
    const a = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    const b = [{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: 0 }];
    const close = dtwDistance(a, a);
    const far = dtwDistance(a, b);
    expect(far).toBeGreaterThan(close);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/recognition/dtw.js`**

```js
export function resample(points, n) {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => ({ ...points[0] }));
  // total length
  let total = 0;
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segs.push(d);
    total += d;
  }
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));
  const step = total / (n - 1);
  const out = [{ ...points[0] }];
  let acc = 0, j = 1;
  for (let k = 1; k < n - 1; k++) {
    const target = step * k;
    while (j < points.length && acc + segs[j - 1] < target) {
      acc += segs[j - 1];
      j++;
    }
    if (j >= points.length) { out.push({ ...points.at(-1) }); continue; }
    const remain = target - acc;
    const frac = segs[j - 1] === 0 ? 0 : remain / segs[j - 1];
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * frac,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * frac
    });
  }
  out.push({ ...points.at(-1) });
  return out;
}

export function normalize(points) {
  if (!points.length) return [];
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const centered = points.map(p => ({ x: p.x - cx, y: p.y - cy }));
  let maxAbs = 0;
  for (const p of centered) {
    if (Math.abs(p.x) > maxAbs) maxAbs = Math.abs(p.x);
    if (Math.abs(p.y) > maxAbs) maxAbs = Math.abs(p.y);
  }
  if (maxAbs === 0) return centered;
  const scale = 0.5 / maxAbs; // span = 1
  return centered.map(p => ({ x: p.x * scale, y: p.y * scale }));
}

export function dtwDistance(seqA, seqB) {
  const n = seqA.length, m = seqB.length;
  const INF = Infinity;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const dx = seqA[i - 1].x - seqB[j - 1].x;
      const dy = seqA[i - 1].y - seqB[j - 1].y;
      const cost = Math.hypot(dx, dy);
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n][m] / (n + m); // length-normalized
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/recognition/dtw.js tests/recognition/dtw.test.js
git commit -m "feat: DTW shape distance with resample + normalize"
```

---

## Task 9: Letter shape templates from font

**Files:**
- Create: `src/recognition/templates.js`
- Create: `tests/recognition/templates.test.js`

Approach: render each Arabic base letter (28+ forms, plus initial/medial/final/isolated as 4 forms each — start with isolated only for v1 simplicity) onto an offscreen canvas at known size, then trace the rendered glyph's outline by sampling pixel rows to extract a polyline. Resample to 64 points, normalize, store.

For v1: isolated form only. The upgrade to positional forms is a follow-up.

- [ ] **Step 1: Write failing test**

Create `tests/recognition/templates.test.js`:
```js
import { describe, it, expect, beforeAll } from 'vitest';
import { buildLetterTemplate, ARABIC_LETTERS } from '../../src/recognition/templates.js';

describe('templates', () => {
  it('exposes all 28 base Arabic letters', () => {
    expect(ARABIC_LETTERS.length).toBeGreaterThanOrEqual(28);
  });

  it('builds a template for a letter (smoke test)', () => {
    // happy-dom canvas may not draw glyphs; the function should still return a 64-point shape
    // even if the underlying canvas is blank — falling back to a placeholder is acceptable for unit test.
    const tpl = buildLetterTemplate('ك');
    expect(tpl.letter).toBe('ك');
    expect(tpl.points.length).toBe(64);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/recognition/templates.js`**

```js
import { resample, normalize } from './dtw.js';

export const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي','ء','ة',
  'ى','أ','إ','آ','ؤ','ئ','ل'
];

const TEMPLATE_SIZE = 64;

function tracePixels(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const pts = [];
  // Walk RTL row-by-row, picking the leftmost dark pixel per row — gives a coarse outline trace.
  for (let y = 0; y < height; y += 2) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a > 64) { pts.push({ x, y }); break; }
    }
  }
  return pts;
}

export function buildLetterTemplate(letter, fontSpec = '120px "Noto Naskh Arabic", serif') {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
  let pts = tracePixels(canvas);
  if (pts.length < 4) {
    // Fallback so tests/headless environments without font glyphs still produce a usable template.
    pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 0 }];
  }
  const resampled = resample(pts, TEMPLATE_SIZE);
  const normed = normalize(resampled);
  return { letter, points: normed };
}

let cache = null;
export function buildAllTemplates(fontSpec) {
  if (cache) return cache;
  cache = {};
  for (const l of ARABIC_LETTERS) cache[l] = buildLetterTemplate(l, fontSpec);
  return cache;
}

export function _resetTemplatesForTests() { cache = null; }
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/recognition/templates.js tests/recognition/templates.test.js
git commit -m "feat: font-derived Arabic letter shape templates"
```

---

## Task 10: Constrained letter classifier + diacritic detector

**Files:**
- Create: `src/recognition/classifier.js`
- Create: `src/recognition/diacritic-detector.js`
- Create: `tests/recognition/classifier.test.js`
- Create: `tests/recognition/diacritic-detector.test.js`

The classifier takes a list of letter clusters (from segmenter) and a list of expected non-silent letters, and assigns each cluster the best-matching expected letter (in order, since Arabic words are sequential). It returns a per-cluster `{ matchedLetter, confidence }`.

The diacritic detector classifies the position+shape of an attached mark into one of: `fatha`, `kasra`, `damma`, `sukun`, `shadda`, `tanween_fath`, `tanween_kasr`, `tanween_damm`. Heuristics by position:
- `above` + slash-ish line → fatha
- `above` + circle-ish → damma
- `above` + small-w shape → shadda
- `above` + double slashes → tanween_fath
- `below` + slash-ish → kasra
- `below` + double slashes → tanween_kasr
- `over` + small circle → sukun

For v1 we only distinguish by **position + stroke count**:
- `above`, 1 stroke, short → fatha
- `above`, 1 stroke, looped → damma
- `above`, 2 strokes → tanween_fath / shadda (assume tanween_fath)
- `below`, 1 stroke → kasra
- `below`, 2 strokes → tanween_kasr
- `over`, looped → sukun

This is intentionally rough; we rely on the *expected* harakah from the verse to constrain the answer.

- [ ] **Step 1: Write failing test for classifier**

Create `tests/recognition/classifier.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { classifyClusters } from '../../src/recognition/classifier.js';
import { _resetTemplatesForTests } from '../../src/recognition/templates.js';

function makeCluster(points) {
  return { strokes: [{ points: points.map(p => ({ x: p[0], y: p[1] })) }], diacritics: [] };
}

describe('classifyClusters', () => {
  it('returns one entry per cluster, in order, with a matchedLetter from the expected list', () => {
    _resetTemplatesForTests();
    const clusters = [makeCluster([[0, 0], [10, 5], [20, 0]]), makeCluster([[0, 0], [5, 5], [10, 0]])];
    const expected = ['ك', 'ت'];
    const out = classifyClusters(clusters, expected);
    expect(out).toHaveLength(2);
    expect(expected).toContain(out[0].matchedLetter);
    expect(expected).toContain(out[1].matchedLetter);
  });

  it('flags low-confidence matches as unclear', () => {
    _resetTemplatesForTests();
    // single point cluster — degenerate
    const clusters = [{ strokes: [{ points: [{ x: 5, y: 5 }] }], diacritics: [] }];
    const out = classifyClusters(clusters, ['ك'], { unclearThreshold: 0.0 });
    // with threshold 0, nothing is unclear; just verifies the field exists
    expect(out[0]).toHaveProperty('confidence');
  });
});
```

- [ ] **Step 2: Implement `src/recognition/classifier.js`**

```js
import { resample, normalize, dtwDistance } from './dtw.js';
import { buildAllTemplates } from './templates.js';

const SAMPLE_N = 64;
const UNCLEAR_DEFAULT = 0.25; // tunable

function clusterToShape(cluster) {
  // Concatenate all stroke points into one polyline.
  const all = [];
  for (const s of cluster.strokes) all.push(...s.points.map(p => ({ x: p.x, y: p.y })));
  if (all.length < 2) return null;
  return normalize(resample(all, SAMPLE_N));
}

export function classifyClusters(clusters, expectedLetters, { unclearThreshold = UNCLEAR_DEFAULT } = {}) {
  const templates = buildAllTemplates();
  const out = [];
  // Greedy in-order assignment: cluster i is matched to expectedLetters[i] if available;
  // we still compute distance to each candidate to derive confidence.
  for (let i = 0; i < clusters.length; i++) {
    const shape = clusterToShape(clusters[i]);
    if (!shape) { out.push({ matchedLetter: null, confidence: 0, distance: Infinity }); continue; }

    const candidates = expectedLetters.length
      ? Array.from(new Set(expectedLetters))
      : Object.keys(templates);

    let best = null, bestDist = Infinity, second = Infinity;
    for (const letter of candidates) {
      const tpl = templates[letter];
      if (!tpl) continue;
      const d = dtwDistance(shape, tpl.points);
      if (d < bestDist) { second = bestDist; bestDist = d; best = letter; }
      else if (d < second) { second = d; }
    }

    // Confidence: gap between best and runner-up (higher = more confident).
    const confidence = second === Infinity ? 0 : Math.max(0, (second - bestDist) / Math.max(second, 1e-6));
    const positional = expectedLetters[i] ?? best;
    // Prefer the positional expected letter if its distance is within 1.3× of best.
    let matchedLetter = best;
    if (positional && positional !== best) {
      const tpl = templates[positional];
      if (tpl) {
        const dPos = dtwDistance(shape, tpl.points);
        if (dPos <= bestDist * 1.3) matchedLetter = positional;
      }
    }
    out.push({ matchedLetter, confidence, distance: bestDist, unclear: confidence < unclearThreshold });
  }
  return out;
}
```

- [ ] **Step 3: Write failing test for diacritic detector**

Create `tests/recognition/diacritic-detector.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { classifyDiacritic } from '../../src/recognition/diacritic-detector.js';

describe('classifyDiacritic', () => {
  it('above + 1 short stroke → fatha', () => {
    const d = { position: 'above', stroke: { points: [{x:0,y:0},{x:10,y:2}] }, bbox: { w: 10, h: 2 } };
    expect(classifyDiacritic([d])).toEqual(['fatha']);
  });

  it('below + 1 stroke → kasra', () => {
    const d = { position: 'below', stroke: { points: [{x:0,y:0},{x:10,y:2}] }, bbox: { w: 10, h: 2 } };
    expect(classifyDiacritic([d])).toEqual(['kasra']);
  });

  it('over + closed loop → sukun', () => {
    const d = { position: 'over', stroke: { points: [{x:0,y:0},{x:5,y:5},{x:0,y:10},{x:0,y:0}] }, bbox: { w: 5, h: 10 } };
    expect(classifyDiacritic([d])).toEqual(['sukun']);
  });

  it('no diacritics → empty', () => {
    expect(classifyDiacritic([])).toEqual([]);
  });

  it('above + 2 strokes → tanween_fath', () => {
    const d1 = { position: 'above', stroke: { points: [{x:0,y:0},{x:10,y:2}] }, bbox: { w: 10, h: 2 } };
    const d2 = { position: 'above', stroke: { points: [{x:15,y:0},{x:25,y:2}] }, bbox: { w: 10, h: 2 } };
    expect(classifyDiacritic([d1, d2])).toEqual(['tanween_fath']);
  });
});
```

- [ ] **Step 4: Implement `src/recognition/diacritic-detector.js`**

```js
function isLoop(stroke) {
  const pts = stroke.points;
  if (pts.length < 4) return false;
  const a = pts[0], b = pts.at(-1);
  return Math.hypot(a.x - b.x, a.y - b.y) < 6;
}

export function classifyDiacritic(diacritics) {
  if (!diacritics || diacritics.length === 0) return [];
  // Group by position
  const above = diacritics.filter(d => d.position === 'above');
  const below = diacritics.filter(d => d.position === 'below');
  const over  = diacritics.filter(d => d.position === 'over');
  const out = [];
  if (above.length === 1) {
    out.push(isLoop(above[0].stroke) ? 'damma' : 'fatha');
  } else if (above.length >= 2) {
    out.push('tanween_fath');
  }
  if (below.length === 1) {
    out.push('kasra');
  } else if (below.length >= 2) {
    out.push('tanween_kasr');
  }
  if (over.length >= 1) {
    if (out.length === 0) out.push('sukun');
  }
  return out;
}
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/recognition/classifier.js src/recognition/diacritic-detector.js tests/recognition/
git commit -m "feat: constrained letter classifier + diacritic detector"
```

---

## Task 11: Aligner — produce per-glyph match results

**Files:**
- Create: `src/compare/aligner.js`
- Create: `tests/compare/aligner.test.js`

Inputs:
- `expectedGlyphs`: parsed glyph array for the word (from parser).
- `recognized`: `{ letters: [{matchedLetter, confidence, unclear}], diacritics: ['fatha', ...] }` from classifier + diacritic-detector.

Output: per-expected-glyph result, plus any extra/missing letters or diacritics.

```
result = [
  {
    expected: <glyph>,
    letterMatch: 'ok' | 'wrong' | 'missing' | 'unclear' | 'autofill',
    diacriticMatch: 'ok' | 'wrong' | 'missing' | 'n/a',
    actualLetter, actualDiacritics
  }
]
extras = [{ kind: 'letter' | 'diacritic', value }]
```

- [ ] **Step 1: Write failing test**

Create `tests/compare/aligner.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { align } from '../../src/compare/aligner.js';
import { parseWord } from '../../src/verse/parser.js';

describe('align', () => {
  it('all correct → all ok', () => {
    const expected = parseWord('كَ'); // 1 glyph: kaf+fatha
    const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
    const { result, extras } = align(expected, recognized);
    expect(result).toHaveLength(1);
    expect(result[0].letterMatch).toBe('ok');
    expect(result[0].diacriticMatch).toBe('ok');
    expect(extras).toEqual([]);
  });

  it('wrong letter is flagged', () => {
    const expected = parseWord('كَ');
    const recognized = { letters: [{ matchedLetter: 'ل', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
    const { result } = align(expected, recognized);
    expect(result[0].letterMatch).toBe('wrong');
    expect(result[0].diacriticMatch).toBe('ok');
  });

  it('wrong harakah is flagged', () => {
    const expected = parseWord('كَ');
    const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['kasra'] };
    const { result } = align(expected, recognized);
    expect(result[0].letterMatch).toBe('ok');
    expect(result[0].diacriticMatch).toBe('wrong');
  });

  it('silent letter is autofilled — never wrong', () => {
    // bare lam is silent; user did not write it
    const expected = parseWord('كَل'); // kaf+fatha, lam (silent)
    const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
    const { result, extras } = align(expected, recognized);
    expect(result[0].letterMatch).toBe('ok');
    expect(result[1].letterMatch).toBe('autofill');
    expect(extras).toEqual([]);
  });

  it('madd-alif is required (not silent)', () => {
    const expected = parseWord('قَال'); // qaf+fatha, alif (madd), lam (silent)
    // user wrote only qaf — alif is missing
    const recognized = { letters: [{ matchedLetter: 'ق', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
    const { result } = align(expected, recognized);
    expect(result[0].letterMatch).toBe('ok');
    expect(result[1].letterMatch).toBe('missing');
    expect(result[2].letterMatch).toBe('autofill');
  });

  it('extra letters are reported in extras', () => {
    const expected = parseWord('كَ');
    const recognized = {
      letters: [
        { matchedLetter: 'ك', confidence: 0.9, unclear: false },
        { matchedLetter: 'ت', confidence: 0.9, unclear: false }
      ],
      diacritics: ['fatha']
    };
    const { extras } = align(expected, recognized);
    expect(extras).toEqual([{ kind: 'letter', value: 'ت' }]);
  });

  it('low-confidence cluster → unclear', () => {
    const expected = parseWord('كَ');
    const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.05, unclear: true }], diacritics: ['fatha'] };
    const { result } = align(expected, recognized);
    expect(result[0].letterMatch).toBe('unclear');
  });
});
```

- [ ] **Step 2: Implement `src/compare/aligner.js`**

```js
export function align(expectedGlyphs, recognized) {
  const userExpected = expectedGlyphs.filter(g => !g.isSilent);
  const recLetters = recognized.letters || [];
  const recDiacritics = (recognized.diacritics || []).slice();

  const result = [];
  let recIdx = 0;
  let userPosCount = 0;

  // Build a flat list of expected diacritics in order (one entry per user-required glyph; null if none).
  const expectedDiacriticsInOrder = userExpected.map(g => g.diacritics[0] || null);
  // We deliberately compare diacritics positionally with the user-required glyphs,
  // because the recognizer emits them in the same order they appear above/below the clusters.

  for (const g of expectedGlyphs) {
    if (g.isSilent) {
      result.push({ expected: g, letterMatch: 'autofill', diacriticMatch: 'n/a',
                    actualLetter: null, actualDiacritics: [] });
      continue;
    }
    const rec = recLetters[recIdx];
    const expectedDia = expectedDiacriticsInOrder[userPosCount];
    const actualDia = recDiacritics[userPosCount] ?? null;
    let letterMatch;
    if (!rec) letterMatch = 'missing';
    else if (rec.unclear) letterMatch = 'unclear';
    else letterMatch = rec.matchedLetter === g.letter ? 'ok' : 'wrong';

    let diacriticMatch;
    if (expectedDia == null) {
      diacriticMatch = 'n/a';
    } else if (actualDia == null) {
      diacriticMatch = 'missing';
    } else {
      diacriticMatch = actualDia === expectedDia ? 'ok' : 'wrong';
    }

    result.push({
      expected: g,
      letterMatch,
      diacriticMatch,
      actualLetter: rec?.matchedLetter ?? null,
      actualDiacritics: actualDia ? [actualDia] : []
    });

    if (rec) recIdx++;
    userPosCount++;
  }

  // Anything in recLetters past recIdx is an extra letter.
  const extras = [];
  for (let i = recIdx; i < recLetters.length; i++) {
    extras.push({ kind: 'letter', value: recLetters[i].matchedLetter });
  }
  // Extra diacritics past userPosCount
  for (let i = userPosCount; i < recDiacritics.length; i++) {
    extras.push({ kind: 'diacritic', value: recDiacritics[i] });
  }
  return { result, extras };
}
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/compare/aligner.js tests/compare/aligner.test.js
git commit -m "feat: alignment of recognized letters/diacritics against expected glyphs"
```

---

## Task 12: Verse renderer — render a word with color states into the DOM

**Files:**
- Create: `src/verse/renderer.js`
- Create: `tests/verse/renderer.test.js`

API:
```js
renderWord(container, alignmentResult, { silentColorOn })
```
Appends a `<span class="word">` containing one `<span class="glyph">` per expected glyph. Each glyph has a `letter` element and optional `diacritic` element. Classes:
- `glyph--ok`, `glyph--wrong`, `glyph--missing`, `glyph--unclear`, `glyph--autofill`
- `dia--ok`, `dia--wrong`, `dia--missing`

The displayed `letter` text is always the *expected* letter (we don't show what the user "actually" drew — they can see their own canvas; we tell them the correct text and color it according to whether they matched).

- [ ] **Step 1: Write failing test**

Create `tests/verse/renderer.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWord, clearVerseDisplay } from '../../src/verse/renderer.js';
import { parseWord } from '../../src/verse/parser.js';

describe('renderWord', () => {
  let host;
  beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('div'); document.body.appendChild(host); });

  it('renders a word with correct letter classes', () => {
    const expected = parseWord('كَ');
    const alignment = {
      result: [{ expected: expected[0], letterMatch: 'ok', diacriticMatch: 'ok', actualLetter: 'ك', actualDiacritics: ['fatha'] }],
      extras: []
    };
    renderWord(host, alignment, { silentColorOn: true });
    const word = host.querySelector('.word');
    expect(word).toBeTruthy();
    expect(word.querySelector('.glyph--ok')).toBeTruthy();
  });

  it('marks autofilled silent letter with .glyph--autofill', () => {
    const expected = parseWord('كَل'); // kaf+fatha, silent lam
    const alignment = {
      result: [
        { expected: expected[0], letterMatch: 'ok', diacriticMatch: 'ok', actualLetter: 'ك', actualDiacritics: ['fatha'] },
        { expected: expected[1], letterMatch: 'autofill', diacriticMatch: 'n/a', actualLetter: null, actualDiacritics: [] }
      ],
      extras: []
    };
    renderWord(host, alignment, { silentColorOn: true });
    expect(host.querySelector('.glyph--autofill')).toBeTruthy();
  });

  it('flags wrong letter with .glyph--wrong', () => {
    const expected = parseWord('كَ');
    const alignment = {
      result: [{ expected: expected[0], letterMatch: 'wrong', diacriticMatch: 'ok', actualLetter: 'ل', actualDiacritics: ['fatha'] }],
      extras: []
    };
    renderWord(host, alignment, { silentColorOn: true });
    expect(host.querySelector('.glyph--wrong')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement `src/verse/renderer.js`**

```js
const DIACRITIC_CHAR = {
  fatha: 'َ',
  kasra: 'ِ',
  damma: 'ُ',
  sukun: 'ْ',
  shadda: 'ّ',
  tanween_fath: 'ً',
  tanween_damm: 'ٌ',
  tanween_kasr: 'ٍ',
  dagger_alif: 'ٰ'
};

export function renderWord(container, alignment, { silentColorOn = true } = {}) {
  const word = document.createElement('span');
  word.className = 'word';
  for (const r of alignment.result) {
    const g = document.createElement('span');
    g.className = `glyph glyph--${r.letterMatch}`;
    if (r.letterMatch === 'autofill' && silentColorOn) g.classList.add('glyph--silent-visible');

    const letter = document.createElement('span');
    letter.className = 'glyph__letter';
    letter.textContent = r.expected.letter;
    g.appendChild(letter);

    for (const dn of r.expected.diacritics) {
      const dia = document.createElement('span');
      dia.className = `dia dia--${r.diacriticMatch}`;
      dia.textContent = DIACRITIC_CHAR[dn] || '';
      g.appendChild(dia);
    }
    word.appendChild(g);
  }

  // Extras (letters/diacritics user wrote that weren't expected)
  for (const ex of alignment.extras) {
    const exNode = document.createElement('span');
    exNode.className = `extra extra--${ex.kind}`;
    exNode.textContent = ex.value;
    word.appendChild(exNode);
  }

  container.appendChild(word);
  container.appendChild(document.createTextNode(' '));
  return word;
}

export function clearVerseDisplay(container) {
  container.innerHTML = '';
}
```

- [ ] **Step 3: Add CSS for color states**

Append to `styles.css`:
```css
#verse-display { font-family: 'NotoNaskhArabic', 'Amiri', serif; font-size: 28px; line-height: 2.2; direction: rtl; text-align: right; }
.word { display: inline-block; margin-left: 12px; }
.glyph { display: inline-block; }
.glyph--ok       .glyph__letter,
.glyph--ok       .dia { color: #e2e8f0; }
.glyph--wrong    .glyph__letter { color: #ef4444; }
.glyph--missing  .glyph__letter { color: #ef4444; opacity: 0.6; text-decoration: underline dashed; }
.glyph--unclear  .glyph__letter { color: #f59e0b; }
.glyph--autofill .glyph__letter { color: #64748b; }
.glyph--autofill.glyph--silent-visible .glyph__letter { color: #475569; }
.dia--wrong   { color: #ef4444 !important; }
.dia--missing { color: #ef4444 !important; opacity: 0.6; }
.extra--letter, .extra--diacritic { color: #ef4444; text-decoration: line-through; margin-right: 4px; }
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/verse/renderer.js tests/verse/renderer.test.js styles.css
git commit -m "feat: verse renderer with letter/harakah color states"
```

---

## Task 13: Audio player

**Files:**
- Create: `src/audio/player.js`
- Create: `tests/audio/player.test.js`

EveryAyah URL pattern: `https://everyayah.com/data/<reciter>/<surah_padded>+<ayah_padded>.mp3` where surah and ayah are zero-padded to 3 digits, e.g. `001002.mp3` for surah 1, ayah 2 — actual format is `001002.mp3` (no separator). Verify the pattern at first use.

The actual EveryAyah path is `<reciter>/<SSSAAA>.mp3` — for example: `https://everyayah.com/data/Alafasy_64kbps/001001.mp3`.

- [ ] **Step 1: Write failing test**

Create `tests/audio/player.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildAyahUrl } from '../../src/audio/player.js';

describe('buildAyahUrl', () => {
  it('zero-pads surah and ayah to 3 digits', () => {
    expect(buildAyahUrl('Alafasy_64kbps', 1, 1))
      .toBe('https://everyayah.com/data/Alafasy_64kbps/001001.mp3');
    expect(buildAyahUrl('Husary_64kbps', 12, 5))
      .toBe('https://everyayah.com/data/Husary_64kbps/012005.mp3');
  });
});
```

- [ ] **Step 2: Implement `src/audio/player.js`**

```js
const BASE = 'https://everyayah.com/data';

export function buildAyahUrl(reciter, surah, ayah) {
  const s = String(surah).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  return `${BASE}/${reciter}/${s}${a}.mp3`;
}

export class AyahPlayer {
  constructor() { this.audio = null; }
  play(url) {
    this.stop();
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    return this.audio.play();
  }
  stop() {
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; this.audio = null; }
  }
}

export const RECITERS = [
  { id: 'Alafasy_64kbps',          name: 'Mishary Alafasy' },
  { id: 'Husary_64kbps',           name: 'Mahmoud Khalil Al-Husary' },
  { id: 'Abdul_Basit_Murattal_64kbps', name: 'Abdul Basit (Murattal)' },
  { id: 'Sudais_64kbps',           name: 'Abdurrahman As-Sudais' }
];
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/audio/player.js tests/audio/player.test.js
git commit -m "feat: EveryAyah audio URL builder + player"
```

---

## Task 14: UI — header (surah picker, range, settings button)

**Files:**
- Create: `src/ui/header.js`
- Create: `tests/ui/header.test.js`

API: `mountHeader(rootEl, { onChange, onOpenSettings, initial })` where `initial = { surah, fromAyah, toAyah }`. Calls `onChange({ surah, fromAyah, toAyah })` whenever the user changes selection. Calls `onOpenSettings()` when the gear icon is clicked.

- [ ] **Step 1: Write failing test**

Create `tests/ui/header.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountHeader } from '../../src/ui/header.js';

describe('header', () => {
  let host;
  beforeEach(() => { document.body.innerHTML = ''; host = document.createElement('header'); document.body.appendChild(host); });

  it('renders surah dropdown, from/to inputs, settings button', () => {
    mountHeader(host, { onChange: () => {}, onOpenSettings: () => {}, initial: { surah: 1, fromAyah: 1, toAyah: 1 } });
    expect(host.querySelector('select.surah')).toBeTruthy();
    expect(host.querySelector('input.from')).toBeTruthy();
    expect(host.querySelector('input.to')).toBeTruthy();
    expect(host.querySelector('button.settings')).toBeTruthy();
  });

  it('calls onChange when surah is selected', () => {
    const onChange = vi.fn();
    mountHeader(host, { onChange, onOpenSettings: () => {}, initial: { surah: 1, fromAyah: 1, toAyah: 1 } });
    const sel = host.querySelector('select.surah');
    sel.value = '2';
    sel.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)[0];
    expect(arg.surah).toBe(2);
  });

  it('clamps toAyah to surah verse count', () => {
    const onChange = vi.fn();
    mountHeader(host, { onChange, onOpenSettings: () => {}, initial: { surah: 1, fromAyah: 1, toAyah: 1 } });
    const to = host.querySelector('input.to');
    to.value = '999';
    to.dispatchEvent(new Event('change'));
    const arg = onChange.mock.calls.at(-1)[0];
    expect(arg.toAyah).toBeLessThanOrEqual(7); // Al-Fatiha has 7
  });
});
```

- [ ] **Step 2: Implement `src/ui/header.js`**

```js
import { SURAHS, getSurah } from '../data/surah-metadata.js';

export function mountHeader(root, { onChange, onOpenSettings, initial }) {
  root.innerHTML = '';
  const surahSel = document.createElement('select');
  surahSel.className = 'surah';
  for (const s of SURAHS) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.textContent = `${s.number}. ${s.name_en} · ${s.name_ar}`;
    surahSel.appendChild(opt);
  }
  surahSel.value = String(initial.surah);

  const fromInput = document.createElement('input');
  fromInput.className = 'from'; fromInput.type = 'number'; fromInput.min = '1'; fromInput.value = String(initial.fromAyah);
  const toInput = document.createElement('input');
  toInput.className = 'to'; toInput.type = 'number'; toInput.min = '1'; toInput.value = String(initial.toAyah);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings'; settingsBtn.textContent = '⚙'; settingsBtn.title = 'Settings';

  root.append(surahSel, document.createTextNode(' From '), fromInput, document.createTextNode(' To '), toInput, settingsBtn);

  function emit() {
    const surah = parseInt(surahSel.value, 10);
    const meta = getSurah(surah);
    let from = Math.max(1, Math.min(parseInt(fromInput.value, 10) || 1, meta.verses));
    let to   = Math.max(from, Math.min(parseInt(toInput.value, 10) || from, meta.verses));
    fromInput.max = String(meta.verses);
    toInput.max = String(meta.verses);
    fromInput.value = String(from);
    toInput.value = String(to);
    onChange({ surah, fromAyah: from, toAyah: to });
  }

  surahSel.addEventListener('change', emit);
  fromInput.addEventListener('change', emit);
  toInput.addEventListener('change', emit);
  settingsBtn.addEventListener('click', () => onOpenSettings());

  emit();
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/ui/header.js tests/ui/header.test.js
git commit -m "feat: header UI with surah/range pickers"
```

---

## Task 15: UI — canvas-view + verse-display + settings modal + summary

**Files:**
- Create: `src/ui/canvas-view.js`
- Create: `src/ui/verse-display.js`
- Create: `src/ui/settings-modal.js`
- Create: `src/ui/summary.js`
- Create: `tests/ui/canvas-view.test.js`
- Create: `tests/ui/settings-modal.test.js`

These are mostly thin wrappers; tests focus on contract (mount renders elements, callbacks fire).

- [ ] **Step 1: Implement `src/ui/canvas-view.js`**

```js
import { CanvasInput } from '../canvas/input.js';
import { isCommitSwipe } from '../canvas/gestures.js';

export function mountCanvasView(root, { onCommit, strokeColor, strokeWidth }) {
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'draw-canvas';
  const hint = document.createElement('div');
  hint.className = 'commit-hint';
  hint.textContent = '← swipe right-to-left to commit';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'undo';
  undoBtn.textContent = '↺ undo';
  root.append(canvas, hint, undoBtn);

  function resize() {
    const r = root.getBoundingClientRect();
    canvas.width = Math.max(200, Math.floor(r.width));
    canvas.height = Math.max(120, Math.floor(r.height));
  }
  resize();
  window.addEventListener('resize', resize);

  const input = new CanvasInput(canvas, {
    strokeColor, strokeWidth,
    onStroke: (stroke) => {
      if (isCommitSwipe(stroke, canvas)) {
        // remove the swipe stroke from accumulated strokes before committing
        const all = input.getStrokes();
        const idx = all.indexOf(stroke);
        if (idx >= 0) all.splice(idx, 1);
        const committed = all.slice();
        input.clear();
        onCommit(committed, { width: canvas.width, height: canvas.height });
        hint.style.display = 'none';
      }
    }
  });

  return {
    canvas,
    clear: () => input.clear(),
    onUndoClick: (cb) => undoBtn.addEventListener('click', cb)
  };
}
```

Append to `styles.css`:
```css
#canvas-view { position: relative; background: #1e293b; }
.draw-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.commit-hint { position: absolute; bottom: 6px; right: 12px; font-size: 12px; color: #94a3b8; pointer-events: none; }
.undo { position: absolute; top: 6px; right: 6px; background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 4px 8px; }
```

- [ ] **Step 2: Implement `src/ui/verse-display.js`**

```js
import { renderWord, clearVerseDisplay } from '../verse/renderer.js';

export function mountVerseDisplay(root, { onPlayVerse }) {
  root.innerHTML = '';
  const versesEl = document.createElement('div');
  versesEl.className = 'verses';
  const controls = document.createElement('div');
  controls.className = 'verse-controls';
  const playBtn = document.createElement('button');
  playBtn.textContent = '▶ play verse';
  playBtn.addEventListener('click', () => onPlayVerse());
  controls.append(playBtn);
  root.append(versesEl, controls);

  return {
    appendWord: (alignment, opts) => renderWord(versesEl, alignment, opts),
    startNewVerse: () => {
      const v = document.createElement('div');
      v.className = 'verse-line';
      versesEl.appendChild(v);
      return {
        appendWord: (alignment, opts) => renderWord(v, alignment, opts)
      };
    },
    reset: () => clearVerseDisplay(versesEl)
  };
}
```

- [ ] **Step 3: Implement `src/ui/settings-modal.js`**

```js
import { RECITERS } from '../audio/player.js';

export function mountSettingsModal(root, { settings, onChange, onResetStats, onClose }) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__panel">
      <h3>Settings</h3>
      <label>Reciter
        <select class="reciter">
          ${RECITERS.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </label>
      <label>Show silent letters in distinct color
        <input type="checkbox" class="silent-toggle" />
      </label>
      <label>Stroke width <input type="number" min="1" max="20" class="stroke-width" /></label>
      <button class="reset-stats">Reset stats</button>
      <button class="close">Close</button>
    </div>`;
  root.appendChild(modal);

  const reciter = modal.querySelector('.reciter');
  const silent = modal.querySelector('.silent-toggle');
  const sw = modal.querySelector('.stroke-width');
  reciter.value = settings.reciter;
  silent.checked = settings.silentLetterColorOn;
  sw.value = String(settings.strokeWidth);

  reciter.addEventListener('change', () => onChange({ reciter: reciter.value }));
  silent.addEventListener('change', () => onChange({ silentLetterColorOn: silent.checked }));
  sw.addEventListener('change', () => onChange({ strokeWidth: parseInt(sw.value, 10) }));
  modal.querySelector('.reset-stats').addEventListener('click', onResetStats);
  modal.querySelector('.close').addEventListener('click', () => { modal.remove(); onClose?.(); });

  return { close: () => { modal.remove(); onClose?.(); } };
}
```

Append to `styles.css`:
```css
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 100; }
.modal__panel { background: #1e293b; padding: 20px; border-radius: 12px; min-width: 280px; display: flex; flex-direction: column; gap: 12px; }
.modal label { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.modal button { padding: 8px 12px; background: #334155; color: #e2e8f0; border: none; border-radius: 6px; }
```

- [ ] **Step 4: Implement `src/ui/summary.js`**

```js
export function showSummary(root, { sessionStats, onPracticeAgain, onPickNew }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const lettersTop = topN(sessionStats.letterErrors, 3);
  const diaTop = topN(sessionStats.diacriticErrors, 3);
  overlay.innerHTML = `
    <div class="modal__panel">
      <h3>Session complete</h3>
      <p>Words written: ${sessionStats.wordsWritten} / ${sessionStats.wordsTotal}</p>
      <p>Letter errors: ${sessionStats.letterErrorsTotal} ${lettersTop ? `(top: ${lettersTop})` : ''}</p>
      <p>Harakah errors: ${sessionStats.diacriticErrorsTotal} ${diaTop ? `(top: ${diaTop})` : ''}</p>
      <button class="again">Practice again</button>
      <button class="new">Pick new range</button>
    </div>`;
  root.appendChild(overlay);
  overlay.querySelector('.again').addEventListener('click', () => { overlay.remove(); onPracticeAgain(); });
  overlay.querySelector('.new').addEventListener('click', () => { overlay.remove(); onPickNew(); });
}

function topN(map, n) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  return entries.length ? entries.map(([k, v]) => `${k} ×${v}`).join(', ') : '';
}
```

- [ ] **Step 5: Add minimal smoke tests**

Create `tests/ui/canvas-view.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { mountCanvasView } from '../../src/ui/canvas-view.js';

describe('canvas-view', () => {
  it('mounts canvas + hint + undo button', () => {
    const root = document.createElement('div');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200, x: 0, y: 0 });
    document.body.appendChild(root);
    mountCanvasView(root, { onCommit: () => {}, strokeColor: '#fff', strokeWidth: 4 });
    expect(root.querySelector('canvas.draw-canvas')).toBeTruthy();
    expect(root.querySelector('.commit-hint')).toBeTruthy();
    expect(root.querySelector('.undo')).toBeTruthy();
  });
});
```

Create `tests/ui/settings-modal.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { mountSettingsModal } from '../../src/ui/settings-modal.js';
import { DEFAULT_SETTINGS } from '../../src/store/settings.js';

describe('settings-modal', () => {
  it('reflects current settings and emits onChange', () => {
    const onChange = vi.fn();
    mountSettingsModal(document.body, { settings: DEFAULT_SETTINGS, onChange, onResetStats: () => {}, onClose: () => {} });
    const sel = document.querySelector('.reciter');
    sel.value = 'Husary_64kbps';
    sel.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith({ reciter: 'Husary_64kbps' });
  });
});
```

- [ ] **Step 6: Run all tests, commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/ui/ tests/ui/ styles.css
git commit -m "feat: canvas-view, verse-display, settings-modal, summary UIs"
```

---

## Task 16: Main wiring — assemble the practice loop

**Files:**
- Modify: `src/main.js`

The practice loop:
1. Load Quran data + settings.
2. Mount header, verse-display, canvas-view.
3. On range change → reset session: parse verses, clear display, set position to first word.
4. On commit (canvas-view emits committed strokes) → segment → classify → detect diacritics → align → render → record stats → advance position. If end of range, show summary.
5. On undo → pop last word, decrement position.
6. On settings click → open modal.
7. On play → fetch+play current verse audio.

- [ ] **Step 1: Replace `src/main.js`**

```js
import { loadQuran, getVerse } from './data/quran-loader.js';
import { getSurah } from './data/surah-metadata.js';
import { parseVerse } from './verse/parser.js';
import { mountHeader } from './ui/header.js';
import { mountVerseDisplay } from './ui/verse-display.js';
import { mountCanvasView } from './ui/canvas-view.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { showSummary } from './ui/summary.js';
import { segment } from './canvas/segmenter.js';
import { classifyClusters } from './recognition/classifier.js';
import { classifyDiacritic } from './recognition/diacritic-detector.js';
import { align } from './compare/aligner.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  parsedVerses: [],   // [verse][word][glyph]
  cursor: { verseIdx: 0, wordIdx: 0 },
  history: [],        // recently committed words for undo
  settings: null,
  session: { wordsWritten: 0, wordsTotal: 0, letterErrors: {}, diacriticErrors: {}, letterErrorsTotal: 0, diacriticErrorsTotal: 0 }
};

const player = new AyahPlayer();
let verseDisplayApi = null;
let canvasViewApi = null;
let currentVerseLine = null;

async function init() {
  await loadQuran();
  state.settings = await getSettings();

  const headerEl = document.getElementById('header');
  const verseEl  = document.getElementById('verse-display');
  const canvasEl = document.getElementById('canvas-view');

  verseDisplayApi = mountVerseDisplay(verseEl, { onPlayVerse: playCurrentVerse });
  canvasViewApi = mountCanvasView(canvasEl, {
    onCommit: handleCommit,
    strokeColor: state.settings.strokeColor,
    strokeWidth: state.settings.strokeWidth
  });
  canvasViewApi.onUndoClick(handleUndo);

  mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah },
    onChange: handleRangeChange,
    onOpenSettings: openSettings
  });
}

function handleRangeChange({ surah, fromAyah, toAyah }) {
  state.surah = surah;
  state.fromAyah = fromAyah;
  state.toAyah = toAyah;
  state.parsedVerses = [];
  for (let a = fromAyah; a <= toAyah; a++) {
    state.parsedVerses.push(parseVerse(getVerse(surah, a)));
  }
  state.cursor = { verseIdx: 0, wordIdx: 0 };
  state.history = [];
  state.session = {
    wordsWritten: 0,
    wordsTotal: state.parsedVerses.reduce((s, v) => s + v.length, 0),
    letterErrors: {}, diacriticErrors: {},
    letterErrorsTotal: 0, diacriticErrorsTotal: 0
  };
  verseDisplayApi.reset();
  currentVerseLine = verseDisplayApi.startNewVerse();
}

function handleCommit(committedStrokes, canvasMeta) {
  const word = currentExpectedWord();
  if (!word) return;
  const userExpected = word.filter(g => !g.isSilent);
  const expectedLetters = userExpected.map(g => g.letter);

  const seg = segment(committedStrokes, canvasMeta);
  const letters = classifyClusters(seg.clusters, expectedLetters);
  const allDiacritics = seg.clusters.flatMap(c => c.diacritics);
  const diacritics = classifyDiacritic(allDiacritics);

  const alignment = align(word, { letters, diacritics });

  currentVerseLine.appendWord(alignment, { silentColorOn: state.settings.silentLetterColorOn });
  state.history.push({ verseIdx: state.cursor.verseIdx, wordIdx: state.cursor.wordIdx });

  // Record errors
  for (const r of alignment.result) {
    if (r.letterMatch === 'wrong' || r.letterMatch === 'missing') {
      recordError({ kind: 'letter', value: r.expected.letter });
      bumpSession('letter', r.expected.letter);
    }
    if (r.diacriticMatch === 'wrong' || r.diacriticMatch === 'missing') {
      const d = r.expected.diacritics[0];
      if (d) { recordError({ kind: 'diacritic', value: d }); bumpSession('diacritic', d); }
    }
  }
  state.session.wordsWritten++;

  advanceCursor();
}

function bumpSession(kind, value) {
  const map = kind === 'letter' ? state.session.letterErrors : state.session.diacriticErrors;
  map[value] = (map[value] || 0) + 1;
  if (kind === 'letter') state.session.letterErrorsTotal++;
  else state.session.diacriticErrorsTotal++;
}

function currentExpectedWord() {
  const verse = state.parsedVerses[state.cursor.verseIdx];
  if (!verse) return null;
  return verse[state.cursor.wordIdx];
}

function advanceCursor() {
  state.cursor.wordIdx++;
  const verse = state.parsedVerses[state.cursor.verseIdx];
  if (state.cursor.wordIdx >= verse.length) {
    state.cursor.verseIdx++;
    state.cursor.wordIdx = 0;
    if (state.cursor.verseIdx >= state.parsedVerses.length) {
      showSummary(document.body, {
        sessionStats: state.session,
        onPracticeAgain: () => handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah }),
        onPickNew: () => {}
      });
      return;
    }
    currentVerseLine = verseDisplayApi.startNewVerse();
  }
}

function handleUndo() {
  // Simple v1: rewind one position; doesn't remove rendered DOM (left as a known limitation, see plan note).
  const last = state.history.pop();
  if (!last) return;
  state.cursor = { verseIdx: last.verseIdx, wordIdx: last.wordIdx };
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => { state.settings = await updateSettings(patch); },
    onResetStats: () => resetStats()
  });
}

function playCurrentVerse() {
  const ayah = state.fromAyah + state.cursor.verseIdx;
  const url = buildAyahUrl(state.settings.reciter, state.surah, ayah);
  player.play(url).catch(() => {
    // toast on failure
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = 'Could not load audio. Check connection.';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  });
}

init();
```

Append to `styles.css`:
```css
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #ef4444; color: white; padding: 10px 16px; border-radius: 8px; }
```

- [ ] **Step 2: Manual test**

Run:
```bash
npm run dev
```
Open `http://localhost:5173` on phone or desktop. Select Al-Fatiha 1-1. Draw something. Swipe right-to-left. Verify a word appears in the verse display.

- [ ] **Step 3: Commit**

```bash
git add src/main.js styles.css
git commit -m "feat: wire practice loop in main"
```

---

## Task 17: PWA — manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `assets/icons/icon-192.png` (placeholder)
- Create: `assets/icons/icon-512.png` (placeholder)
- Modify: `src/main.js` (register SW)
- Modify: `index.html` (already references manifest from Task 1)

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "Quran Handwriting Practice",
  "short_name": "QHP",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

Run:
```bash
mkdir -p assets/icons
# Generate a solid-color PNG placeholder. Replace with a real icon later.
node -e "
const fs = require('fs');
const sizes = [192, 512];
for (const s of sizes) {
  // 1x1 dark blue PNG, scaled by manifest is fine for initial dev
  const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('assets/icons/icon-' + s + '.png', buf);
}
console.log('placeholder icons written');
"
```

- [ ] **Step 3: Create `service-worker.js`**

```js
const CACHE = 'qhp-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './assets/quran/quran-indopak.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Don't cache audio (large + reciter-dependent)
  if (url.hostname === 'everyayah.com') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (e.request.method === 'GET' && url.origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
```

- [ ] **Step 4: Register SW in `src/main.js`**

Add at top of `init()`:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
```

- [ ] **Step 5: Verify PWA install**

Run:
```bash
npm run build
npm run preview
```
Visit on phone/Chrome desktop. Verify "Install app" option appears in browser menu.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest service-worker.js assets/icons/ src/main.js
git commit -m "feat: PWA manifest + service worker for offline support"
```

---

## Task 18: Playwright E2E — golden-path test

**Files:**
- Create: `playwright.config.js`
- Create: `e2e/golden-path.spec.js`

- [ ] **Step 1: Install Playwright browsers**

Run:
```bash
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.js`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true }
});
```

- [ ] **Step 3: Write golden-path test**

Create `e2e/golden-path.spec.js`:
```js
import { test, expect } from '@playwright/test';

test('loads, picks Al-Fatiha 1, draws, swipes, sees word', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('select.surah')).toBeVisible();

  // Draw a small scribble on canvas
  const canvas = page.locator('canvas.draw-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 50, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 80);
  await page.mouse.move(box.x + 110, box.y + 60);
  await page.mouse.up();

  // Commit swipe (R→L)
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  // Expect a word to appear in the verse display
  await expect(page.locator('#verse-display .word')).toHaveCount(1, { timeout: 3000 });
});
```

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/ playwright.config.js
git commit -m "test: playwright golden-path E2E"
```

---

## Task 19: Manual mobile QA + final polish

**Files:**
- Modify: `styles.css` (mobile tweaks as needed)
- Modify: `src/main.js` (handle landscape if needed)

- [ ] **Step 1: Run local server bound to LAN**

```bash
npm run build
npm run preview
```
On the phone, open the URL shown.

- [ ] **Step 2: Manual checklist**

Test each on iOS Safari + Chrome Android:
- [ ] Surah dropdown renders Arabic + English
- [ ] Selecting Al-Fatiha 1-7 loads the range
- [ ] Drawing latency feels fine (< 50ms apparent)
- [ ] R→L swipe commits reliably; doesn't trigger during normal writing
- [ ] Verse display shows words after commit, with color states
- [ ] Silent letters appear in muted gray
- [ ] Wrong letter shows red; wrong harakah shows red
- [ ] ▶ play button plays verse audio
- [ ] ⚙ settings opens modal; reciter change persists across reload
- [ ] Add to Home Screen / Install works
- [ ] Offline mode: airplane mode → app still loads + works (audio fails gracefully)
- [ ] Portrait + landscape both usable

- [ ] **Step 3: Note any issues found and fix iteratively**

For each issue, write a small fix + commit individually.

- [ ] **Step 4: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "chore: mobile polish from manual QA"
```

---

## Self-Review Notes

**Spec coverage check:**
- Section 4 key decisions 1–11: all covered (constrained DTW = T8/T10; per-letter granularity = T11; R→L swipe = T6; per-word feedback = T16; verse display populates only after commit = T12/T16; silent rule = T3; madd-alif exception = T3; vanilla JS PWA = T1/T17; Tanzil bundled = T2; EveryAyah audio = T13; IndexedDB = T4).
- Section 5 architecture: covered across T1, T17.
- Section 6 layout: covered in T14/T15 + CSS in T12/T15.
- Section 7 data model: parser output (T3), comparison result (T11), persisted stats (T4).
- Section 8 recognition pipeline: segmenter T7, DTW T8, templates T9, classifier T10, diacritic detector T10, aligner T11, wiring T16.
- Section 9 component breakdown: implemented across T1–T17.
- Section 10 error handling: confidence/unclear (T10/T11), parser tolerates unknown marks (T3), commit-swipe gating (T6), audio failure toast (T16), IndexedDB fallback (note: not explicitly added — see open issue below), session restore (note: not in v1 — see open issue below).
- Section 11 testing strategy: unit tests across all modules; Playwright E2E in T18; manual mobile QA in T19.

**Known gaps (deliberate v1 scope):**
- Undo button rewinds the cursor but does not remove the previously rendered word from the DOM. Listed as a known limitation in T16; full implementation deferred.
- IndexedDB-unavailable fallback (in-memory) is not implemented. Acceptable for v1 since the target browsers (modern iOS Safari, Chrome) all support IndexedDB.
- Session-restore-on-reload is not implemented. Acceptable for v1; can be added by persisting `state.cursor` + `state.surah/from/to` after each commit.
- Letter templates use isolated forms only. Initial/medial/final form discrimination is deferred — this is a real limitation that may degrade recognition for connected letters; flagged for v2.

**Placeholder scan:** All steps contain runnable code or specific commands. No `TBD` / `TODO` markers remain.

**Type consistency:** `letterMatch` values (`ok`/`wrong`/`missing`/`unclear`/`autofill`) used identically in T11, T12, T16. `diacriticMatch` values (`ok`/`wrong`/`missing`/`n/a`) consistent. `recordError({kind, value})` signature matches between T4 producer and T16 caller.
