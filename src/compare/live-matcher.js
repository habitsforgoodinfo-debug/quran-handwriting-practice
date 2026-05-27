import { lettersEquivalent } from './tolerance.js';

const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ',
  dagger_alif: 'ٰ', maddah_above: 'ٓ',
  subscript_alef: 'ٖ', inverted_damma: 'ٗ'
};
const HARAKAT_NAME = Object.fromEntries(
  Object.entries(HARAKAT_CHAR).map(([n, c]) => [c, n])
);
HARAKAT_NAME['ۤ'] = 'maddah_above';     // Indo-Pak high madda
HARAKAT_NAME['ۡ'] = 'sukun';            // Indo-Pak sukun (jazm)

const AUTO_CONSUME_SILENT = new Set(['ا', 'و', 'ي', 'ى', 'ل', 'ٱ']);

const HINT_ORDER = ['shadda','fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm',
  'dagger_alif','subscript_alef','inverted_damma',
  'maddah_above','high_madda'];

export class LiveMatcher {
  constructor(skeleton, { strict = false, optionalLetters = [] } = {}) {
    this.skeleton = skeleton;
    this.strict = strict;
    this.optionalLetters = new Set(optionalLetters);
    this.state = {
      slotIdx: 0,
      awaiting: 'letter',
      typed: [],
      pendingMarks: new Set(),
      rejectCount: 0
    };
    this._advanceToNextSound([]);
  }

  _isAutoConsumed(slot) {
    if (slot.kind === 'wordEnd') return true;
    if (slot.kind === 'silent' && AUTO_CONSUME_SILENT.has(slot.letter)) return true;
    if ((slot.kind === 'sound' || slot.kind === 'silent') &&
        this.optionalLetters.has(slot.letter)) return true;
    return false;
  }

  _advanceToNextSound(inserted) {
    while (this.state.slotIdx < this.skeleton.length) {
      const s = this.skeleton[this.state.slotIdx];
      if (this._isAutoConsumed(s)) {
        inserted.push(s);
        const entry = { kind: s.kind, letter: s.letter, slotIdx: this.state.slotIdx };
        if ((s.kind === 'sound' || s.kind === 'silent') && this.optionalLetters.has(s.letter)) {
          const required = s.expectedHarakat?.required || [];
          const harakatStr = required.map(n => HARAKAT_CHAR[n] || '').join('');
          if (harakatStr) entry.harakat = harakatStr;
          entry.auto = true;
        }
        this.state.typed.push(entry);
        this.state.slotIdx++;
        continue;
      }
      // Sound slot (or a silent slot that is typeable, e.g. ة)
      this.state.awaiting = 'letter';
      this._resetPendingForCurrent();
      this.state.rejectCount = 0;
      return;
    }
    this.state.awaiting = 'done';
  }

  _resetPendingForCurrent() {
    const slot = this.skeleton[this.state.slotIdx];
    this.state.pendingMarks = new Set();
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) return;
    const required = slot.expectedHarakat.required || [];
    for (const m of required) this.state.pendingMarks.add(m);
  }

  _acceptHarakat(name) {
    const slot = this.skeleton[this.state.slotIdx];

    if (this.state.pendingMarks.has(name)) {
      this.state.pendingMarks.delete(name);
      return true;
    }

    if (!slot.acceptWaqf) return false;

    if (name === 'sukun') {
      const vowelLike = [...this.state.pendingMarks].find(m =>
        m === 'fatha' || m === 'kasra' || m === 'damma' ||
        m === 'tanween_fath' || m === 'tanween_kasr' || m === 'tanween_damm'
      );
      if (vowelLike) {
        this.state.pendingMarks.delete(vowelLike);
        slot.usedForm = 'waqf-sukun';
        return true;
      }
    }

    if (name === 'fatha' && this.state.pendingMarks.has('tanween_fath')) {
      this.state.pendingMarks.delete('tanween_fath');
      slot.usedForm = 'waqf-long-a';
      return true;
    }

    return false;
  }

  tryLetter(ch) {
    if (this.state.awaiting !== 'letter') {
      // Pressing a letter when a harakat is expected still counts as a wrong
      // attempt, so the hint logic can step in agnostic of which side of the
      // keypad the user is mashing.
      this.state.rejectCount++;
      return { accepted: false, autoInserted: [] };
    }
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) {
      this.state.rejectCount++;
      return { accepted: false, autoInserted: [] };
    }
    if (!lettersEquivalent(ch, slot.letter, { strict: this.strict })) {
      this.state.rejectCount++;
      return { accepted: false, autoInserted: [] };
    }
    this.state.typed.push({ kind: 'sound', letter: slot.letter, slotIdx: this.state.slotIdx });
    this.state.rejectCount = 0;

    if (slot.expectedHarakat.hasNone || (slot.expectedHarakat.required || []).length === 0) {
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, autoInserted: inserted, complete: this.state.awaiting === 'done' };
    }
    this.state.awaiting = 'harakat';
    return { accepted: true, autoInserted: [] };
  }

  tryHarakat(ch) {
    if (this.state.awaiting !== 'harakat') {
      this.state.rejectCount++;
      return { accepted: false };
    }
    const name = HARAKAT_NAME[ch];
    if (!name) {
      this.state.rejectCount++;
      return { accepted: false };
    }
    if (!this._acceptHarakat(name)) {
      this.state.rejectCount++;
      return { accepted: false };
    }

    this.state.rejectCount = 0;
    const lastSound = [...this.state.typed].reverse().find(t => t.kind === 'sound');
    if (lastSound) lastSound.harakat = (lastSound.harakat || '') + ch;

    if (this.state.pendingMarks.size === 0) {
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, complete: this.state.awaiting === 'done', autoInserted: inserted };
    }
    return { accepted: true, complete: false, autoInserted: [] };
  }

  backspace() {
    while (this.state.typed.length) {
      const last = this.state.typed[this.state.typed.length - 1];
      this.state.typed.pop();
      this.state.slotIdx = last.slotIdx;
      if (last.kind === 'sound') break;
    }
    this._resetPendingForCurrent();
    this.state.awaiting = 'letter';
    this.state.rejectCount = 0;
  }

  nextHint() {
    if (this.state.awaiting === 'letter') {
      const slot = this.skeleton[this.state.slotIdx];
      return slot ? { letter: slot.letter } : {};
    }
    if (this.state.awaiting === 'harakat') {
      for (const name of HINT_ORDER) {
        if (this.state.pendingMarks.has(name)) return { harakat: HARAKAT_CHAR[name] };
      }
    }
    return {};
  }
}
