(async () => {
  'use strict';
  const results = document.getElementById('results'), fixture = document.getElementById('fixture');
  const report = [], check = (value, label) => { report.push(`${value ? 'PASS' : 'FAIL'} ${label}`); results.textContent = report.join('\n'); if (!value) throw new Error(label); };
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const R = window.EloRich;
  let item = {id:'QA-A4',sections:[{id:'corpo',title:'Texto da peça',delta:{ops:[{insert:'Primeira linha.\n'}]}}]};
  function render(preview = false) {
    window.EloPages.unmount(); window.EloEditor.unmount();
    fixture.innerHTML = `<div class="editor-layout"><div class="editor-area">${preview ? '' : window.EloEditor.toolbar()}<div class="paper"><div class="paper-heading">Documento de teste</div><section class="continuous-section">${preview ? `<div class="rich-preview">${R.html(item.sections[0])}</div>` : '<div class="rich-host" data-rich-section="corpo"></div>'}</section><p class="document-disclaimer">Teste</p></div></div></div>`;
    if (!preview) window.EloEditor.mount(item, () => {});
    window.EloPages.mount();
    return preview ? null : Quill.find(fixture.querySelector('.ql-container'));
  }
  function inspect() {
    const root = fixture.querySelector('.paginated-text'), stack = fixture.querySelector('.page-stack');
    const zoom = stack.getBoundingClientRect().width / (210*96/25.4), origin = stack.getBoundingClientRect().top;
    const stride = 297*96/25.4+28, margin=25.4*96/25.4;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT), bad=[]; let node, count=0;
    while ((node=walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const rect of range.getClientRects()) {
        const top=(rect.top-origin)/zoom, bottom=(rect.bottom-origin)/zoom;
        const page=Math.floor((top+0.01)/stride);count++;
        if(top-page*stride<margin-2 || bottom-page*stride>stride-28-margin+2) bad.push({text:node.textContent.slice(0,30),top,bottom});
      }
    }
    return {count,bad,pages:Number(fixture.querySelector('.paged-paper').dataset.pages)};
  }
  try {
    await document.fonts.ready;
    let q=render(); await settle();
    check(inspect().pages===1 && !inspect().bad.length,'short document stays within one A4 page');
    const long='Um parágrafo longo com acentuação, seleção e formatação. '.repeat(420);
    const ops=[{insert:long,attributes:{bold:true}},{insert:'\nTítulo\n',attributes:{header:1}},...Array.from({length:55},(_,i)=>({insert:`Item ${i+1}: lista e continuidade entre páginas.\n`,attributes:{list:'ordered'}})),{insert:'Encerramento.\n'}];
    q.setContents({ops},'user'); await settle();
    let info=inspect();
    check(info.pages>3,'long paragraph and lists generate multiple pages');
    check(!info.bad.length,`all ${info.count} text fragments respect page margins: ${JSON.stringify(info.bad.slice(0,3))}`);
    const saved=JSON.stringify(q.getContents());q.history.cutoff();
    q.setSelection(100,3000,'silent');q.format('italic',true,'user');await settle();
    check(q.getFormat(100,3000).italic,'formatting a selection across pages');q.history.cutoff();
    q.history.undo();await settle();check(JSON.stringify(q.getContents())===saved,'undo preserves original text and formatting');
    q.history.redo();await settle();check(q.getFormat(100,3000).italic,'redo preserves selection formatting');
    const before=JSON.stringify(q.getContents());
    const zoom=fixture.querySelector('[aria-label="Zoom da página"]');zoom.value='1.25';zoom.dispatchEvent(new Event('change'));await settle();
    check(!inspect().bad.length,'125% zoom preserves page geometry');
    check(JSON.stringify(q.getContents())===before,'page decoration never enters Delta');
    render(true);await settle();info=inspect();check(!info.bad.length,`preview respects margins: ${JSON.stringify(info.bad.slice(0,3))}`);
    q=render();q.setContents({ops:[{insert:'\n'}]},'user');await settle();
    check(inspect().pages===1,'clearing the document removes surplus pages');
    check(q.root.classList.contains('ql-blank'),'blank document remains editable');
    for (const value of ['fit','0.75','1','1.25']) {
      const control=fixture.querySelector('[aria-label="Zoom da página"]');
      control.value=value;control.dispatchEvent(new Event('change'));await settle();
      q.setSelection(0,0,'silent');q.focus({preventScroll:true});
      const sheet=fixture.querySelector('.page-sheet').getBoundingClientRect(), br=q.root.querySelector('br').getBoundingClientRect();
      const scale=sheet.width/(210*96/25.4), x=(br.x-sheet.x)/scale, y=(br.y-sheet.y)/scale;
      check(Math.abs(x-96)<1 && y>=96 && y<104,`empty caret starts at the text margin at zoom ${value}: ${x.toFixed(2)}, ${y.toFixed(2)}`);
      check(q.getText()==='\n','empty caret fix adds no document text');
    }
    q.insertText(0,'Texto final.','user');await settle();check(!inspect().bad.length,'typing after clearing remains inside margins');
    results.dataset.status='passed'; report.push('COMPLETE');results.textContent=report.join('\n');
  } catch(error) { results.dataset.status='failed';results.textContent=report.join('\n')+'\n'+error.stack; }
})();
