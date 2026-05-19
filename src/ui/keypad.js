const HARAKAT = [
  { name: 'fatha',        char: 'َ' },
  { name: 'damma',        char: 'ُ' },
  { name: 'kasra',        char: 'ِ' },
  { name: 'sukun',        char: 'ْ' },
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_damm', char: 'ٌ' },
  { name: 'tanween_kasr', char: 'ٍ' }
];

const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

export function mountKeypad(root, { onLetter, onHarakat, onBackspace, onPlayAudio }) {
  root.innerHTML = '';

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(harakatRow, lettersWrap, actionRow);

  const byChar = new Map();

  function mkKey(label, cls, ch, handler) {
    const b = document.createElement('button');
    b.className = 'key ' + cls;
    b.textContent = label;
    b.addEventListener('click', handler);
    if (ch) byChar.set(ch, b);
    return b;
  }

  for (const h of HARAKAT) {
    harakatRow.appendChild(mkKey('ـ' + h.char, 'key--harakah', h.char, () => onHarakat(h.char)));
  }

  for (const row of LAYOUT) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const ch of row) {
      rowEl.appendChild(mkKey(ch, 'key--letter', ch, () => onLetter(ch)));
    }
    lettersWrap.appendChild(rowEl);
  }

  actionRow.append(
    mkKey('⌫', 'key--action back',  null, onBackspace),
    mkKey('▶ audio', 'key--action audio', null, onPlayAudio)
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

  return { setHint, flashWrong, destroy: () => { root.innerHTML = ''; } };
}
