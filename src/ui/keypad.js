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
  { name: 'tanween_damm', char: 'ٌ' },
  { name: 'dagger_alif',  char: 'ٰ' }
];
const MADD_KEY = { char: 'ٓ', longChar: 'ٓۤ' };

// Additional combining marks that appear in the bundled data. Surfaced in a
// secondary "extras" row above the letter grid. Each tap appends the mark
// verbatim — no long-press behaviour.
const EXTRAS = [
  { name: 'hamza_above',     char: 'ٔ' },  // U+0654
  { name: 'hamza_below',     char: 'ٕ' },  // U+0655
  { name: 'high_sukun',      char: 'ۡ' },  // U+06E1 (Indo-Pak sukun substitute)
  { name: 'small_waw',       char: 'ۥ' },  // U+06E5
  { name: 'small_yeh',       char: 'ۦ' },  // U+06E6
  { name: 'small_high_noon', char: 'ۨ' },  // U+06E8
  { name: 'high_madda',      char: 'ۤ' },  // U+06E4
  { name: 'small_low_meem',  char: 'ۭ' },  // U+06ED
  { name: 'high_meem_iso',   char: 'ۢ' },  // U+06E2
  { name: 'high_sad_lam',    char: 'ۖ' },  // U+06D6 (pause: sili)
  { name: 'high_qaf_lam',    char: 'ۗ' },  // U+06D7 (pause: qif)
  { name: 'high_meem_init',  char: 'ۘ' },  // U+06D8 (pause: mim)
  { name: 'high_lam',        char: 'ۙ' },  // U+06D9 (pause: la)
  { name: 'high_jeem',       char: 'ۚ' },  // U+06DA (pause: jim)
  { name: 'high_three_dots', char: 'ۛ' },  // U+06DB
  { name: 'end_of_ayah',     char: '۝' }   // U+06DD
];

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

  const extrasRow = document.createElement('div');
  extrasRow.className = 'keypad-extras';

  const lettersWrap = document.createElement('div');
  lettersWrap.className = 'keypad-letters';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(inputEl, harakatRow, extrasRow, lettersWrap, actionRow);

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

  // Extras row — additional combining marks present in the bundled data.
  for (const m of EXTRAS) {
    const b = document.createElement('button');
    b.className = 'key key--extra';
    b.textContent = 'ـ' + m.char;
    b.addEventListener('click', () => append(m.char));
    extrasRow.appendChild(b);
  }

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
