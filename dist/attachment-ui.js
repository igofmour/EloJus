(() => {
  'use strict';
  const A = window.EloAttachments, S = window.EloFileStore, M = window.EloModel, W = window.EloWritingFiles, e = M.escape;
  const $ = s => document.querySelector(s), uid = () => crypto.randomUUID();
  let ctx, busy = false, pickerCase, pickerWriting=false, previewUrl, previewToken = 0, pdfSession, linkAnchor;
  const results = new Map();
  const canManage = (item, userId) => M.canEdit(item, userId) || (item.status === 'intake' && userId === 'marina');
  const size = n => n < 1024 * 1024 ? `${Math.max(1, Math.ceil(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
  const button = (text, action, extra = '', cls = '') => `<button type="button" class="button ${cls || 'quiet'}" data-attachment-action="${action}" ${extra}>${text}</button>`;
  const attr = (name, value) => `data-${name}="${e(value)}"`;
  function writingFiles(item,userId){
    return W.render({local:true,editable:canManage(item,userId),busy,files:A.active(item).map(f=>({id:f.id,name:f.name,info:size(f.size),available:f.availability==='ready'}))});
  }
  function library(item, userId) {
    const editable = canManage(item, userId), files = A.active(item), retired = A.files(item).filter(f => f.archived), issues = A.issues(item);
    const card = file => {
      const links = A.links(item).filter(l => l.attachmentId === file.id), sectionNames = [...new Set(links.map(l => item.sections.find(s => s.id === l.sectionId)?.title || 'Seção indisponível'))];
      return `<article class="attachment-card"><div class="attachment-card-heading"><span class="attachment-symbol">${e(file.ext.toUpperCase())}</span><div><span class="eyebrow">${A.label(file)}${file.archived ? ' · RETIRADO' : ''}</span><h3>${e(file.name)}</h3><small>${size(file.size)} · ${e(new Date(file.uploadedAt).toLocaleDateString('pt-BR'))}</small></div></div>${file.availability !== 'ready' ? `<p class="attachment-warning">${file.availability === 'missing' ? 'Arquivo indisponível neste navegador.' : 'Conferindo armazenamento local…'}</p>` : ''}<p class="attachment-destinations">${sectionNames.length ? '↗ ' + e(sectionNames.join(' · ')) : 'Ainda sem vínculo na peça'}</p><div class="attachment-actions">${button('Abrir', 'view', attr('file', file.id), 'secondary')}${editable && !busy ? (file.archived ? button('Restaurar', 'restore', attr('file', file.id)) : button('Vincular', 'link', attr('file', file.id)) + button('Retirar', 'archive', attr('file', file.id))) : ''}</div></article>`;
    };
    return `<section class="attachment-library" aria-label="Documentos do caso"><div class="attachment-library-heading"><div><span class="eyebrow">ARQUIVOS DO CASO</span><h2>Uma fonte para cada fato.</h2></div><span class="attachment-count">${String(files.length).padStart(2, '0')}</span></div><p class="attachment-intro">Adicione os documentos e indique onde sustentam os fatos e as provas da peça.</p>${editable ? `<div class="attachment-dropzone ${busy ? 'is-busy' : ''}" data-drop-case="${e(item.id)}">${button(busy ? 'Salvando arquivos…' : '＋ Adicionar documentos', 'upload', busy ? 'disabled' : '', 'primary')}<span>ou arraste os arquivos para cá</span><small>PDF, Word (.docx), imagens e TXT<br>Até 20 MB por arquivo · 100 MB por caso</small></div>` : '<p class="attachment-readonly">Documentos em leitura nesta visão.</p>'}${results.has(item.id) ? `<p class="attachment-feedback" role="status">${e(results.get(item.id))}</p>` : ''}${issues.length ? `<div class="attachment-warning"><strong>${issues.length} vínculo(s) para conferir</strong><p>Revise os trechos e os arquivos antes de exportar ou aprovar.</p>${issues.map(({ link, problem }) => button(e(problem) + ' ↗', 'jump', attr('section', link.sectionId))).join('')}</div>` : ''}<div class="attachment-list">${files.length ? files.map(card).join('') : '<div class="attachment-empty"><span>01 → Fato → Prova</span><p>Os arquivos enviados aparecerão aqui.<br>Selecione um trecho no editor para criar o primeiro vínculo.</p></div>'}</div>${retired.length ? `<details class="attachment-retired"><summary>Documentos retirados (${retired.length})</summary>${retired.map(card).join('')}</details>` : ''}<p class="attachment-storage-note">Arquivos guardados apenas neste navegador. Limpar os dados do site remove os arquivos. ${item.fullDocument ? 'Insira as referências no texto da peça para exportá-las. Os anexos são baixados separadamente.' : 'A exportação inclui as referências; os anexos são baixados separadamente.'}</p></section>`;
  }
  function section(item, s, userId) {
    if (!A.eligible(s)) return '';
    const editable = canManage(item, userId), links = A.links(item).filter(l => l.sectionId === s.id);
    return `<div class="attachment-section" data-links-section="${e(s.id)}"><div class="attachment-section-heading"><span>${s.id === 'corpo' ? 'VÍNCULOS DA PEÇA' : 'DOCUMENTOS DE APOIO'} · ${links.length}</span>${editable ? button('＋ Vincular documento', 'link', attr('section', s.id)) : ''}</div>${links.map(link => {
      const file = A.files(item).find(f => f.id === link.attachmentId), problem = A.linkState(item, link);
      return `<article class="evidence-link ${problem ? 'needs-review' : ''}"><div class="evidence-link-heading"><strong>${e(file ? A.label(file) + ' · ' + file.name : 'Documento indisponível')}</strong><span>${problem ? '!' : '↗'}</span></div>${link.quote ? `<blockquote>“${e(link.quote)}”</blockquote>` : `<p>${s.id === 'corpo' ? 'Vinculado ao texto da peça' : 'Vinculado à seção inteira'}</p>`}${link.location ? `<p>Localização: ${e(link.location)}</p>` : ''}${link.note ? `<details><summary>Nota interna sobre a prova</summary><p>${e(link.note)}</p></details>` : ''}${problem ? `<p class="attachment-warning">${e(problem)}</p>` : ''}<div class="attachment-actions">${file ? button('Ver documento', 'view', attr('file', file.id)) : ''}${editable ? button('Editar vínculo', 'link', attr('link', link.id)) + button('Desvincular', 'unlink', attr('link', link.id)) : ''}</div></article>`;
    }).join('')}</div>`;
  }
  function refreshLinks(item) {
    for (const node of document.querySelectorAll('[data-links-section]')) {
      const s = item.sections.find(s => s.id === node.dataset.linksSection);
      if (s) node.outerHTML = section(item, s, ctx.userId());
    }
  }
  function recordEvent(item, text, actor) { item.updatedAt = new Date().toISOString(); item.events.unshift({ text, userId: actor, at: item.updatedAt }); }
  // Persist metadata only after the blob transaction has completed. Restore state if localStorage fails.
  function mutate(item, fn, message, actor = ctx.userId()) {
    if (!canManage(item, actor) || actor !== ctx.userId()) throw new Error('A visão atual não permite alterar os documentos deste caso.');
    const before = { attachments: structuredClone(A.files(item)), documentLinks: structuredClone(A.links(item)), events: structuredClone(item.events), updatedAt: item.updatedAt };
    try { fn(); recordEvent(item, message, actor); if (!ctx.persist()) throw new Error('O registro não foi salvo. Libere espaço no navegador e tente novamente.'); }
    catch (error) { Object.assign(item, before); throw error; }
  }
  async function upload(item, inputFiles, writing=false) {
    if (busy || !inputFiles.length) return;
    const actor = ctx.userId(); if (!canManage(item, actor)) { ctx.notify('Upload indisponível nesta visão.'); return; }
    if(writing){try{W.validate(inputFiles);}catch{ctx.notify(W.message);return;}}
    busy = true; let count = 0; const errors = []; ctx.render();
    try {
      for (const file of inputFiles) {
        let storedId;
        try {
          if (!canManage(item, actor) || actor !== ctx.userId()) throw new Error('Visão alterada; envie novamente os arquivos restantes.');
          if (file.size > A.MAX_FILE) throw new Error('Cada arquivo pode ter até 20 MB.');
          const bytes = await file.arrayBuffer(), format = A.validate(file, bytes);
          const digest = await crypto.subtle.digest('SHA-256', bytes), sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
          const metadata = { id: uid(), name: file.name.slice(0, 255), size: file.size, ...format, sha256, uploadedAt: new Date().toISOString(), userId: actor };
          A.addFile({ attachments: structuredClone(A.files(item)) }, metadata);
          await S.put({ id: metadata.id, blob: new Blob([bytes], { type: format.mime }), sha256 }); storedId = metadata.id;
          mutate(item, () => A.addFile(item, metadata), `Documento adicionado: ${metadata.name}.`, actor); storedId = null; count++;
        } catch (error) { if (storedId) { try { await S.remove(storedId); } catch {} } errors.push(`${file.name}: ${error.message}`); }
      }
    } finally { busy = false; results.set(item.id, `${count} arquivo(s) salvo(s).${errors.length ? '\n' + errors.join('\n') : ' Você já pode vinculá-los à peça.'}`); ctx.render(); ctx.notify(`${count} arquivo(s) salvo(s) no caso ${item.id}.${errors.length ? ' Confira os avisos na área de documentos.' : ''}`); }
  }
  function linkDialog(item, data) {
    const old = A.links(item).find(l => l.id === data.link), selection = ctx.selection();
    const options = A.active(item).filter(f => f.availability === 'ready'), sections = item.sections.filter(A.eligible);
    if (!options.length) { ctx.documents(); ctx.notify('Adicione um documento disponível antes de criar o vínculo.'); return; }
    if (!sections.length) { ctx.notify('Este documento não possui uma seção de fatos ou provas.'); return; }
    const sid = old?.sectionId || data.section || (sections.some(s => s.id === selection?.sectionId) && selection.sectionId) || sections[0].id;
    const fid = old?.attachmentId || data.file || options[0].id, quote = old ? old.quote : selection?.sectionId === sid ? selection.text : '';
    linkAnchor = null;
    if (quote && Number.isInteger(selection?.start) && selection?.sectionId === sid && selection.text === quote) {
      const text = item.sections.find(s => s.id === sid).text, at = selection.start;
      if (text.slice(at, at + quote.length) === quote) linkAnchor = { caseId: item.id, sectionId: sid, quote, context: { before: text.slice(Math.max(0, at - 80), at), after: text.slice(at + quote.length, at + quote.length + 80) } };
    }
    ctx.dialog(old ? 'Conferir vínculo' : 'Ligar documento à peça', `<form id="attachmentLinkForm" class="attachment-link-form" data-case="${e(item.id)}" data-link="${e(old?.id || '')}"><p>${item.fullDocument ? 'O vínculo guarda o trecho selecionado para conferência. Para levar a referência ao documento, use Inserir referências na peça, no painel Fontes, ou escreva a citação diretamente no editor.' : 'A referência será incluída após o texto e na relação de documentos da peça. O vínculo guarda o trecho selecionado para conferência.'}</p><label for="linkFile">Documento</label><select id="linkFile" required>${options.map(f => `<option value="${e(f.id)}" ${f.id === fid ? 'selected' : ''}>${e(A.label(f) + ' · ' + f.name)}</option>`).join('')}</select><label for="linkSection">Local do vínculo</label><select id="linkSection">${sections.map(s => `<option value="${e(s.id)}" ${s.id === sid ? 'selected' : ''}>${e(s.title)}</option>`).join('')}</select><label for="linkQuote">Trecho da peça <span>opcional</span></label><textarea id="linkQuote" rows="3" maxlength="20000" placeholder="Cole um trecho exato, ou deixe vazio para vincular ao texto inteiro.">${e(quote)}</textarea><small>Se o trecho mudar, o vínculo precisará ser conferido novamente. Sem trecho selecionado, a referência vale para todo o texto.</small><label for="linkLocation">Página, cláusula ou localização <span>opcional</span></label><input id="linkLocation" maxlength="150" placeholder="Ex.: p. 2, cláusula 5" value="${e(old?.location || '')}"><label for="linkNote">O que este documento ajuda a demonstrar? <span>nota interna</span></label><textarea id="linkNote" rows="2" maxlength="2000" placeholder="Registre a finalidade da prova. Esta nota não será exportada.">${e(old?.note || '')}</textarea><p class="attachment-form-error" id="linkError" role="alert"></p><div class="dialog-actions"><button class="button primary" type="submit">Salvar vínculo →</button></div></form>`);
  }
  function closePreview() { previewToken++; if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; } if (pdfSession) { pdfSession.task.destroy().catch(() => {}); pdfSession = null; } }
  async function pdfPage(session, number) {
    if (session.busy || number < 1 || number > session.doc.numPages || session.token !== previewToken) return;
    session.busy = true; session.page = number;
    const host = $('.attachment-pdf'); if (!host) return;
    host.innerHTML = `<div class="attachment-pdf-controls">${button('← Anterior', 'pdfPage', 'data-page="' + (number - 1) + '" disabled', 'secondary')}<span>Página ${number} de ${session.doc.numPages}</span>${button('Próxima →', 'pdfPage', 'data-page="' + (number + 1) + '" disabled', 'secondary')}</div><p class="pdf-render-status" role="status">Renderizando página…</p><canvas role="img" aria-label="Página ${number} do documento PDF"></canvas><details class="pdf-page-text"><summary>Texto da página</summary><pre></pre></details>`;
    try {
      const page = await session.doc.getPage(number); if (session.token !== previewToken) return;
      const base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: Math.min(1.5, 1200 / base.width, 2000 / base.height) });
      const canvas = host.querySelector('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport, isEditing: false }).promise;
      if (session.token !== previewToken) return;
      const text = await page.getTextContent(); if (session.token !== previewToken) return;
      host.querySelector('pre').textContent = text.items.map(s => s.str + (s.hasEOL ? '\n' : ' ')).join('').slice(0, 50000) || 'Esta página não contém texto extraível. Consulte a imagem; não há OCR neste protótipo.';
      host.querySelector('.pdf-render-status').textContent = '';
      for (const control of host.querySelectorAll('[data-page]')) control.disabled = Number(control.dataset.page) < 1 || Number(control.dataset.page) > session.doc.numPages;
    } catch { if (session.token === previewToken) host.querySelector('.pdf-render-status').textContent = 'Não foi possível renderizar esta página. Baixe o arquivo para consultá-lo.'; }
    finally { session.busy = false; }
  }
  async function previewPdf(blob, token) {
    try {
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs'); if (token !== previewToken) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.mjs', location.href).href;
      const data = new Uint8Array(await blob.arrayBuffer()); if (token !== previewToken) return;
      const resource = folder => new URL('vendor/pdfjs/' + folder + '/', location.href).href;
      const task = pdfjs.getDocument({ data, isEvalSupported: false, standardFontDataUrl: resource('standard_fonts'), cMapUrl: resource('cmaps'), cMapPacked: true, wasmUrl: resource('wasm') });
      pdfSession = { task, token, page: 1, busy: false }; const session = pdfSession;
      session.doc = await task.promise; if (token !== previewToken) return;
      await pdfPage(session, 1);
    } catch (error) { if (token === previewToken && $('.attachment-pdf')) $('.attachment-pdf').textContent = error.name === 'PasswordException' ? 'PDF protegido por senha. Baixe o arquivo e abra no seu leitor de PDF.' : 'Não foi possível abrir a prévia deste PDF. Use “Baixar arquivo” para consultá-lo.'; }
  }
  async function view(item, file) {
    if (!file) return;
    ctx.dialog(file.name, `<div class="attachment-preview"><p role="status">Abrindo arquivo local…</p></div>`, true);
    const token = previewToken;
    try {
      const record = await S.get(file.id); if (token !== previewToken || !$('#workspaceDialog').open) return;
      if (!record?.blob) { file.availability = 'missing'; ctx.persist(); throw new Error('Arquivo indisponível. Os dados do navegador podem ter sido removidos.'); }
      previewUrl = URL.createObjectURL(record.blob);
      const content = file.ext === 'txt' ? `<pre class="attachment-text">${e(await record.blob.text())}</pre>` : file.mime.startsWith('image/') ? `<img src="${previewUrl}" alt="${e(file.name)}">` : file.ext === 'pdf' ? '<div class="attachment-pdf" aria-label="Prévia do documento PDF"><p role="status">Preparando prévia local…</p></div>' : '<div class="attachment-no-preview"><strong>Documento Word</strong><p>Baixe o arquivo para ler no editor de sua preferência. O conteúdo não é extraído automaticamente.</p></div>';
      if (token !== previewToken || !$('#workspaceDialog').open) return;
      $('.attachment-preview').innerHTML = `<div class="attachment-preview-toolbar"><span>${A.label(file)} · ${size(file.size)}</span><a class="button primary" href="${previewUrl}" download="${e(file.name)}">Baixar arquivo ↓</a></div>${content}<p class="panel-footnote">Se a prévia não aparecer, use “Baixar arquivo”. Nenhum conteúdo foi enviado a um servidor.</p>`;
      if (file.ext === 'pdf') previewPdf(record.blob, token);
    } catch (error) { if (token === previewToken && $('.attachment-preview')) $('.attachment-preview').textContent = error.message; }
  }
  async function audit() {
    const all = ctx.cases().flatMap(A.files); if (!all.length) return;
    for (const file of all) file.availability = 'checking';
    try { const keys = new Set(await S.keys()); for (const file of all) file.availability = keys.has(file.id) ? 'ready' : 'missing'; }
    catch (error) { for (const file of all) file.availability = 'missing'; ctx.notify(error.message); }
    ctx.persist(); ctx.render();
  }
  function init(callbacks) {
    ctx = callbacks;
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = Object.keys(A.formats).map(ext => '.' + ext).join(','); input.hidden = true; input.id = 'caseFileInput'; input.setAttribute('aria-label', 'Arquivos para adicionar ao caso'); document.body.append(input);
    input.addEventListener('change', () => { const item = pickerCase, writing=pickerWriting; pickerCase = null; pickerWriting=false; const files = [...input.files]; input.value = ''; if (item) upload(item, files,writing); });
    $('#workspaceDialog').addEventListener('close', () => { if (!$('#workspaceDialog').open) closePreview(); });
    document.addEventListener('click', ev => {
      const target = ev.target.closest('[data-attachment-action]'); if (!target) return;
      const action = target.dataset.attachmentAction, item = ctx.current(), file = A.files(item).find(f => f.id === target.dataset.file);
      if (action === 'pdfPage' && pdfSession?.doc) return pdfPage(pdfSession, Number(target.dataset.page));
      if (action === 'view') return view(item, file);
      if (action === 'jump') return ctx.jump(target.dataset.section);
      if (busy) { ctx.notify('Aguarde o salvamento dos arquivos.'); return; }
      if (!canManage(item, ctx.userId())) { ctx.notify('Documentos em leitura nesta visão.'); return; }
      if (action === 'upload'||action==='uploadDraft') { pickerCase = item; pickerWriting=action==='uploadDraft'; input.accept=pickerWriting?W.accept:Object.keys(A.formats).map(ext=>'.'+ext).join(','); input.click(); return; }
      if (action === 'link') return linkDialog(item, target.dataset);
      try {
        if (action === 'archive' && file) mutate(item, () => { file.archived = true; }, `${A.label(file)} retirado do caso; vínculos mantidos para conferência.`);
        if (action === 'restore' && file) mutate(item, () => { if (A.active(item).some(f => f.sha256 === file.sha256)) throw new Error('Já existe um arquivo ativo com este conteúdo.'); file.archived = false; }, `${A.label(file)} restaurado ao caso.`);
        if (action === 'unlink') mutate(item, () => { item.documentLinks = A.links(item).filter(l => l.id !== target.dataset.link); }, 'Vínculo de documento removido da peça.');
        ctx.render(); ctx.notify(action === 'archive' ? 'Documento retirado. Você pode restaurá-lo na lista de retirados.' : 'Alteração salva. Confira novamente os requisitos da peça.');
      } catch (error) { ctx.notify(error.message); }
    });
    document.addEventListener('submit', ev => {
      if (ev.target.id !== 'attachmentLinkForm') return; ev.preventDefault();
      const item = ctx.cases().find(c => c.id === ev.target.dataset.case);
      try {
        if (!item || busy) throw new Error('Aguarde o salvamento dos arquivos.');
        const quote = $('#linkQuote').value.trim(), sectionId = $('#linkSection').value, text = item.sections.find(s => s.id === sectionId)?.text || '', at = text.indexOf(quote);
        let quoteContext = linkAnchor?.caseId === item.id && linkAnchor.sectionId === sectionId && linkAnchor.quote === quote ? linkAnchor.context : undefined;
        // Saving the form explicitly reconfirms a unique occurrence. Repeated text requires a selection.
        if (!quoteContext && quote && at >= 0 && text.lastIndexOf(quote) === at) quoteContext = { before: text.slice(Math.max(0, at - 80), at), after: text.slice(at + quote.length, at + quote.length + 80) };
        mutate(item, () => A.addLink(item, { id: ev.target.dataset.link || uid(), attachmentId: $('#linkFile').value, sectionId: $('#linkSection').value, quote: $('#linkQuote').value, quoteContext, location: $('#linkLocation').value, note: $('#linkNote').value, userId: ctx.userId(), at: new Date().toISOString() }), 'Vínculo entre documento e peça registrado.');
        $('#workspaceDialog').close(); ctx.render(); ctx.notify(item.fullDocument ? 'Vínculo salvo. Insira a referência no texto pelo painel Fontes.' : 'Vínculo salvo. A referência aparecerá na prévia e na exportação.');
      } catch (error) { $('#linkError').textContent = error.message; }
    });
    document.addEventListener('dragover', ev => { if ([...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); ev.dataTransfer.dropEffect = ev.target.closest('[data-drop-case]') && !busy ? 'copy' : 'none'; } });
    document.addEventListener('drop', ev => { if (!ev.dataTransfer.files.length) return; ev.preventDefault(); const zone = ev.target.closest('[data-drop-case]'), item = zone && ctx.cases().find(c => c.id === zone.dataset.dropCase); if (item) upload(item, [...ev.dataTransfer.files]); });
  }
  window.EloAttachmentUI = { library, writingFiles, section, refreshLinks, init, audit, closePreview, isBusy: () => busy };
})();
