// Normalize fawazahmed0/quran-api Indo-Pak edition into the app shape.
// Input shape:  { quran: [ { chapter, verse, text }, ... ] }
// Output shape: { "1": { name_ar: "", name_en: "", verses: { "1": "...", ... } }, ... }

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = process.argv[2] || '/tmp/quran-src.json';
const outPath = resolve(__dirname, '..', 'assets/quran/quran-indopak.json');

const raw = JSON.parse(readFileSync(srcPath, 'utf8'));
if (!Array.isArray(raw.quran)) {
  throw new Error('Unexpected source shape: missing `quran` array');
}

const out = {};
for (const { chapter, verse, text } of raw.quran) {
  const sKey = String(chapter);
  if (!out[sKey]) out[sKey] = { name_ar: '', name_en: '', verses: {} };
  out[sKey].verses[String(verse)] = text;
}

const surahCount = Object.keys(out).length;
if (surahCount !== 114) {
  throw new Error(`Expected 114 surahs, got ${surahCount}`);
}

writeFileSync(outPath, JSON.stringify(out));
console.log('wrote', outPath, 'surahs:', surahCount, 'surah1 verses:', Object.keys(out['1'].verses).length);
