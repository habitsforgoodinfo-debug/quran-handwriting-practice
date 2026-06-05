import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountRollingStrip } from '../../src/ui/rolling-strip.js';

function setup() {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountRollingStrip(root);
  return { root, api };
}

test('rolling-strip: mounts empty - no text spans', () => {
  const { root } = setup();
  const strip = root.querySelector('.rolling-strip');
  assert.ok(strip, 'rolling-strip wrapper exists');
  const texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 0, 'no verse spans on mount');
});

test('rolling-strip: pushVerse renders cleaned text', () => {
  const { root, api } = setup();
  // Use a simple Arabic string - cleanVerseForDisplay strips high marks
  api.pushVerse('قُلْ هُوَ');
  const strip = root.querySelector('.rolling-strip');
  const texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 1, 'one text span after one pushVerse');
  // text should be non-empty (cleaned)
  assert.ok(texts[0].textContent.trim().length > 0, 'text span has content');
});

test('rolling-strip: latest verse gets --latest class; previous loses it', () => {
  const { root, api } = setup();
  api.pushVerse('قُلْ');
  api.pushVerse('هُوَ');
  const strip = root.querySelector('.rolling-strip');
  const texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 2, 'two text spans after two pushVerse calls');
  // last one should have --latest
  assert.ok(
    texts[1].classList.contains('rolling-strip__text--latest'),
    'second verse has --latest class'
  );
  // first should not have --latest
  assert.ok(
    !texts[0].classList.contains('rolling-strip__text--latest'),
    'first verse does not have --latest class'
  );
});

test('rolling-strip: verses joined with ۝ marker spans', () => {
  const { root, api } = setup();
  api.pushVerse('قُلْ');
  api.pushVerse('هُوَ');
  const strip = root.querySelector('.rolling-strip');
  const markers = strip.querySelectorAll('.rolling-strip__marker');
  // each verse gets a marker appended after it (including the latest)
  assert.equal(markers.length, 2, 'one marker per verse');
  assert.ok(markers[0].textContent.includes('۝'), 'marker contains ۝ glyph');
});

test('rolling-strip: MAX_VERSES (60) cap drops oldest', () => {
  const { root, api } = setup();
  for (let i = 0; i < 65; i++) {
    api.pushVerse(`verse ${i}`);
  }
  const strip = root.querySelector('.rolling-strip');
  const texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 60, 'capped at 60 verses');
  // The oldest dropped verses are 0..4; the newest should be verse 64
  const lastText = texts[59].textContent;
  assert.ok(lastText.includes('64'), 'newest verse is last in strip');
  // verse 0..4 should be gone
  const allText = texts.map(t => t.textContent).join(' ');
  assert.ok(!allText.includes('verse 0 ') && !allText.includes('verse 4 '), 'oldest verses dropped');
});

test('rolling-strip: clear() empties strip and subsequent pushVerse starts fresh', () => {
  const { root, api } = setup();
  api.pushVerse('قُلْ');
  api.pushVerse('هُوَ');
  api.clear();
  const strip = root.querySelector('.rolling-strip');
  let texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 0, 'strip empty after clear()');

  // subsequent push starts fresh
  api.pushVerse('اللَّه');
  texts = strip.querySelectorAll('.rolling-strip__text');
  assert.equal(texts.length, 1, 'one text span after push on cleared strip');
  assert.ok(
    texts[0].classList.contains('rolling-strip__text--latest'),
    'fresh push has --latest class'
  );
});
