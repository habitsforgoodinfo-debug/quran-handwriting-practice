import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountCelebration } from '../../src/ui/celebration.js';

// The module accesses `void scrim.offsetWidth` to force a reflow.
// The stub has no offsetWidth property; it returns undefined which is fine
// because `void expr` discards the value. No stub change needed.

function setup() {
  globalThis.document = makeDocument();
  globalThis.document.body = document.createElement('body');
  const parent = document.createElement('div');
  const api = mountCelebration(parent);
  return { parent, api };
}

test('celebration: mounts hidden (display none)', () => {
  const { parent } = setup();
  // The scrim is the first child appended to parent
  const scrim = parent.children[0];
  assert.ok(scrim, 'scrim element exists');
  assert.equal(scrim.style.display, 'none', 'scrim is hidden on mount');
});

test('celebration: show() makes overlay visible', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 2 });
  const scrim = parent.children[0];
  // After show(), display is cleared (not 'none')
  assert.notEqual(scrim.style.display, 'none', 'scrim is visible after show()');
});

test('celebration: show() with stars:2 renders 2 filled + 1 hollow', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 2 });
  const scrim = parent.children[0];
  const starsRow = scrim.querySelector('.celebrate-stars');
  assert.ok(starsRow, 'stars row exists');
  const starSpans = starsRow.querySelectorAll('.celebrate-star');
  assert.equal(starSpans.length, 3, 'always 3 star spans');
  const on = starsRow.querySelectorAll('.celebrate-star--on');
  const off = starsRow.querySelectorAll('.celebrate-star--off');
  assert.equal(on.length, 2, '2 filled stars');
  assert.equal(off.length, 1, '1 hollow star');
  // Check glyphs
  assert.equal(on[0].textContent, '★', 'filled star glyph');
  assert.equal(off[0].textContent, '☆', 'hollow star glyph');
});

test('celebration: show() praise text is non-empty', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 2 });
  const scrim = parent.children[0];
  const praise = scrim.querySelector('.celebrate-praise');
  assert.ok(praise, 'praise element exists');
  assert.ok(praise.textContent.trim().length > 0, 'praise text is non-empty');
});

test('celebration: show() line mentions surah name', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 2 });
  const scrim = parent.children[0];
  const line = scrim.querySelector('.celebrate-line');
  assert.ok(line, 'line element exists');
  assert.ok(line.textContent.includes('Al-Fatiha'), 'line mentions surah name');
});

test('celebration: show() with stars:3 shows 3 filled stars', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Baqarah', stars: 3 });
  const scrim = parent.children[0];
  const starsRow = scrim.querySelector('.celebrate-stars');
  const on = starsRow.querySelectorAll('.celebrate-star--on');
  const off = starsRow.querySelectorAll('.celebrate-star--off');
  assert.equal(on.length, 3, '3 filled stars for perfect score');
  assert.equal(off.length, 0, 'no hollow stars for perfect score');
  const line = scrim.querySelector('.celebrate-line');
  assert.ok(line.textContent.includes('Perfect'), 'line says Perfect for 3 stars');
});

test('celebration: show() with stars:0 shows 0 filled stars (clamped)', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'An-Nas', stars: 0 });
  const scrim = parent.children[0];
  const starsRow = scrim.querySelector('.celebrate-stars');
  const on = starsRow.querySelectorAll('.celebrate-star--on');
  const off = starsRow.querySelectorAll('.celebrate-star--off');
  assert.equal(on.length, 0, 'no filled stars for 0');
  assert.equal(off.length, 3, '3 hollow stars for 0 stars');
});

test('celebration: show() with stars:-1 clamps to 0', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'An-Nas', stars: -1 });
  const scrim = parent.children[0];
  const on = scrim.querySelectorAll('.celebrate-star--on');
  assert.equal(on.length, 0, 'negative stars clamped to 0');
});

test('celebration: show() with stars:5 clamps to 3', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'An-Nas', stars: 5 });
  const scrim = parent.children[0];
  const on = scrim.querySelectorAll('.celebrate-star--on');
  assert.equal(on.length, 3, 'stars above 3 clamped to 3');
});

test('celebration: Continue button click hides overlay and calls onDismiss exactly once', () => {
  const { parent, api } = setup();
  let dismissCount = 0;
  api.show({ surahName: 'Al-Ikhlas', stars: 3, onDismiss: () => dismissCount++ });
  const scrim = parent.children[0];
  // find the dismiss button
  const btn = scrim.querySelector('.celebrate-dismiss');
  assert.ok(btn, 'dismiss button exists');
  assert.equal(btn.textContent, 'Continue', 'button says Continue');
  btn.dispatch('click', {});
  assert.equal(scrim.style.display, 'none', 'scrim hidden after Continue click');
  assert.equal(dismissCount, 1, 'onDismiss called exactly once');
  // clicking again should not call onDismiss a second time
  btn.dispatch('click', {});
  assert.equal(dismissCount, 1, 'onDismiss not called again on second click');
});

test('celebration: scrim self-click closes the overlay', () => {
  const { parent, api } = setup();
  let dismissed = false;
  api.show({ surahName: 'Al-Ikhlas', stars: 1, onDismiss: () => { dismissed = true; } });
  const scrim = parent.children[0];
  // Dispatch click with target === scrim to simulate clicking the background
  scrim.dispatch('click', { target: scrim });
  assert.equal(scrim.style.display, 'none', 'scrim hidden after scrim self-click');
  assert.ok(dismissed, 'onDismiss called on scrim self-click');
});

test('celebration: panel click does not close the overlay', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Ikhlas', stars: 1 });
  const scrim = parent.children[0];
  const panel = scrim.querySelector('.celebrate-panel');
  // Dispatch click with target !== scrim (simulates clicking inside the panel)
  scrim.dispatch('click', { target: panel });
  assert.notEqual(scrim.style.display, 'none', 'scrim stays visible when panel is clicked');
});

test('celebration: second show() resets stars row', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 3 });
  api.show({ surahName: 'Al-Baqarah', stars: 1 });
  const scrim = parent.children[0];
  const starsRow = scrim.querySelector('.celebrate-stars');
  const on = starsRow.querySelectorAll('.celebrate-star--on');
  const off = starsRow.querySelectorAll('.celebrate-star--off');
  assert.equal(on.length, 1, 'stars reset to 1 on second show()');
  assert.equal(off.length, 2, '2 hollow stars after reset');
});

test('celebration: second show() with no onDismiss does not throw', () => {
  const { parent, api } = setup();
  api.show({ surahName: 'Al-Fatiha', stars: 2, onDismiss: () => {} });
  // dismiss first
  const scrim = parent.children[0];
  scrim.querySelector('.celebrate-dismiss').dispatch('click', {});
  // second show() with no onDismiss
  assert.doesNotThrow(() => {
    api.show({ surahName: 'An-Nas', stars: 1 });
  }, 'second show() without onDismiss does not throw');
  // clicking Continue with no onDismiss should also not throw
  assert.doesNotThrow(() => {
    scrim.querySelector('.celebrate-dismiss').dispatch('click', {});
  }, 'Continue click with no onDismiss does not throw');
});
