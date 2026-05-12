import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, StubNode } from '../_helpers/dom-stub.js';

installDomStub();

// Import AFTER installing the DOM stub, because verse-display imports renderer
// which uses document.createElement at call time (not at import time — but be safe).
const { mountVerseDisplay } = await import('../../src/ui/verse-display.js');

test('verse-display: setRevealVerses populates reveal container with verse strings', () => {
  const root = new StubNode('div');
  const api = mountVerseDisplay(root, { onPlayVerse: () => {} });
  api.setRevealVerses(['بِسْمِ ٱللَّهِ', 'ٱلْحَمْدُ لِلَّهِ']);
  const reveal = root.querySelector('.verses--reveal');
  assert.ok(reveal, 'reveal container exists');
  assert.equal(reveal.children.length, 2, 'two reveal-line entries');
  assert.equal(reveal.children[0].textContent, 'بِسْمِ ٱللَّهِ');
  assert.equal(reveal.children[1].textContent, 'ٱلْحَمْدُ لِلَّهِ');
});

test('verse-display: reset() clears both user AND reveal containers', () => {
  const root = new StubNode('div');
  const api = mountVerseDisplay(root, { onPlayVerse: () => {} });
  api.setRevealVerses(['x', 'y']);
  api.startNewVerse(); // adds a user-line
  api.reset();
  assert.equal(root.querySelector('.verses--user').children.length, 0);
  assert.equal(root.querySelector('.verses--reveal').children.length, 0);
});

test('verse-display: reveal toggle swaps which container is shown', () => {
  const root = new StubNode('div');
  const api = mountVerseDisplay(root, { onPlayVerse: () => {} });
  api.setRevealVerses(['v1']);
  const user = root.querySelector('.verses--user');
  const reveal = root.querySelector('.verses--reveal');
  // Initially user is shown, reveal is hidden.
  assert.notEqual(reveal.style.display, '', 'reveal starts hidden');
  assert.notEqual(reveal.style.display, undefined);
  const btn = root.querySelector('.reveal-btn');
  btn.dispatch('click');
  assert.equal(user.style.display, 'none', 'user hidden after toggle');
  assert.equal(reveal.style.display, '', 'reveal shown after toggle');
  btn.dispatch('click');
  assert.equal(reveal.style.display, 'none', 'reveal hidden after second toggle');
});
