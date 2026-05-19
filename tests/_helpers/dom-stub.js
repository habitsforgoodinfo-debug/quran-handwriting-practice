// Minimal DOM stub for testing UI modules without jsdom.
// Just enough to support: createElement, appendChild, append, addEventListener (no-op),
// querySelector(All), textContent, className, classList, style, innerHTML, children, remove.

class StubClassList {
  constructor(el) { this.el = el; this._set = new Set(); }
  add(...names) { for (const n of names) this._set.add(n); this._sync(); }
  remove(...names) { for (const n of names) this._set.delete(n); this._sync(); }
  contains(name) { return this._set.has(name); }
  toggle(name) { if (this._set.has(name)) this._set.delete(name); else this._set.add(name); this._sync(); }
  _sync() { this.el._className = [...this._set].join(' '); }
}

class StubNode {
  constructor(tag) {
    this.tagName = tag ? tag.toUpperCase() : '';
    this.children = [];
    this.parentNode = null;
    this._className = '';
    this.classList = new StubClassList(this);
    this.style = {};
    this._text = '';
    this._innerHTML = '';
    this._listeners = {};
    this._attrs = {};
  }
  get className() { return this._className; }
  set className(v) {
    this._className = v;
    this.classList._set = new Set(String(v).trim().split(/\s+/).filter(Boolean));
  }
  get textContent() {
    if (this._text) return this._text;
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; if (v === '') this.children = []; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    this._text = ''; // appending children clears literal text
    return child;
  }
  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') {
        const t = new StubNode('#text');
        t._text = n;
        this.appendChild(t);
      } else {
        this.appendChild(n);
      }
    }
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) { this.children.splice(i, 1); child.parentNode = null; }
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(name, fn) {
    (this._listeners[name] ||= []).push(fn);
  }
  removeEventListener(name, fn) {
    const arr = this._listeners[name] || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  dispatch(name, event = {}) {
    for (const fn of this._listeners[name] || []) fn(event);
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  querySelector(sel) { return this._query(sel, false); }
  querySelectorAll(sel) { return this._query(sel, true); }
  _query(sel, all) {
    const out = [];
    const test = (el) => {
      if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return el._attrs.id === sel.slice(1) || el.id === sel.slice(1);
      return el.tagName === sel.toUpperCase();
    };
    const walk = (el) => {
      for (const c of el.children) {
        if (test(c)) { out.push(c); if (!all) return true; }
        if (walk(c)) return true;
      }
      return false;
    };
    walk(this);
    return all ? out : (out[0] || null);
  }
  // Helpers for tests
  get visibleText() {
    if (this.style.display === 'none') return '';
    if (this._text) return this._text;
    return this.children.map(c => c.visibleText || c.textContent).join('');
  }
}

export function makeDocument() {
  return {
    createElement: (tag) => new StubNode(tag),
    createTextNode: (text) => { const n = new StubNode('#text'); n._text = String(text); return n; },
    body: new StubNode('body')
  };
}

export function installDomStub() {
  globalThis.document = makeDocument();
  return { StubNode };
}

export { StubNode };
