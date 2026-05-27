import { vibrateTap, vibrateWrong } from './feedback.js';

// Each harakat key: short tap fires `char`; long-press (where defined)
// fires `longChar` — the elongated form (Indo-Pak long-vowel marks).
const HARAKAT_BASE = [
  { name: 'fatha',          char: 'َ',  longChar: 'ٰ' },   // long-press → dagger alif (long fatha)
  { name: 'damma',          char: 'ُ',  longChar: 'ٗ' },   // long-press → inverted damma (long damma)
  { name: 'kasra',          char: 'ِ',  longChar: 'ٖ' },   // long-press → subscript alef (long kasra)
  { name: 'sukun',          char: 'ۡ'  },                  // Indo-Pak jazm (U+06E1)
  { name: 'shadda',         char: 'ّ'  },
  { name: 'tanween_fath',   char: 'ً'  },
  { name: 'tanween_damm',   char: 'ٌ'  },
  { name: 'tanween_kasr',   char: 'ٍ'  },
  { name: 'dagger_alif',    char: 'ٰ'  },
  { name: 'maddah_above',   char: 'ٓ',  longChar: 'ۤ' },    // long-press → Indo-Pak high madda (6-count)
  { name: 'subscript_alef', char: 'ٖ'  },                  // long kasra (also reachable via long-press on kasra)
  { name: 'inverted_damma', char: 'ٗ'  }                   // long damma (also reachable via long-press on damma)
];

const LETTER_TIPS = {
  'ء': 'standalone hamza',
  'ئ': 'hamza on yeh (mid-word, e.g. سَائِل)',
  'ؤ': 'hamza on waw (mid-word, e.g. مُؤْمِن)'
};

// Google / iOS Arabic mobile keyboard arrangement. ذ added explicitly
// (no per-letter long-press anywhere in the keypad).
const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ذ','ء','ر','ة','و','ز','ظ','د']
];

const LONG_PRESS_MS = 450;

export function mountKeypad(root, initialHandlers = {}, { script = 'indopak' } = {}) {
  root.innerHTML = '';

  const handlers = { ...initialHandlers };
  let currentScript = script;

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(harakatRow, lettersWrap, actionRow);

  // Each entry in byChar maps a CHAR → key element. A single key may be
  // registered under several chars (canonical, displayed, long-press form)
  // so setHint() can glow it regardless of which char the matcher hints.
  const byChar = new Map();

  function mkLetterKey(ch) {
    const b = document.createElement('button');
    b.className = 'key key--letter';
    b.textContent = ch;
    if (LETTER_TIPS[ch]) b.setAttribute('title', LETTER_TIPS[ch]);
    b.addEventListener('click', () => {
      vibrateTap();
      handlers.onLetter && handlers.onLetter(ch);
    });
    byChar.set(ch, b);
    return b;
  }

  function mkActionKey(label, cls, fixedHandler) {
    const b = document.createElement('button');
    b.className = 'key ' + cls;
    b.textContent = label;
    b.addEventListener('click', () => { vibrateTap(); fixedHandler(); });
    return b;
  }

  function mkHarakatKey(spec) {
    const b = document.createElement('button');
    b.className = 'key key--harakah';

    // Visible face: kashida + short form, plus a small superscript hint
    // of the long-press form when the key has one.
    const main = document.createElement('span');
    main.className = 'k-main';
    main.textContent = 'ـ' + spec.char;
    b.appendChild(main);
    if (spec.longChar) {
      const alt = document.createElement('span');
      alt.className = 'k-alt';
      alt.textContent = spec.longChar;
      b.appendChild(alt);
      b.setAttribute('title', `Tap for ${spec.char} — long-press for ${spec.longChar}`);
    }

    byChar.set(spec.char, b);
    if (spec.longChar) byChar.set(spec.longChar, b);
    // Alias the alternate codepoint to the same key so it glows whichever
    // form the matcher hints (Uthmani ْ ↔ Indo-Pak ۡ).
    if (spec.name === 'sukun')        { byChar.set('ْ', b); }  // Uthmani sukun
    if (spec.name === 'maddah_above') { byChar.set('ۤ', b); }  // Indo-Pak high madda

    if (!spec.longChar) {
      b.addEventListener('click', () => {
        vibrateTap();
        handlers.onHarakat && handlers.onHarakat(spec.char);
      });
      return b;
    }

    // Long-press key: click fires short, hold > LONG_PRESS_MS fires long.
    let timer = null, longFired = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    b.addEventListener('pointerdown', () => {
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        b.classList.add('key--long-fired');
        vibrateTap();
        handlers.onHarakat && handlers.onHarakat(spec.longChar);
      }, LONG_PRESS_MS);
    });
    b.addEventListener('pointerup',    () => { cancel(); setTimeout(() => b.classList.remove('key--long-fired'), 150); });
    b.addEventListener('pointerleave', () => { cancel(); b.classList.remove('key--long-fired'); });
    b.addEventListener('pointercancel', () => { cancel(); b.classList.remove('key--long-fired'); });
    b.addEventListener('click', () => {
      if (longFired) { longFired = false; return; }
      vibrateTap();
      handlers.onHarakat && handlers.onHarakat(spec.char);
    });
    return b;
  }

  function buildHarakatRow() {
    harakatRow.innerHTML = '';
    for (const h of HARAKAT_BASE) harakatRow.appendChild(mkHarakatKey(h));
  }
  buildHarakatRow();

  for (const row of LAYOUT) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const ch of row) rowEl.appendChild(mkLetterKey(ch));
    lettersWrap.appendChild(rowEl);
  }

  actionRow.append(
    mkActionKey('⌫', 'key--action back', () => handlers.onBackspace && handlers.onBackspace()),
    mkActionKey('→ next ayah', 'key--action next', () => handlers.onNextAyah && handlers.onNextAyah()),
    mkActionKey('▶ audio', 'key--action audio', () => handlers.onPlayAudio && handlers.onPlayAudio())
  );

  function setHint({ letter, harakat } = {}) {
    for (const el of byChar.values()) el.classList.remove('key--glow');
    if (letter)  byChar.get(letter)?.classList.add('key--glow');
    if (harakat) byChar.get(harakat)?.classList.add('key--glow');
  }

  function flashWrong(ch) {
    vibrateWrong();
    const el = byChar.get(ch);
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 250);
  }

  function setHandlers(next) { Object.assign(handlers, next); }
  function setScript(_s) {
    // Kept for API compatibility — the keypad no longer swaps glyphs by
    // script. Both Uthmani and Indo-Pak codepoints are aliased to the
    // same key, so the same physical button works for both scripts.
  }

  return {
    setHint, flashWrong, setHandlers, setScript,
    destroy: () => { root.innerHTML = ''; }
  };
}
