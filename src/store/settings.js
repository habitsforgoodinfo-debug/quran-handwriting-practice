import { kvGet, kvPut } from './db.js';

export const ALL_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي','ء','ة',
  'ى','أ','إ','آ','ؤ','ئ'
];

export const ALL_HARAKAT = [
  'fatha','kasra','damma','sukun','shadda',
  'tanween_fath','tanween_kasr','tanween_damm',
  'dagger_alif','maddah_above','subscript_alef','inverted_damma'
];

// Letters the user has to actually write by default — the ones they listed
// (tha, haa, dal, zal, za, seen, sheen, suad, duad, tua, zua, ain, fa, qaf,
// kaf, ha, waw). Everything else is auto-filled.
export const DEFAULT_REQUIRED_LETTERS = [
  'ث','ح','د','ذ','ز','س','ش','ص','ض','ط','ظ','ع','ف','ق','ك','ه','و'
];

export const DEFAULT_SETTINGS = Object.freeze({
  reciter: 'Alafasy_64kbps',
  font: 'NotoNaskhArabic',
  silentLetterColorOn: true,
  strokeColor: '#e2e8f0',
  strokeWidth: 4,
  script: 'indopak',
  hintPolicy: 'auto',
  strict: false,
  hideIntro: false,
  autoPlayOnAyahLoad: false,
  requiredLetters: DEFAULT_REQUIRED_LETTERS,
  requiredHarakat: ALL_HARAKAT,
  quickTestEvery20: true
});

function migrate(stored) {
  if (!stored) return {};
  const out = { ...stored };
  if ('hintLevel' in out) {
    out.hintPolicy = out.hintLevel === 'none' ? 'none' : 'auto';
    delete out.hintLevel;
  }
  // Old shape stored `optionalLetters` (letters to auto-fill). Migrate only
  // if the user had actually customized — an empty list means they never
  // touched it, so let the new default kick in.
  if ('optionalLetters' in out) {
    const opt = out.optionalLetters || [];
    if (opt.length > 0) {
      const optSet = new Set(opt);
      out.requiredLetters = ALL_LETTERS.filter(l => !optSet.has(l));
    }
    delete out.optionalLetters;
  }
  return out;
}

export async function getSettings(deps = { kvGet, kvPut }) {
  const stored = await deps.kvGet('settings');
  return { ...DEFAULT_SETTINGS, ...migrate(stored) };
}

export async function updateSettings(patch, deps = { kvGet, kvPut }) {
  const current = await getSettings(deps);
  const next = { ...current, ...patch };
  await deps.kvPut('settings', next);
  return next;
}
