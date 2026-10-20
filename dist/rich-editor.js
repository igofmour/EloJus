(() => {
  'use strict';
  const R = window.EloRich;
  const paths = { left: 'M3 5h18M3 10h12M3 15h18M3 20h12', center: 'M3 5h18M6 10h12M3 15h18M6 20h12', right: 'M3 5h18M9 10h12M3 15h18M9 20h12', justify: 'M3 5h18M3 10h18M3 15h18M3 20h18', ordered: 'M9 5h12M9 12h12M9 19h12M3 3v5M2 8h3M2 12h3l-3 7h3', bullet: 'M9 5h12M9 12h12M9 19h12M3 5h.1M3 12h.1M3 19h.1', outdent: 'M11 5h10M11 12h10M11 19h10M7 8l-4 4 4 4', indent: 'M11 5h10M11 12h10M11 19h10M3 8l4 4-4 4', undo: 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12', redo: 'M15 5 20 10l-5 5M20 10H10a6 6 0 0 0 0 12' };
  const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
  const button = (command, label, glyph, value = '') => `<button type="button" data-format="${command}" data-value="${value}" title="${label}" aria-label="${label}" ${['bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'align'].includes(command) ? 'aria-pressed="false"' : ''}>${glyph}</button>`;
  function toolbar() {
    return `<div class="format-bar" aria-label="Formatação do documento"><div class="format-controls"><div class="format-group"><label><span class="sr-only">Estilo do parágrafo</span><select data-format="header" aria-label="Estilo do parágrafo"><option value="">Parágrafo</option><option value="1">Título</option><option value="2">Subtítulo</option></select></label><label><span class="sr-only">Tamanho da fonte</span><select data-format="size" aria-label="Tamanho da fonte">${R.sizes.map(size => `<option value="${size}" ${size === '11pt' ? 'selected' : ''}>${size.replace('pt', '')} pt</option>`).join('')}</select></label></div><div class="format-group">${button('bold', 'Negrito (Ctrl+B)', '<b>N</b>')}${button('italic', 'Itálico (Ctrl+I)', '<i>I</i>')}${button('underline', 'Sublinhado (Ctrl+U)', '<u>S</u>')}${button('strike', 'Tachado', '<s>T</s>')}</div><div class="format-group">${button('list', 'Lista com marcadores', icon('bullet'), 'bullet')}${button('list', 'Lista numerada', icon('ordered'), 'ordered')}${button('blockquote', 'Citação em bloco', '“')}</div><div class="format-group">${[['left', 'Alinhar à esquerda'], ['center', 'Centralizar'], ['right', 'Alinhar à direita'], ['justify', 'Justificar']].map(([key, label]) => button('align', label, icon(key), key)).join('')}${button('indent', 'Diminuir recuo', icon('outdent'), '-1')}${button('indent', 'Aumentar recuo', icon('indent'), '+1')}</div><div class="format-group">${button('undo', 'Desfazer (Ctrl+Z)', icon('undo'))}${button('redo', 'Refazer (Ctrl+Shift+Z)', icon('redo'))}${button('clear', 'Limpar formatação do trecho selecionado', 'T<span class="clear-mark">×</span>')}</div></div><div class="format-context"><span id="formatContext">Posicione o cursor no texto para formatar.</span><span>Texto e formatação salvos juntos</span></div></div>`;
  }
  let instances = [], active = null, activeKey = null, bar = null;
  const cache = new Map();
  const sizeStyle = Quill.import('attributors/style/size'); sizeStyle.whitelist = R.sizes; Quill.register(sizeStyle, true);
  function unmount() { for (const entry of instances) { entry.quill.off('text-change', entry.change); entry.quill.off('selection-change', entry.select); entry.quill.disable(); entry.quill.container.remove(); } instances = []; active = null; bar = null; }
  function updateToolbar() {
    if (!bar || !active) return;
    const range = active.range || { index: 0, length: 0 }, formats = active.quill.getFormat(range);
    bar.querySelectorAll('button[aria-pressed]').forEach(button => { const name = button.dataset.format, value = button.dataset.value; button.setAttribute('aria-pressed', String(name === 'align' ? (formats.align || 'left') === value : name === 'list' ? formats.list === value : formats[name] === true)); });
    bar.querySelector('[data-format="header"]').value = formats.header || '';
    bar.querySelector('[data-format="size"]').value = formats.size || '11pt';
    document.getElementById('formatContext').textContent = active.section.title + (range.length ? ` · ${range.length} caracteres selecionados` : ' · edição');
  }
  function mount(item, onChange) {
    bar = document.querySelector('.format-bar');
    document.querySelectorAll('[data-rich-section]').forEach(host => {
      const section = item.sections.find(s => s.id === host.dataset.richSection), readOnly = host.dataset.readonly === 'true';
      const key = item.id + ':' + section.id, cached = cache.get(key);
      let quill;
      if (cached?.section === section) {
        quill = cached.quill; host.replaceWith(quill.container); quill.enable(!readOnly);
      } else {
        quill = new Quill(host, { theme: null, readOnly, formats: ['bold', 'italic', 'underline', 'strike', 'size', 'header', 'list', 'align', 'indent', 'blockquote'], modules: { toolbar: false, history: { delay: 700, maxStack: 100, userOnly: true } } });
        quill.setContents(R.delta(section), 'silent'); quill.history.clear();
      }
      quill.root.setAttribute('role', 'textbox'); quill.root.setAttribute('aria-multiline', 'true'); quill.root.setAttribute('aria-label', section.id === 'corpo' ? 'Texto da peça' : 'Texto: ' + section.title); quill.root.setAttribute('spellcheck', 'true');
      if (section.id === 'corpo') quill.root.dataset.placeholder = 'Escreva ou cole a peça completa, do endereçamento ao encerramento…';
      if (readOnly) quill.root.setAttribute('aria-readonly', 'true');
      const entry = { quill, section, range: cached?.section === section ? cached.range : { index: 0, length: 0 } };
      entry.change = () => { section.delta = R.delta({ delta: quill.getContents() }); section.text = R.text(section); onChange(); updateToolbar(); };
      entry.select = range => { if (range && !readOnly) { active = entry; activeKey = key; entry.range = range; updateToolbar(); } };
      if (!readOnly) { quill.on('text-change', entry.change); quill.on('selection-change', entry.select); }
      instances.push(entry); cache.set(key, entry); if (key === activeKey) active = entry;
    });
    if (!bar) return;
    updateToolbar();
    bar.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
    function command(control) {
      active ||= instances[0]; if (!active) return;
      const q = active.quill, range = active.range || { index: 0, length: 0 }, name = control.dataset.format;
      q.focus({ preventScroll: true }); q.setSelection(range, 'silent');
      q.history.cutoff();
      if (name === 'undo' || name === 'redo') q.history[name]();
      else if (name === 'clear') q.removeFormat(range.index, range.length, 'user');
      else {
        const formats = q.getFormat(range); let value = control.value || control.dataset.value;
        if (['bold', 'italic', 'underline', 'strike', 'blockquote'].includes(name)) value = !formats[name];
        if (name === 'list' && formats.list === value) value = false;
        if (name === 'align' && value === 'left') value = false;
        if (name === 'header') value = Number(value) || false;
        if (name === 'size' && value === '11pt') value = false;
        q.format(name, value, 'user');
      }
      q.history.cutoff(); active.range = q.getSelection() || range; updateToolbar();
    }
    bar.addEventListener('click', event => { const control = event.target.closest('button[data-format]'); if (control) command(control); });
    bar.addEventListener('change', event => { if (event.target.matches('select[data-format]')) command(event.target); });
  }
  function selection() {
    if (!active?.range?.length) return null;
    const start = active.range.index, raw = active.quill.getText(start, Math.min(active.range.length, 2000)), text = raw.trim();
    if (!text) return null;
    return { sectionId: active.section.id, text, start: start + raw.indexOf(text) };
  }
  function appendText(text) {
    const entry = instances.find(entry => entry.section.id === 'corpo');
    if (!entry || !text.trim()) return false;
    const q = entry.quill, at = q.getLength() - 1;
    q.history.cutoff();
    q.insertText(at, (at ? '\n\n' : '') + text + '\n', {}, 'user');
    q.history.cutoff(); q.setSelection(at, 0, 'user'); q.focus();
    return true;
  }
  window.EloEditor = { toolbar, mount, unmount, selection, appendText };
})();
