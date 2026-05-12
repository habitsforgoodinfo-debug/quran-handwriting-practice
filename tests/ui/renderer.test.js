import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, StubNode } from '../_helpers/dom-stub.js';
installDomStub();
const { renderUserStream } = await import('../../src/verse/renderer.js');

test('renderUserStream: renders user letters verbatim with mistake class on wrong', () => {
  const container = new StubNode('div');
  renderUserStream(container, [
    { kind: 'letter', letterStatus: 'ok', diaStatus: 'ok',
      user: { letter: 'ك', diacriticChars: ['َ'] } },
    { kind: 'letter', letterStatus: 'wrong', diaStatus: 'n/a',
      user: { letter: 'ل', diacriticChars: [] } }
  ]);
  const glyphs = container.querySelectorAll('.glyph');
  assert.equal(glyphs.length, 2);
  assert.ok(!glyphs[0].querySelector('.glyph__letter').classList.contains('mistake'));
  assert.ok(glyphs[1].querySelector('.glyph__letter').classList.contains('mistake'));
  assert.equal(glyphs[0].querySelector('.glyph__letter').textContent, 'ك');
});
