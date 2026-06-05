// Welcome screen: mode selection entry point.
// mountWelcome(rootEl, { onPickMode, onResume }) -> { setResume(labelOrNull) }

export function mountWelcome(rootEl, { onPickMode, onResume }) {
  rootEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'welcome';

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
    },
    {
      key: 'thorough',
      title: 'Hifz thorough',
      sub: 'Every letter',
    },
    {
      key: 'dictation',
      title: 'Dictation',
      sub: 'Write what you hear',
    },
  ];

  for (const m of MODES) {
    const tile = document.createElement('button');
    tile.className = 'welcome__tile';
    tile.type = 'button';

    const titleEl = document.createElement('span');
    titleEl.className = 'welcome__tile-title';
    titleEl.textContent = m.title;

    const subEl = document.createElement('span');
    subEl.className = 'welcome__tile-sub';
    subEl.textContent = m.sub;

    tile.append(titleEl, subEl);
    tile.addEventListener('click', () => onPickMode(m.key));
    tiles.appendChild(tile);
  }

  const resumeLink = document.createElement('button');
  resumeLink.className = 'welcome__resume';
  resumeLink.type = 'button';
  resumeLink.style.display = 'none';
  resumeLink.addEventListener('click', () => onResume());

  wrap.append(heading, tiles, resumeLink);
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
