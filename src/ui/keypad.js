import { vibrateTap, vibrateWrong } from './feedback.js';

const HARAKAT_BASE = [
  { name: 'fatha',        char: 'َ' },
  { name: 'damma',        char: 'ُ' },
  { name: 'kasra',        char: 'ِ' },
  { name: 'sukun',        char: 'ْ' },
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_damm', char: 'ٌ' },
  { name: 'tanween_kasr', char: 'ٍ' },
  { name: 'dagger_alif',  char: 'ٰ' },
  { name: 'maddah_above', char: 'ٓ' }
];

// In Indo-Pak script the sukun is the small jazm (ۡ U+06E1), not the
// circle ْ. Swap the displayed glyph (matcher accepts both).
function harakatForScript(script) {
  return HARAKAT_BASE.map(h => {
    if (script === 'indopak' && h.name === 'sukun')        return { ...h, displayChar: 'ۡ' };
    if (script === 'indopak' && h.name === 'maddah_above') return { ...h, displayChar: 'ۤ' };
    return { ...h, displayChar: h.char };
  });
}

const LETTER_TIPS = {
  'ئ': 'hamza on yeh — used mid-word (e.g. سَائِل)',
  'ؤ': 'hamza on waw — used mid-word (e.g. مُؤْمِن)',
  'ء': 'standalone hamza'
};

const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

export function mountKeypad(root, initialHandlers = {}, { script = 'indopak' } = {}) {
  root.innerHTML = '';

  // Mutable handler bag — setHandlers swaps these out without re-mounting.
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

  function mkKey(label, cls, ch, handlerName, fixedHandler) {
    const b = document.createElement('button');
    b.className = 'key ' + cls;
    b.textContent = label;
    if (fixedHandler) {
      b.addEventListener('click', () => { vibrateTap(); fixedHandler(); });
    } else {
      b.addEventListener('click', () => {
        vibrateTap();
        const fn = handlers[handlerName];
        if (fn) fn(ch);
      });
    }
    if (ch) byChar.set(ch, b);
    return b;
  }

  function buildHarakatRow() {
    harakatRow.innerHTML = '';
    for (const h of harakatForScript(currentScript)) {
      // Pass the DISPLAYED char to the handler so the user-pane render
      // shows the same glyph the user tapped (e.g. ۡ jazm in Indo-Pak).
      // Matcher accepts either codepoint.
      harakatRow.appendChild(
        mkKey('ـ' + h.displayChar, 'key--harakah', h.displayChar, 'onHarakat')
      );
    }
  }
  buildHarakatRow();

  for (const row of LAYOUT) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const ch of row) {
      const key = mkKey(ch, 'key--letter', ch, 'onLetter');
      if (LETTER_TIPS[ch]) key.setAttribute('title', LETTER_TIPS[ch]);
      rowEl.appendChild(key);
    }
    lettersWrap.appendChild(rowEl);
  }

  actionRow.append(
    mkKey('⌫', 'key--action back', null, null, () => handlers.onBackspace && handlers.onBackspace()),
    mkKey('→ next ayah', 'key--action next', null, null, () => handlers.onNextAyah && handlers.onNextAyah()),
    mkKey('▶ audio', 'key--action audio', null, null, () => handlers.onPlayAudio && handlers.onPlayAudio())
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

  function setHandlers(next) {
    Object.assign(handlers, next);
  }

  function setScript(s) {
    if (s === currentScript) return;
    currentScript = s;
    // Remove old harakat keys from byChar before rebuilding.
    for (const h of HARAKAT_BASE) byChar.delete(h.char);
    buildHarakatRow();
  }

  return {
    setHint, flashWrong, setHandlers, setScript,
    destroy: () => { root.innerHTML = ''; }
  };
}
