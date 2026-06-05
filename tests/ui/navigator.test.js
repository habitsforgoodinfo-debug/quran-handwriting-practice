import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub } from '../_helpers/dom-stub.js';
import { mountNavigator } from '../../src/ui/navigator.js';

function makeNav(opts = {}) {
  installDomStub();
  const root = document.createElement('div');
  const nav = mountNavigator(root, opts);

  function reg(name) {
    const el = document.createElement('div');
    nav.register(name, el);
    return el;
  }

  return { nav, root, reg };
}

test('navigator: register + go activates the card', () => {
  const { nav, reg } = makeNav();
  const el = reg('welcome');
  reg('surahs');
  nav.go('welcome');
  assert.ok(el.classList.contains('card--active'));
  assert.equal(nav.current(), 'welcome');
});

test('navigator: back() pops and re-activates the previous card', () => {
  const { nav, reg } = makeNav();
  const welcome = reg('welcome');
  const surahs = reg('surahs');
  nav.go('welcome');
  nav.go('surahs');
  assert.ok(surahs.classList.contains('card--active'));
  nav.back();
  assert.ok(welcome.classList.contains('card--active'));
  assert.equal(nav.current(), 'welcome');
});

test('navigator: go() to existing history entry truncates - no history growth', () => {
  const { nav, reg } = makeNav();
  reg('welcome');
  reg('surahs');
  reg('canvas');
  // Build: welcome -> surahs -> canvas
  nav.go('welcome');
  nav.go('surahs');
  nav.go('canvas');
  assert.equal(nav.current(), 'canvas');
  // Go back to surahs via go() - should truncate, not push
  nav.go('surahs');
  assert.equal(nav.current(), 'surahs');
  // Now back() should land on welcome, not canvas
  nav.back();
  assert.equal(nav.current(), 'welcome');
});

test('navigator: go() to existing history - back() never re-shows the card just left', () => {
  const { nav, reg } = makeNav();
  reg('welcome');
  reg('surahs');
  reg('canvas');
  // welcome -> surahs -> canvas, then go(surahs) from canvas
  nav.go('welcome');
  nav.go('surahs');
  nav.go('canvas');
  nav.go('surahs');
  // Repeated back() should not re-surface canvas
  nav.back();
  assert.equal(nav.current(), 'welcome');
  // At root now; further back() is a no-op
  nav.back();
  assert.equal(nav.current(), 'welcome');
});

test('navigator: onChange fires with card name on go()', () => {
  const fired = [];
  const { nav, reg } = makeNav({ onChange: (name) => fired.push(name) });
  reg('welcome');
  reg('surahs');
  nav.go('welcome');
  nav.go('surahs');
  assert.deepEqual(fired, ['welcome', 'surahs']);
});

test('navigator: onChange fires with card name on back()', () => {
  const fired = [];
  const { nav, reg } = makeNav({ onChange: (name) => fired.push(name) });
  reg('welcome');
  reg('surahs');
  nav.go('welcome');
  nav.go('surahs');
  fired.length = 0; // reset after setup
  nav.back();
  assert.deepEqual(fired, ['welcome']);
});

test('navigator: duplicate consecutive go() is a no-op (no history growth)', () => {
  const fired = [];
  const { nav, reg } = makeNav({ onChange: (name) => fired.push(name) });
  reg('welcome');
  nav.go('welcome');
  nav.go('welcome');
  nav.go('welcome');
  assert.deepEqual(fired, ['welcome']); // only fired once
  assert.equal(nav.current(), 'welcome');
});

test('navigator: back() is a no-op when only one entry in history', () => {
  const { nav, reg } = makeNav();
  reg('welcome');
  nav.go('welcome');
  nav.back();
  assert.equal(nav.current(), 'welcome');
});

test('navigator: current() is null before any go()', () => {
  const { nav, reg } = makeNav();
  reg('welcome');
  assert.equal(nav.current(), null);
});

test('navigator: go() to unknown card is a no-op', () => {
  const { nav, reg } = makeNav();
  reg('welcome');
  nav.go('welcome');
  nav.go('nonexistent');
  assert.equal(nav.current(), 'welcome');
});
