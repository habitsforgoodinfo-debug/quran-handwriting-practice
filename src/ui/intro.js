// Welcome modal that explains the app's purpose, a Quranic anchor for
// it, a few real "easily-confused" word examples, and a small dua
// request. Pops up on every app open until the user ticks "don't show
// again" (persisted in settings.hideIntro).

const EXAMPLES = [
  {
    ar: 'ٱلضَّآلِّينَ',
    tl: 'aḍ-ḍāllīn',
    where: 'Al-Fatiha 1:7',
    note: 'Look at it carefully — ض (ḍād) not ظ (ẓāʾ); two shadda-bearing letters and a madd between them. Most readers slip on the ḍ/ẓ and on which letter the shadda belongs to.'
  },
  {
    ar: 'ذَٰلِكَ',
    tl: 'dhālika',
    where: 'Al-Baqarah 2:2',
    note: 'The dagger-alif (ـٰ) above ذ is invisible to many — without it the word becomes "dhalika" with a short a, but it must be long: "dhālika".'
  },
  {
    ar: 'صِرَٰطَ',
    tl: 'ṣirāṭa',
    where: 'Al-Fatiha 1:7',
    note: 'Three subtle heavy letters in a row — ص (ṣād), ر, ط (ṭāʾ). Many write س / ت / ث by mistake. The dagger-alif elongation is easy to miss too.'
  },
  {
    ar: 'يَسْتَهْزِئُونَ',
    tl: 'yastahziʾūn',
    where: 'Al-Baqarah 2:14',
    note: 'Multiple sukūns stacked together, plus the hamza-on-yeh (ئ) that few learners can place correctly. Writing it forces every mark to be deliberate.'
  }
];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function mountIntro(root, { onHide, onDismiss }) {
  const modal = el('div', 'modal intro-modal');
  const panel = el('div', 'modal__panel intro__panel');

  // Header
  const head = el('div', 'intro__head');
  head.append(
    el('div', 'intro__bismillah', '﷽'),
    el('h2', 'intro__title', 'Welcome — write the Quran with your own hand'),
    el('div', 'intro__sub',
       'A practice tool for learning the letters and harakat of the Quran by writing them, one ayah at a time.')
  );
  panel.appendChild(head);

  // Objective
  const obj = el('section', 'intro__section');
  obj.appendChild(el('h3', 'intro__h', 'Why this exists'));
  obj.appendChild(el('p', null,
    'Reading and reciting the Quran is one practice — copying it by hand is another. Writing each ' +
    'letter and its harakat forces your eyes and your fingers to see what the tongue often glosses over. ' +
    'This app guides that practice: it shows you the transliteration so you know what to write, ' +
    'checks every keystroke, and keeps a personal "book" of every ayah you have written.'
  ));
  panel.appendChild(obj);

  // Quranic anchor
  const anchor = el('section', 'intro__section intro__anchor');
  anchor.appendChild(el('div', 'intro__verse-ar', 'وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍۢ'));
  anchor.appendChild(el('div', 'intro__verse-en',
    '"And We have certainly made the Quran easy for remembrance, so is there any who will remember?"'));
  anchor.appendChild(el('div', 'intro__verse-ref', 'Sūrah Al-Qamar 54:17'));
  anchor.appendChild(el('p', 'intro__quote',
    'And the Prophet ﷺ said: «خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ» — ' +
    '"The best of you are those who learn the Quran and teach it." (Ṣaḥīḥ al-Bukhārī 5027)'
  ));
  panel.appendChild(anchor);

  // Confused-words eye opener
  const ex = el('section', 'intro__section');
  ex.appendChild(el('h3', 'intro__h', 'Eye-opener: a few words most readers slip on'));
  ex.appendChild(el('p', 'intro__hint',
    'Open any of these in the app and try writing them — you will feel where your eye has been letting you down.'
  ));
  const list = el('div', 'intro__examples');
  for (const ex1 of EXAMPLES) {
    const row = el('div', 'intro-example');
    const ar = el('div', 'intro-example__ar', ex1.ar);
    const meta = el('div', 'intro-example__meta');
    meta.appendChild(el('span', 'intro-example__tl', ex1.tl));
    meta.appendChild(el('span', 'intro-example__where', ' · ' + ex1.where));
    const note = el('div', 'intro-example__note', ex1.note);
    row.append(ar, meta, note);
    list.appendChild(row);
  }
  ex.appendChild(list);
  panel.appendChild(ex);

  // How to use
  const how = el('section', 'intro__section');
  how.appendChild(el('h3', 'intro__h', 'How to use it'));
  const ol = el('ol', 'intro__steps');
  for (const step of [
    'Pick a sūrah and a starting ayah at the top.',
    'Read the transliteration of the verse — it tells you what to write.',
    'Type each Arabic letter and its harakat from the on-screen keypad. The app accepts only the correct keypress.',
    'After two wrong attempts on the same slot, the correct key glows green to help you.',
    'Finishing an ayah saves it into "My Book" (📖) — your personal record of the Quran you have written.',
    'Tap 🎧 for "rapid fire" — the app picks a verse you have struggled with and plays its recitation once. Write it back from memory.'
  ]) ol.appendChild(el('li', null, step));
  how.appendChild(ol);
  panel.appendChild(how);

  // Dua section
  const dua = el('section', 'intro__section intro__dua');
  dua.appendChild(el('h3', 'intro__h', 'A small request'));
  dua.appendChild(el('p', null,
    'This idea came from my father, Mohammad Nayeem — may Allah preserve him, grant him health, ' +
    'and accept this small effort from him. If this app helps you in any way, please make a duʿāʾ ' +
    'for him and for our family, that we are all kept close to His Book in this life and the next. ' +
    'Jazākum Allāhu khayran.'
  ));
  panel.appendChild(dua);

  // Footer: checkbox + close button
  const foot = el('div', 'intro__foot');
  const labWrap = el('label', 'intro__check');
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.className = 'intro__check-box';
  labWrap.append(cb, document.createTextNode(' Don\'t show this again'));
  foot.appendChild(labWrap);

  const closeBtn = el('button', 'intro__close', 'Start writing');
  closeBtn.addEventListener('click', async () => {
    if (cb.checked && onHide) await onHide();
    modal.remove();
    if (onDismiss) onDismiss();
  });
  foot.appendChild(closeBtn);
  panel.appendChild(foot);

  modal.appendChild(panel);
  root.appendChild(modal);
}
