// Hamburger drawer with scrim, slides in from the right.
// mountDrawer(rootEl, { onOpenSettings, onBackToSurahs }) -> { open, close }

export function mountDrawer(rootEl, { onOpenSettings, onBackToSurahs }) {
  const hamburger = document.createElement('button');
  hamburger.className = 'drawer__hamburger';
  hamburger.type = 'button';
  hamburger.title = 'Menu';
  hamburger.setAttribute('aria-label', 'Open menu');
  // Three-line hamburger icon using text characters.
  hamburger.innerHTML = '<span class="drawer__hamburger-icon">&#9776;</span>';
  hamburger.addEventListener('click', open);

  const scrim = document.createElement('div');
  scrim.className = 'drawer__scrim';
  scrim.addEventListener('click', close);

  const panel = document.createElement('div');
  panel.className = 'drawer__panel';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'drawer__item';
  settingsBtn.type = 'button';
  settingsBtn.textContent = 'Settings';
  settingsBtn.addEventListener('click', () => {
    close();
    onOpenSettings();
  });

  const backBtn = document.createElement('button');
  backBtn.className = 'drawer__item';
  backBtn.type = 'button';
  backBtn.textContent = 'Back to surah list';
  backBtn.addEventListener('click', () => {
    close();
    onBackToSurahs();
  });

  panel.append(settingsBtn, backBtn);
  rootEl.append(hamburger, scrim, panel);

  function open() {
    scrim.classList.add('drawer__scrim--open');
    panel.classList.add('drawer__panel--open');
  }

  function close() {
    scrim.classList.remove('drawer__scrim--open');
    panel.classList.remove('drawer__panel--open');
  }

  return { open, close };
}
