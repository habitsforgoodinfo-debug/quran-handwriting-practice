const HARAKAT = [
  { name: 'fatha',        char: 'َ' },
  { name: 'kasra',        char: 'ِ' },
  { name: 'damma',        char: 'ُ' },
  { name: 'sukun',        char: 'ْ' },
  { name: 'shadda',       char: 'ّ' },
  { name: 'tanween_fath', char: 'ً' },
  { name: 'tanween_kasr', char: 'ٍ' },
  { name: 'tanween_damm', char: 'ٌ' }
];

export function mountKeypad(root, { onSubmit, letters }) {
  root.innerHTML = '';
  let input = '';
  let lettersArr = letters || [];

  const inputEl = document.createElement('div');
  inputEl.className = 'keypad-input';

  const lettersGrid = document.createElement('div');
  lettersGrid.className = 'keypad-letters';

  const harakatRow = document.createElement('div');
  harakatRow.className = 'keypad-harakat';

  const actionRow = document.createElement('div');
  actionRow.className = 'keypad-actions';

  root.append(inputEl, lettersGrid, harakatRow, actionRow);

  function render() { inputEl.textContent = input || ' '; }

  function append(s) { input += s; render(); }

  function backspace() {
    const arr = Array.from(input);
    arr.pop();
    input = arr.join('');
    render();
  }

  function clear() { input = ''; render(); }

  function renderLetters() {
    lettersGrid.innerHTML = '';
    for (const ch of lettersArr) {
      const b = document.createElement('button');
      b.className = 'key key--letter';
      b.textContent = ch;
      b.addEventListener('click', () => append(ch));
      lettersGrid.appendChild(b);
    }
  }
  renderLetters();

  for (const h of HARAKAT) {
    const b = document.createElement('button');
    b.className = 'key key--harakah';
    b.textContent = 'ـ' + h.char;
    b.addEventListener('click', () => append(h.char));
    harakatRow.appendChild(b);
  }

  const mk = (label, cls, handler) => {
    const b = document.createElement('button');
    b.className = `key key--action ${cls}`;
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  };
  actionRow.append(
    mk('Space', 'space',  () => append(' ')),
    mk('⌫',     'back',   backspace),
    mk('Clear', 'clear',  clear),
    mk('Submit','submit', () => {
      if (input.trim().length === 0) return;
      const text = input;
      clear();
      onSubmit(text);
    })
  );

  render();

  return {
    setLetters: (ls) => { lettersArr = ls || []; renderLetters(); },
    clearInput: clear,
    focus: () => {},
    destroy: () => { root.innerHTML = ''; }
  };
}
