// Welcome screen: mode selection entry point.
// mountWelcome(rootEl, { onPickMode, onResume }) -> { setResume(labelOrNull) }

export function mountWelcome(rootEl, { onPickMode, onResume }) {
  rootEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'welcome';

  const title = document.createElement('h1');
  title.className = 'welcome__title';
  title.textContent = 'Quran Practice';

  const underline = document.createElement('span');
  underline.className = 'welcome__underline';
  underline.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('p');
  heading.className = 'welcome__heading';
  heading.textContent = 'What would you like to practice today?';

  const tiles = document.createElement('div');
  tiles.className = 'welcome__tiles';

  const MODES = [
    {
      key: 'refresher',
      title: 'Hifz refresher',
      sub: 'Easy - homophone letters only',
      emoji: '🌱',
      tint: 'green',
    },
    {
      key: 'thorough',
      title: 'Hifz thorough',
      sub: 'Every letter',
      emoji: '💪',
      tint: 'sky',
    },
    {
      key: 'dictation',
      title: 'Dictation',
      sub: 'Write what you hear',
      emoji: '🎧',
      tint: 'amber',
    },
  ];

  for (const m of MODES) {
    const tile = document.createElement('button');
    tile.className = `welcome__tile welcome__tile--${m.tint}`;
    tile.type = 'button';

    const iconEl = document.createElement('span');
    iconEl.className = 'welcome__tile-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = m.emoji;

    const textWrap = document.createElement('span');
    textWrap.className = 'welcome__tile-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'welcome__tile-title';
    titleEl.textContent = m.title;

    const subEl = document.createElement('span');
    subEl.className = 'welcome__tile-sub';
    subEl.textContent = m.sub;

    textWrap.append(titleEl, subEl);
    tile.append(iconEl, textWrap);
    tile.addEventListener('click', () => onPickMode(m.key));
    tiles.appendChild(tile);
  }

  const resumeLink = document.createElement('button');
  resumeLink.className = 'welcome__resume';
  resumeLink.type = 'button';
  resumeLink.style.display = 'none';
  resumeLink.addEventListener('click', () => onResume());

  const titleWrap = document.createElement('div');
  titleWrap.className = 'welcome__title-wrap';
  titleWrap.append(title, underline);

  wrap.append(titleWrap, heading, tiles, resumeLink);
  rootEl.appendChild(wrap);

  function setResume(labelOrNull) {
    if (!labelOrNull) {
      resumeLink.style.display = 'none';
    } else {
      resumeLink.textContent = labelOrNull;
      resumeLink.style.display = '';
    }
  }

  return { setResume };
}
