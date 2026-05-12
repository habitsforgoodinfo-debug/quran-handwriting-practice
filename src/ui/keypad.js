const HARAKAT_BASIC = [
  { name: 'fatha', char: 'َ', longChar: 'َٓ' },
  { name: 'kasra', char: 'ِ', longChar: 'ِٓ' },
  { name: 'damma', char: 'ُ', longChar: 'ُٓ' },
  { name: 'sukun', char: 'ْ', longChar: 'ْٓ' }
];
const HARAKAT_EXTRA = [
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_kasr', char: 'ٍ' },
  { name: 'tanween_damm', char: 'ٌ' }
];
const MADD_KEY = { char: 'ٓ', longChar: 'ٓۤ' };

const LAYOUT = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ']
];

const LONG_PRESS_MS = 450;

export function mountKeypad(root, { onSubmit }) {
  root.innerHTML = '';
  let input = '';

  const inputEl = document.createElement('div');
  inputEl.className = 'keypad-input';

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(inputEl, harakatRow, lettersWrap, actionRow);

  function render() { inputEl.textContent = input || ' '; }
  function append(s) { input += s; render(); }
  function backspace() {
    const arr = Array.from(input);
    arr.pop();
    input = arr.join('');
    render();
  }
  function clear() { input = ''; render(); }

  function makeLongPressKey(label, shortChar, longChar, className) {
    const b = document.createElement('button');
    b.className = className;
    b.textContent = label;
    let timer = null;
    let fired = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fired = false;
      timer = setTimeout(() => {
        fired = true;
        append(longChar);
        b.classList.add('long-pressed');
      }, LONG_PRESS_MS);
    });
    b.addEventListener('pointerup', () => {
      if (timer) clearTimeout(timer);
      if (!fired) append(shortChar);
      b.classList.remove('long-pressed');
    });
    b.addEventListener('pointerleave', () => {
      if (timer) clearTimeout(timer);
      b.classList.remove('long-pressed');
    });
    b.addEventListener('pointercancel', () => {
      if (timer) clearTimeout(timer);
      b.classList.remove('long-pressed');
    });
    return b;
  }

  for (const h of HARAKAT_BASIC) {
    harakatRow.appendChild(makeLongPressKey('ـ' + h.char, h.char, h.longChar, 'key key--harakah'));
  }
  for (const h of HARAKAT_EXTRA) {
    const b = document.createElement('button');
    b.className = 'key key--harakah';
    b.textContent = 'ـ' + h.char;
    b.addEventListener('click', () => append(h.char));
    harakatRow.appendChild(b);
  }
  harakatRow.appendChild(makeLongPressKey('ـ' + MADD_KEY.char, MADD_KEY.char, MADD_KEY.longChar, 'key key--harakah key--madd'));

  for (const row of LAYOUT) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const ch of row) {
      const b = document.createElement('button');
      b.className = 'key key--letter';
      b.textContent = ch;
      b.addEventListener('click', () => append(ch));
      rowEl.appendChild(b);
    }
    lettersWrap.appendChild(rowEl);
  }

  const mk = (label, cls, handler) => {
    const b = document.createElement('button');
    b.className = `key key--action ${cls}`;
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  };
  actionRow.append(
    mk('Space', 'space',   () => append(' ')),
    mk('⌫',    'back',    backspace),
    mk('Clear', 'clear',   clear),
    mk('Submit','submit',  () => {
      if (input.trim().length === 0) return;
      const text = input;
      clear();
      onSubmit(text);
    })
  );

  render();
  return {
    clearInput: clear,
    focus: () => {},
    destroy: () => { root.innerHTML = ''; }
  };
}
