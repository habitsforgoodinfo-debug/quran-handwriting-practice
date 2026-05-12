#!/usr/bin/env node
// One-shot scan of the bundled Quran JSON files. Walks every codepoint of every
// verse and counts every combining mark (U+064B..U+065F, U+0670, U+06D6..U+06ED).
// Run: node scripts/scan-marks.js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const NAMES = {
  0x064B: 'tanween_fath',
  0x064C: 'tanween_damm',
  0x064D: 'tanween_kasr',
  0x064E: 'fatha',
  0x064F: 'damma',
  0x0650: 'kasra',
  0x0651: 'shadda',
  0x0652: 'sukun',
  0x0653: 'maddah_above',
  0x0654: 'hamza_above',
  0x0655: 'hamza_below',
  0x0670: 'dagger_alif',
  0x06D6: 'high_ligature_sad_lam',
  0x06D7: 'high_qaf_lam',
  0x06D8: 'high_meem_initial',
  0x06D9: 'high_lam',
  0x06DA: 'high_jeem',
  0x06DB: 'high_three_dots',
  0x06DC: 'high_seen',
  0x06DD: 'end_of_ayah',
  0x06DE: 'rub_el_hizb',
  0x06DF: 'high_rounded_zero',
  0x06E0: 'high_upright_rectangular_zero',
  0x06E1: 'high_dotless_head_of_khah',
  0x06E2: 'high_meem_isolated',
  0x06E3: 'low_seen',
  0x06E4: 'high_madda',
  0x06E5: 'small_waw',
  0x06E6: 'small_yeh',
  0x06E7: 'small_high_yeh',
  0x06E8: 'small_high_noon',
  0x06E9: 'place_of_sajdah',
  0x06EA: 'empty_centre_low_stop',
  0x06EB: 'empty_centre_high_stop',
  0x06EC: 'rounded_high_stop_with_filled_centre',
  0x06ED: 'small_low_meem'
};

function isCombining(c) {
  return (c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06ED);
}

function scan(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const counts = new Map();
  function visit(text) {
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (isCombining(c)) counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  // Try common shapes
  if (Array.isArray(data)) {
    for (const x of data) {
      if (typeof x === 'string') visit(x);
      else if (x && typeof x === 'object') {
        for (const v of Object.values(x)) {
          if (typeof v === 'string') visit(v);
          else if (Array.isArray(v)) for (const y of v) if (typeof y === 'string') visit(y);
        }
      }
    }
  } else if (data && typeof data === 'object') {
    const walk = (node) => {
      if (typeof node === 'string') visit(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(data);
  }
  return counts;
}

const indopak = scan(resolve(root, 'assets/quran/quran-indopak.json'));
const uthmani = scan(resolve(root, 'assets/quran/quran-uthmani.json'));

const all = new Set([...indopak.keys(), ...uthmani.keys()]);
const sorted = [...all].sort((a, b) => a - b);

for (const c of sorted) {
  const ch = String.fromCodePoint(c);
  const name = NAMES[c] || `mark_${c.toString(16).toUpperCase().padStart(4, '0')}`;
  const ic = indopak.get(c) || 0;
  const uc = uthmani.get(c) || 0;
  console.log(`${c.toString(16).toUpperCase().padStart(4, '0')} "${ch}" ${name.padEnd(36)} indopak_count=${ic} uthmani_count=${uc}`);
}
