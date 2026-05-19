import { lettersEquivalent } from './tolerance.js';

const HARAKAT_CHAR = {
  fatha: 'َ', kasra: 'ِ', damma: 'ُ', sukun: 'ْ', shadda: 'ّ',
  tanween_fath: 'ً', tanween_kasr: 'ٍ', tanween_damm: 'ٌ'
};
const HARAKAT_NAME = Object.fromEntries(
  Object.entries(HARAKAT_CHAR).map(([n, c]) => [c, n])
);

// Letters that are truly auto-consumed when silent (madd elongation letters,
// assimilated lam in ال, etc.). ة is NOT in this set — it is typeable.
const AUTO_CONSUME_SILENT = new Set(['ا', 'و', 'ي', 'ى', 'ل', 'ٱ']);

export class LiveMatcher {
  constructor(skeleton, { strict = false } = {}) {
    this.skeleton = skeleton;
    this.strict = strict;
    this.state = {
      slotIdx: 0,
      awaiting: 'letter',
      typed: [],
      pendingShadda: false,
      pendingVowel: false
    };
    this._advanceToNextSound([]);
  }

  _isAutoConsumed(slot) {
    if (slot.kind === 'wordEnd') return true;
    if (slot.kind === 'silent' && AUTO_CONSUME_SILENT.has(slot.letter)) return true;
    return false;
  }

  _advanceToNextSound(inserted) {
    while (this.state.slotIdx < this.skeleton.length) {
      const s = this.skeleton[this.state.slotIdx];
      if (this._isAutoConsumed(s)) {
        inserted.push(s);
        this.state.typed.push({ kind: s.kind, letter: s.letter, slotIdx: this.state.slotIdx });
        this.state.slotIdx++;
        continue;
      }
      // Sound slot (or a silent slot that is typeable, e.g. ة)
      this.state.awaiting = 'letter';
      this._resetPendingForCurrent();
      return;
    }
    this.state.awaiting = 'done';
  }

  _resetPendingForCurrent() {
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) {
      this.state.pendingShadda = false;
      this.state.pendingVowel = false;
      return;
    }
    const eh = slot.expectedHarakat;
    this.state.pendingShadda = !!eh.shadda;
    this.state.pendingVowel  = !!eh.vowel;
  }

  tryLetter(ch) {
    if (this.state.awaiting !== 'letter') return { accepted: false, autoInserted: [] };
    const slot = this.skeleton[this.state.slotIdx];
    if (!slot || (slot.kind !== 'sound' && slot.kind !== 'silent')) return { accepted: false, autoInserted: [] };
    if (!lettersEquivalent(ch, slot.letter, { strict: this.strict })) {
      return { accepted: false, autoInserted: [] };
    }
    this.state.typed.push({ kind: 'sound', letter: slot.letter, slotIdx: this.state.slotIdx });

    if (slot.expectedHarakat.none) {
      this.state.slotIdx++;
      const inserted = [];
      this._advanceToNextSound(inserted);
      return { accepted: true, autoInserted: inserted, complete: this.state.awaiting === 'done' };
    }
    this.state.awaiting = 'harakat';
    return { accepted: true, autoInserted: [] };
  }

  tryHarakat(ch) {
    if (this.state.awaiting !== 'harakat') return { accepted: false };
    const slot = this.skeleton[this.state.slotIdx];
    const eh = slot.expectedHarakat;
    const name = HARAKAT_NAME[ch];
    if (!name) return { accepted: false };

    if (name === 'shadda') {
      if (!this.state.pendingShadda) return { accepted: false };
      this.state.pendingShadda = false;
    } else {
      if (!this.state.pendingVowel || eh.vowel !== name) return { accepted: false };
      this.state.pendingVowel = false;
    }

    const lastSound = [...this.state.typed].reverse().find(t => t.kind === 'sound');
    if (lastSound) lastSound.harakat = (lastSound.harakat || '') + ch;

    if (!this.state.pendingShadda && !this.state.pendingVowel) {
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
  }

  nextHint() {
    if (this.state.awaiting === 'letter') {
      const slot = this.skeleton[this.state.slotIdx];
      return slot ? { letter: slot.letter } : {};
    }
    if (this.state.awaiting === 'harakat') {
      const slot = this.skeleton[this.state.slotIdx];
      const eh = slot.expectedHarakat;
      if (this.state.pendingShadda) return { harakat: HARAKAT_CHAR.shadda };
      if (this.state.pendingVowel && eh.vowel) return { harakat: HARAKAT_CHAR[eh.vowel] };
    }
    return {};
  }
}
