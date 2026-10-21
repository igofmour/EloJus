(() => {
  'use strict';
  // CSS exclusions keep a single Quill document and native selection/history.
  // The page furniture and exclusions never become document content.
  const MM = 96 / 25.4, WIDTH = 210 * MM, HEIGHT = 297 * MM;
  const MARGIN = 25.4 * MM, GAP = 28, STRIDE = HEIGHT + GAP;
  let current = null;
  const view = { zoom: 'fit' };

  function shape(pages) {
    // The first top margin belongs to the container. A full-width exclusion
    // above an empty <p><br></p> puts Chromium's caret beside the float.
    const points = ['0 0'];
    for (let page = 0; page < pages; page++) {
      const top = page * STRIDE;
      points.push(`0 ${top + HEIGHT - 2 * MARGIN}px`, `100% ${top + HEIGHT - 2 * MARGIN}px`,
        `100% ${top + STRIDE}px`, `0 ${top + STRIDE}px`);
    }
    points.push(`0 ${pages * STRIDE}px`);
    return `polygon(${points.join(',')})`;
  }

  function unmount() {
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.resize.disconnect(); current.observer.disconnect();
    current.events.abort();
    current = null;
  }

  function mount() {
    unmount();
    const paper = document.querySelector('.paper');
    const section = paper?.querySelector('.continuous-section');
    if (!section) return;
    const root = section.querySelector('.ql-editor, .rich-preview');
    if (!root) return;
    const area = paper.closest('.editor-area');
    paper.classList.add('paged-paper');
    area.closest('.editor-layout').classList.add('paged-layout');
    const heading = paper.querySelector('.paper-heading');
    heading.classList.add('page-document-label');
    const disclaimer = paper.querySelector('.document-disclaimer');
    const controls = document.createElement('div');
    controls.className = 'page-view-controls';
    controls.innerHTML = '<div><strong>A4</strong><span>21 × 29,7 cm</span><span>Margens normais · 2,54 cm</span></div><div><label><span class="sr-only">Zoom da página</span><select aria-label="Zoom da página"><option value="fit">Ajustar à largura</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option></select></label></div>';
    const viewport = document.createElement('div'); viewport.className = 'page-viewport';
    const stack = document.createElement('div'); stack.className = 'page-stack';
    const sheets = document.createElement('div'); sheets.className = 'page-sheets'; sheets.setAttribute('aria-hidden', 'true');
    const flow = document.createElement('div'); flow.className = 'page-flow';
    flow.append(section); stack.append(sheets, flow); viewport.append(stack);
    const status = document.createElement('div'); status.className = 'page-status';
    status.innerHTML = '<span class="page-count" role="status" aria-live="polite"></span><span>Visualização A4 · a paginação pode variar no Word/PDF</span>';
    paper.replaceChildren(controls, heading, viewport, status, disclaimer);
    root.classList.add('paginated-text');
    let pages = 1, zoom = 1, composing = false;
    controls.querySelector('select').value = view.zoom;
    const entry = { frame: 0, resize: null, observer: null, events: new AbortController() };
    current = entry;
    function setShape(count) {
      root.style.setProperty('--page-shape', shape(count));
      root.style.setProperty('--flow-height', `${count * STRIDE - MARGIN}px`);
    }
    function layout() {
      entry.frame = 0;
      if (current !== entry || !root.isConnected || composing) return;
      const selected = controls.querySelector('select').value;
      zoom = selected === 'fit' ? Math.min(1, Math.max(0.2, (viewport.clientWidth - 32) / WIDTH)) : Number(selected);
      stack.style.zoom = zoom;
      // Recalculate from one page so deleting text also removes surplus sheets.
      let capacity = 1, needed = 1;
      for (let pass = 0; pass < 12; pass++) {
        setShape(capacity);
        const last = root.lastElementChild;
        const bottom = last ? (last.getBoundingClientRect().bottom - root.getBoundingClientRect().top) / zoom : MARGIN + 30;
        needed = Math.max(1, Math.ceil((bottom + 2 * MARGIN) / STRIDE));
        if (needed <= capacity) break;
        capacity = needed + 1;
      }
      pages = needed;
      setShape(pages);
      stack.style.height = `${pages * STRIDE - GAP}px`;
      if (sheets.childElementCount !== pages) {
        sheets.replaceChildren(...Array.from({ length: pages }, (_, i) => {
          const sheet = document.createElement('div'); sheet.className = 'page-sheet';
          sheet.style.top = `${i * STRIDE}px`;
          sheet.innerHTML = `<span class="page-sheet-number">${i + 1} / ${pages}</span>${i < pages - 1 ? `<span class="page-break-label">Quebra de página</span>` : ''}`;
          return sheet;
        }));
      }
      const count = `${pages} ${pages === 1 ? 'página' : 'páginas'} · ${Math.round(zoom * 100)}%`;
      if (status.firstElementChild.textContent !== count) status.firstElementChild.textContent = count;
      paper.dataset.pages = pages;
    }
    function schedule() { if (current === entry && !entry.frame) entry.frame = requestAnimationFrame(layout); }
    controls.querySelector('select').addEventListener('change', event => { view.zoom = event.target.value; schedule(); });
    viewport.addEventListener('click',event=>{
      const belowText=event.target===root&&event.clientY>(root.lastElementChild?.getBoundingClientRect().bottom||0);
      if(belowText||event.target===stack||event.target===viewport||event.target===flow||event.target===section)window.EloEditor?.focusEnd();
    },{signal:entry.events.signal});
    root.addEventListener('compositionstart', () => { composing = true; }, { signal: entry.events.signal });
    root.addEventListener('compositionend', () => { composing = false; schedule(); }, { signal: entry.events.signal });
    // Observe content only; pagination changes CSS variables on the root.
    entry.observer = new MutationObserver(records => {
      if (records.some(record => record.target !== root || record.type !== 'attributes')) schedule();
    });
    entry.observer.observe(root, { childList: true, characterData: true, attributes: true, subtree: true });
    entry.resize = new ResizeObserver(schedule); entry.resize.observe(viewport);
    document.fonts.ready.then(schedule);
    layout();
  }
  window.EloPages = { mount, unmount };
})();
