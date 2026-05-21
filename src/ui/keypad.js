import { vibrateTap, vibrateWrong } from './feedback.js';

// Each harakat key: short tap fires `char`; long-press (where defined)
// fires `longChar` — the elongated form (Indo-Pak long-vowel marks).
const HARAKAT_BASE = [
  { name: 'fatha',        char: 'َ',  longChar: 'ٰ' },   // long-press → dagger alif (long fatha)
  { name: 'damma',        char: 'ُ',  longChar: 'ٗ' },   // long-press → inverted damma (long damma)
  { name: 'kasra',        char: 'ِ',  longChar: 'ٖ' },   // long-press → subscript alef (long kasra)
  { name: 'sukun',        char: 'ْ'  },
  { name: 'shadda',       char: 'ّ'  },
  { name: 'tanween_fath', char: 'ً'  },
  { name: 'tanween_damm', char: 'ٌ'  },
  { name: 'tanween_kasr', char: 'ٍ'  },
  { name: 'dagger_alif',  char: 'ٰ'  },
  { name: 'maddah_above', char: 'ٓ',  longChar: 'ۤ' }    // long-press → Indo-Pak high madda (6-count)
];

function harakatForScript(script) {
  return HARAKAT_BASE.map(h => {
    if (script === 'indopak' && h.name === 'sukun')        return { ...h, displayChar: 'ۡ' };
    if (script === 'indopak' && h.name === 'maddah_above') return { ...h, displayChar: 'ۤ' };
    return { ...h, displayChar: h.char };
  });
}

const LETTER_TIPS = {
  'ء': 'standalone hamza',
  'ئ': 'hamza on yeh (mid-word, e.g. سَائِل)',
  'ؤ': 'hamza on waw (mid-word, e.g. مُؤْمِن)',
  'د': 'long-press for ذ'
};

// Standard Google / iOS Arabic mobile keyboard arrangement.
// د is a long-press source for ذ (matches Google Gboard behavior).
const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

// Letters that long-press into a different letter.
const LETTER_LONGPRESS = { 'د': 'ذ' };

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

  const byChar = new Map();

  function mkLetterKey(ch) {
    const b = document.createElement('button');
    b.className = 'key key--letter';
    b.textContent = ch;
    if (LETTER_TIPS[ch]) b.setAttribute('title', LETTER_TIPS[ch]);
    byChar.set(ch, b);

    const longCh = LETTER_LONGPRESS[ch];
    if (!longCh) {
      b.addEventListener('click', () => {
        vibrateTap();
        handlers.onLetter && handlers.onLetter(ch);
      });
      return b;
    }

    // Long-press: hold to fire the alternate letter; click fires short.
    byChar.set(longCh, b);
    let timer = null, longFired = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    b.addEventListener('pointerdown', () => {
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        b.classList.add('key--long-fired');
        vibrateTap();
        handlers.onLetter && handlers.onLetter(longCh);
      }, LONG_PRESS_MS);
    });
    b.addEventListener('pointerup', () => { cancel(); setTimeout(() => b.classList.remove('key--long-fired'), 150); });
    b.addEventListener('pointerleave', () => { cancel(); b.classList.remove('key--long-fired'); });
    b.addEventListener('pointercancel', () => { cancel(); b.classList.remove('key--long-fired'); });
    b.addEventListener('click', () => {
      if (longFired) { longFired = false; return; }
      vibrateTap();
      handlers.onLetter && handlers.onLetter(ch);
    });
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
    b.textContent = 'ـ' + spec.displayChar;
    // Register under BOTH the displayed and canonical char so setHint()
    // can find the key whether the matcher returns 'ْ' or the Indo-Pak
    // alias 'ۡ'. Same for madda variants.
    byChar.set(spec.displayChar, b);
    if (spec.char !== spec.displayChar) byChar.set(spec.char, b);

    if (!spec.longChar) {
      b.addEventListener('click', () => {
        vibrateTap();
        handlers.onHarakat && handlers.onHarakat(spec.displayChar);
      });
      return b;
    }

    // Long-press capable key. Click always fires the short form; a
    // pointerdown held > LONG_PRESS_MS fires the long form and swallows
    // the click that would otherwise follow.
    let timer = null, longFired = false;
    const cancelTimer = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      b.classList.remove('key--long-fired');
    };
    b.addEventListener('pointerdown', () => {
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        b.classList.add('key--long-fired');
        vibrateTap();
        handlers.onHarakat && handlers.onHarakat(spec.longChar);
      }, LONG_PRESS_MS);
    });
    b.addEventListener('pointerup',    cancelTimer);
    b.addEventListener('pointerleave', cancelTimer);
    b.addEventListener('pointercancel', cancelTimer);
    b.addEventListener('click', () => {
      if (longFired) { longFired = false; return; }
      vibrateTap();
      handlers.onHarakat && handlers.onHarakat(spec.displayChar);
    });
    return b;
  }

  function buildHarakatRow() {
    harakatRow.innerHTML = '';
    for (const h of harakatForScript(currentScript)) {
      harakatRow.appendChild(mkHarakatKey(h));
    }
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
  function setScript(s) {
    if (s === currentScript) return;
    currentScript = s;
    for (const h of HARAKAT_BASE) byChar.delete(h.char);
    byChar.delete('ۡ'); byChar.delete('ۤ');
    buildHarakatRow();
  }

  return {
    setHint, flashWrong, setHandlers, setScript,
    destroy: () => { root.innerHTML = ''; }
  };
}
