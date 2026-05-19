const HARAKAT_LABEL = {
  shadda: 'shadda', fatha: 'fatha', kasra: 'kasra', damma: 'damma',
  sukun: 'sukun',
  tanween_fath: 'tanwīn-a', tanween_kasr: 'tanwīn-i', tanween_damm: 'tanwīn-u'
};

export function mountHeatmapStrip(root) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' heatmap-strip';

  function update(items) {
    root.innerHTML = '';
    if (!items || items.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'heatmap-empty';
      empty.textContent = 'build a baseline — start writing';
      root.appendChild(empty);
      return;
    }
    const label = document.createElement('span');
    label.className = 'heatmap-label';
    label.textContent = 'weakest:';
    root.appendChild(label);
    for (const it of items) {
      const chip = document.createElement('span');
      chip.className = 'heatmap-chip';
      chip.textContent = it.kind === 'letter' ? it.value : (HARAKAT_LABEL[it.value] || it.value);
      root.appendChild(chip);
    }
  }

  return { update };
}
