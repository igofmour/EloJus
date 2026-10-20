(() => {
  'use strict';
  const loading = new Map(); let lastURL = null;
  function script(src) {
    if (!loading.has(src)) loading.set(src, new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = () => { loading.delete(src); el.remove(); reject(new Error('Não foi possível carregar a exportação. Atualize a página e tente novamente.')); }; document.head.append(el); }));
    return loading.get(src);
  }
  async function create(item, format, paper) {
    item = window.EloGuided.document(item);
    if (format === 'docx') { await script('vendor/docx.umd.js'); return docx.Packer.toBlob(EloRich.docxDocument(item, docx, paper)); }
    if (format === 'pdf') { await script('vendor/pdfmake.min.js'); await script('vendor/vfs_fonts.js'); return new Promise((resolve, reject) => { try { pdfMake.createPdf(EloRich.pdfDefinition(item, paper)).getBlob(resolve); } catch (error) { reject(error); } }); }
    const plain = [...(item.fullDocument ? [] : ['ELOJUS', item.documentTitle, item.id + ' · ' + item.title]), ...item.sections.map(s => (s.omitTitle ? '' : s.title + '\n') + EloRich.text(s)), 'Minuta demonstrativa. Conteúdo fictício, sujeito à revisão profissional.'].join('\n\n');
    return new Blob(['\ufeff' + plain], { type: 'text/plain;charset=utf-8' });
  }
  async function download(item, format, paper, container) {
    const controls = [...container.querySelectorAll('[data-action="downloadDocument"], #exportPaper')], status = container.querySelector('#exportStatus'), output = container.querySelector('#exportResult');
    controls.forEach(control => control.disabled = true); status.textContent = 'Preparando o arquivo…'; output.replaceChildren();
    try {
      // Snapshot now: asynchronous library loading must not mix versions/cases.
      let deadline;
      const blob = await Promise.race([create(JSON.parse(JSON.stringify(item)), format, paper), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('A geração demorou mais que o esperado. Tente novamente ou exporte um texto menor.')), 60000); })]).finally(() => clearTimeout(deadline));
      if (lastURL) URL.revokeObjectURL(lastURL); lastURL = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = lastURL; link.download = item.id + '-minuta.' + format; link.className = 'button secondary'; link.textContent = 'Baixar novamente · ' + format.toUpperCase();
      output.append(link); link.click(); status.textContent = 'Arquivo pronto. Se o download não começou, use o link abaixo.';
    } catch (error) { status.textContent = error.message || 'Não foi possível gerar o arquivo. Tente novamente.'; }
    finally { controls.forEach(control => control.disabled = false); }
  }
  window.EloExport = { create, download };
})();
