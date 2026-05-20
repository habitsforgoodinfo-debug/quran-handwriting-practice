const HARAKAT = [
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

export function mountKeypad(root, initialHandlers = {}) {
  root.innerHTML = '';

  // Mutable handler bag — setHandlers swaps these out without re-mounting.
  const handlers = { ...initialHandlers };

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
      b.addEventListener('click', fixedHandler);
    } else {
      b.addEventListener('click', () => {
        const fn = handlers[handlerName];
        if (fn) fn(ch);
      });
    }
    if (ch) byChar.set(ch, b);
    return b;
  }

  for (const h of HARAKAT) {
    harakatRow.appendChild(mkKey('ـ' + h.char, 'key--harakah', h.char, 'onHarakat'));
  }

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
    const el = byChar.get(ch);
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 250);
  }

  function setHandlers(next) {
    Object.assign(handlers, next);
  }

  return {
    setHint, flashWrong, setHandlers,
    destroy: () => { root.innerHTML = ''; }
  };
}
