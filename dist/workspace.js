(async () => {
  'use strict';
  const authenticatedUser = await window.EloAuth.requireUser(); if (!authenticatedUser) return;
  const accountKey = window.EloAuth.storageKey('elojus-workspace-v14');
  const personKey = window.EloAuth.storageKey('elojus-person-v2');
  document.documentElement.removeAttribute('data-session-required');
  window.addEventListener('elo-auth-change', event => {
    if (event.detail.event === 'SIGNED_OUT' || (event.detail.userId && event.detail.userId !== authenticatedUser.id)) location.replace('login.html');
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    try { const currentUser = await window.EloAuth.user(); if (currentUser.id !== authenticatedUser.id) location.replace('login.html'); }
    catch { location.replace('login.html?reason=session'); }
  });
  const C = window.EloContinuous, A = window.EloAttachments, AU = window.EloAttachmentUI, G = window.EloGuided, GU = window.EloGuidedUI, M = window.EloModel, R = window.EloRich, E = window.EloEditor, e = M.escape, $ = selector => document.querySelector(selector);
  let state, storageIssue = false, workspaceOfficeName = 'EloJus';
  try {
    const stored = JSON.parse(localStorage.getItem(accountKey));
    state = M.validState(stored) ? stored : M.createSeed();
  } catch { state = M.createSeed(); }
  G.upgrade(state); C.upgrade(state);
  const ui = { step: 'document', page: 'home', caseId: 'ELO-002', tab: 'draft', panel: 'comments', filter: 'all', search: '', userId: 'marina', preview: false, commentDrafts: {}, selection: null, source: null };
  try { const user = localStorage.getItem(personKey); if (M.USERS[user]) ui.userId = user; } catch {}
  let saveTimer, toastTimer;
  const icons = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    folder: '<path d="M3 7V5a1 1 0 0 1 1-1h6l2 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
    review: '<path d="m8 12 3 3 6-6"/><rect x="4" y="3" width="16" height="18" rx="2"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', document: '<path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8M8 16h6"/>',
    comment: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.document}</svg>`;
  const current = () => state.cases.find(c => c.id === ui.caseId) || state.cases[0];
  const user = () => M.USERS[ui.userId];
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : 'Não definida';
  const time = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  function dueText(item) { if (item.status === 'approved') return 'Concluído'; const today = M.dateKey(Date.now()); return item.due === today ? 'Hoje' : item.due < today ? 'Entrega vencida' : date(item.due); }
  const badge = item => `<span class="status status-${e(item.status)}"><span aria-hidden="true">${item.status === 'approved' ? '✓' : item.status === 'changes' ? '↺' : item.status === 'review' ? '◐' : '○'}</span>${e(M.STATUS[item.status])}</span>`;
  const btn = (label, action, cls = '', extra = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${label}</button>`;
  function notify(text) { $('#notice').textContent = text; $('#notice').classList.add('shown'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#notice').classList.remove('shown'), 5000); }
  function savedLabel(text) { const el = $('#saveStatus'); if (el) el.textContent = text; }
  function persist() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(accountKey, JSON.stringify(state)); storageIssue = false; savedLabel('Salvo neste navegador'); return true; }
    catch { storageIssue = true; savedLabel('Não salvo · armazenamento indisponível'); notify('O navegador não conseguiu salvar. Exporte o texto antes de sair.'); return false; }
  }
  function scheduleSave() { savedLabel('Salvando…'); clearTimeout(saveTimer); saveTimer = setTimeout(persist, 600); }
  function refreshConference() {
    const item = current(); if (!item.guided || !$('.guided-conference')) return;
    const req = G.requirements(item), done = req.filter(r => r.done).length;
    $('.conference-count strong').innerHTML = `${done}<span>/${req.length}</span>`;
    const progress = $('.conference-progress'); progress.setAttribute('aria-valuenow', done); progress.firstElementChild.style.width = `${100 * done / req.length}%`;
    const count = $('.guided-steps small'); if (count) count.textContent = `${done}/${req.length}`;
    for (const [i, r] of req.entries()) {
      const select = document.getElementById('requirement-' + r.id), row = select?.closest('.requirement'); if (!row) continue;
      row.classList.toggle('done', r.done); row.querySelector('.requirement-number').textContent = r.done ? '✓' : String(i + 1).padStart(2, '0');
      if (!r.fresh) select.value = 'pending';
    }
    const ack = $('#guidedAttestation'); ack.checked = item.guided.attestation?.key === G.reviewKey(item) && item.guided.attestation?.userId === 'marina';
    ack.disabled = !(M.canEdit(item, ui.userId) && ui.userId === 'marina' && done === req.length);
    $('.final-attestation p').textContent = done < req.length ? 'Conclua os itens acima para habilitar a conferência final de Marina.' : ui.userId !== 'marina' ? 'Marina registra a conferência final na visão de advogada.' : 'A aprovação interna continua separada da assinatura e do protocolo.';
  }
  function commentSections(item) { return [...new Map([...G.document(item).sections, ...item.sections].map(s => [s.id, s])).values()]; }
  function draftForm(item) { return ui.commentDrafts[item.id] ||= { text: '', sectionId: item.sections[0].id, quote: '', blocking: true }; }
  function readRoute() {
    const parts = location.hash.slice(1).split('/');
    if (parts[0] === 'caso' && state.cases.some(c => c.id === parts[1])) { ui.page = 'case'; ui.caseId = parts[1]; ui.tab = ['context', 'history'].includes(parts[2]) ? parts[2] : 'draft'; }
    else { ui.page = parts[0] === 'casos' ? 'cases' : parts[0] === 'revisoes' ? 'reviews' : 'home'; ui.filter = ui.page === 'reviews' ? 'review' : 'all'; }
  }
  function route() { return ui.page === 'case' ? '#caso/' + ui.caseId + (ui.tab === 'draft' ? '' : '/' + ui.tab) : ui.page === 'cases' ? '#casos' : ui.page === 'reviews' ? '#revisoes' : '#inicio'; }
  function navigate(page, id, tab = 'draft') { persist(); ui.page = page; if (id) ui.caseId = id; ui.tab = tab; ui.step = current().fullDocument ? 'document' : 'data'; ui.search = ''; ui.filter = page === 'reviews' ? 'review' : 'all'; ui.preview = false; ui.selection = null; ui.panel = current().status === 'intake' ? 'brief' : 'comments'; history.pushState(null, '', route()); render(); window.scrollTo(0, 0); $('#mainContent').focus({ preventScroll: true }); }
  function sorted(items) { const order = { review: 0, changes: 1, working: 2, intake: 3, approved: 4 }; return [...items].sort((a, b) => order[a.status] - order[b.status] || a.due.localeCompare(b.due)); }
  function baseCases() { return ui.page === 'home' && !user().reviewer ? state.cases.filter(c => c.ownerId === ui.userId) : state.cases; }
  function filtered() { const q = ui.search.toLocaleLowerCase('pt-BR'); return sorted(baseCases().filter(c => (ui.filter === 'all' || c.status === ui.filter) && `${c.title} ${c.id} ${c.client} ${M.USERS[c.ownerId].name}`.toLocaleLowerCase('pt-BR').includes(q))); }
  function actionLabel(item) { return ({ intake: 'Distribuir', working: 'Continuar', review: 'Revisar', changes: 'Ver ajustes', approved: 'Abrir' })[item.status]; }
  function caseRows() {
    const list = filtered();
    return list.length ? `<div class="case-table"><div class="case-table-head" aria-hidden="true"><span>CASO / ENTREGA</span><span>RESPONSÁVEL</span><span>ENTREGA INTERNA</span><span>ETAPA</span><span></span></div>${list.map(item => `<article class="case-row"><div class="case-cell"><span class="case-meta">${e(item.id)} <span>·</span> ${e(item.area)}</span><button class="case-title" data-action="openCase" data-id="${e(item.id)}">${e(item.title)}</button><span class="case-client">${e(item.client)}</span></div><div class="owner-cell"><span class="avatar small">${item.status === 'intake' ? '–' : M.USERS[item.ownerId].initials}</span><span>${item.status === 'intake' ? 'A definir' : M.USERS[item.ownerId].name}</span></div><div class="due-cell ${item.status !== 'approved' && item.due <= M.dateKey(Date.now()) ? 'due-soon' : ''}">${icon('clock')}<span>${e(dueText(item))}</span></div><div>${badge(item)}</div>${btn(actionLabel(item) + icon('arrow'), 'openCase', 'row-action', `data-id="${e(item.id)}" aria-label="${actionLabel(item)}: ${e(item.title)}"`)}</article>`).join('')}</div>` : `<div class="empty-state">${icon('search')}<h3>Nenhum caso nesta seleção.</h3><p>Tente outro termo ou escolha uma etapa diferente.</p>${btn('Limpar filtros', 'clearFilters', 'secondary')}</div>`;
  }
  function listSection() {
    return `<section class="work-list"><div class="list-heading"><div><h2>${ui.page === 'home' ? 'O que precisa avançar' : ui.page === 'reviews' ? 'Fila de revisão' : 'Todos os casos'}</h2><p id="resultCount">${filtered().length} ${filtered().length === 1 ? 'caso' : 'casos'} na seleção</p></div><label class="search-box">${icon('search')}<span class="sr-only">Buscar casos ou pessoas</span><input id="caseSearch" type="search" placeholder="Buscar casos ou pessoas" value="${e(ui.search)}" autocomplete="off"></label></div><div class="filters" aria-label="Filtrar por etapa">${[['all', 'Todos'], ['review', 'Para revisar'], ['changes', 'Ajustes'], ['working', 'Elaboração'], ['intake', 'A distribuir'], ['approved', 'Concluídos']].map(([value, label]) => `<button data-action="filter" data-filter="${value}" class="filter ${ui.filter === value ? 'selected' : ''}" aria-pressed="${ui.filter === value}">${label}${value === 'all' ? '' : `<span>${baseCases().filter(c => c.status === value).length}</span>`}</button>`).join('')}</div><div id="caseResults">${caseRows()}</div></section>`;
  }
  function home() {
    const items = baseCases(), reviewCount = items.filter(c => c.status === 'review').length;
    const next = sorted(items).find(c => user().reviewer ? c.status === 'review' : ['changes', 'working'].includes(c.status));
    const events = items.flatMap(c => c.events.map(ev => ({ ...ev, caseId: c.id, title: c.title }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4);
    return `<div class="page-heading"><div><div class="eyebrow">${e(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))} · AMBIENTE DE DEMONSTRAÇÃO</div><h1>Sua mesa de trabalho.</h1><p>${user().reviewer ? `${reviewCount === 1 ? '1 minuta aguarda' : reviewCount + ' minutas aguardam'} sua revisão. Dê continuidade ao trabalho da equipe.` : `${items.filter(c => ['working', 'changes'].includes(c.status)).length} entregas para você continuar. Orientações e devolutivas no mesmo lugar.`}</p></div>${next ? btn((user().reviewer ? 'Abrir próxima revisão' : 'Continuar minha entrega') + icon('arrow'), 'openCase', 'primary', `data-id="${next.id}"`) : btn('Ver todos os casos' + icon('arrow'), 'cases', 'primary')}</div>
    <div class="metrics">${[['review', 'Para revisar', 'Minutas aguardando conferência'], ['changes', 'Ajustes solicitados', 'Devolutivas para a equipe'], ['working', 'Em elaboração', 'Entregas em andamento'], ['intake', 'A distribuir', 'Casos que precisam de responsável']].map(([key, label, text], i) => `<button class="metric ${i === 0 ? 'metric-featured' : ''}" data-action="filter" data-filter="${key}" aria-label="Filtrar ${label.toLowerCase()}"><span>${label}${icon(i === 0 ? 'review' : i === 1 ? 'comment' : i === 2 ? 'document' : 'folder')}</span><strong>${String(items.filter(c => c.status === key).length).padStart(2, '0')}</strong><small>${text}</small></button>`).join('')}</div>
    ${listSection()}
    <div class="home-bottom"><section><div class="section-heading"><h2>O trabalho em movimento</h2><span>ATIVIDADE DA EQUIPE</span></div><div class="activity-list">${events.map(ev => `<button class="activity" data-action="openCase" data-id="${ev.caseId}"><span class="avatar small">${M.USERS[ev.userId]?.initials || 'EA'}</span><span><strong>${e(ev.text)}</strong><small>${e(ev.caseId)} · ${e(ev.title)}</small></span><time>${e(ev.legacyAt || time(ev.at))}</time>${icon('arrow')}</button>`).join('')}</div></section><aside class="focus-card"><span class="eyebrow">UM CONTEXTO COMPARTILHADO</span><h2>Da orientação<br>à última revisão.</h2><p>Abra um caso para encontrar a minuta, os documentos de exemplo e os comentários da equipe.</p><div class="team-people"><span class="avatar">MA</span><span class="avatar">LU</span><span class="avatar">CL</span><span>3 pessoas fictícias<br>Um só fluxo de trabalho</span></div></aside></div>`;
  }
  function caseHeading(item) {
    const isReview = ui.userId === 'marina' && item.status === 'review';
    return `<div class="case-top"><div><button class="back-link" data-action="cases">${icon('back')} Todos os casos</button><div class="eyebrow">${e(item.id)} / ${e(item.area)} · ${e(item.client)}</div><h1>${e(item.title)}</h1><div class="matter-meta"><span>${icon('document')}${e(G.document(item).documentTitle)}</span><span>${icon('clock')}Entrega interna: ${e(date(item.due))}</span><span class="owner-inline"><span class="avatar tiny">${M.USERS[item.ownerId].initials}</span>${M.USERS[item.ownerId].name} · elaboração</span></div></div><div class="case-heading-actions">${badge(item)}${isReview ? `<div class="action-group">${btn('Solicitar ajustes', 'return', 'secondary')}${btn('Aprovar minuta' + icon('check'), 'approve', 'primary')}</div>` : item.status === 'intake' ? btn('Definir responsável' + icon('arrow'), 'context', 'primary') : M.canEdit(item, ui.userId) ? btn('Enviar para revisão' + icon('arrow'), 'submit', 'primary') : ''}</div></div><div class="case-tabs" aria-label="Áreas do caso">${[['draft', 'Elaboração e revisão'], ['context', 'Contexto e documentos'], ['history', 'Histórico']].map(([tab, label]) => `<button data-action="caseTab" data-tab="${tab}" class="${ui.tab === tab ? 'active' : ''}" aria-pressed="${ui.tab === tab}">${label}${tab === 'history' ? `<span>${item.versions.length}</span>` : ''}</button>`).join('')}</div>`;
  }
  function editor(item) {
    const editable = M.canEdit(item, ui.userId) && !ui.preview;
    const continuous = item.editorMode === 'continuous';
    const visibleSections = editable ? G.finalSections(item) : G.document(item).sections;
    const mayComment = item.status !== 'approved' && (ui.userId === 'marina' || item.ownerId === ui.userId);
    const unresolved = item.comments.filter(c => c.status !== 'resolved').length;
    return `${item.status === 'approved' ? '<div class="state-banner">' + icon('check') + '<div><strong>Revisão interna concluída.</strong> O documento está em leitura. Nenhum arquivo foi enviado ou protocolado.</div></div>' : item.status === 'changes' ? '<div class="state-banner">' + icon('comment') + `<div><strong>${unresolved} ${unresolved === 1 ? 'comentário' : 'comentários'} para conferir.</strong> ${M.USERS[item.ownerId].name} ajusta a minuta; Marina confirma a resolução na revisão.</div></div>` : ''}
    <div class="editor-layout"><section class="editor-area" aria-label="Documento em elaboração"><div class="document-toolbar"><div class="editor-mode">${M.canEdit(item, ui.userId) ? `<button data-action="editMode" data-mode="edit" class="${!ui.preview ? 'active' : ''}" aria-pressed="${!ui.preview}">Editar</button><button data-action="editMode" data-mode="preview" class="${ui.preview ? 'active' : ''}" aria-pressed="${ui.preview}">Prévia</button>` : `<span>${icon('document')}Modo leitura</span>`}</div><div class="toolbar-actions">${btn(icon('review') + 'Comparar', 'compare', 'quiet', 'aria-label="Comparar versões"')}${btn(icon('comment'), 'focusPanel', 'icon-button panel-shortcut', 'aria-label="Ir para o painel de revisão"')}${btn(icon('download') + 'Exportar', 'export', 'secondary', 'aria-label="Exportar minuta" title="Exportar Word, PDF ou texto"')}</div></div>
    ${editable ? E.toolbar() : ''}${continuous && editable ? `<div class="writing-actions"><span>Peça completa · do endereçamento ao encerramento</span><div>${btn(icon('comment') + 'Comentar trecho', 'anchorComment', 'quiet', 'data-section="corpo"')}<button class="button quiet" data-attachment-action="link" data-section="corpo">＋ Vincular documento</button></div></div>` : ''}<div class="document-info"><span id="saveStatus" role="status">${storageIssue ? 'Não salvo · armazenamento indisponível' : 'Salvo neste navegador'}</span><span>${item.versions.length} ${item.versions.length === 1 ? 'versão' : 'versões'} · <span id="wordCount">${wordCount(item)}</span> palavras</span></div>
    <div class="paper"><div class="paper-heading"><span>ESCRITÓRIO AURORA · MATERIAL FICTÍCIO</span>${item.fullDocument ? `<p class="full-document-label">DOCUMENTO COMPLETO · ${e(item.id)}</p>` : `<h2>${e(G.document(item).documentTitle)}</h2><p>${e(item.id)} · ${e(item.client)}</p>`}</div>${visibleSections.map((section, index) => section.id === 'corpo' ? `<section class="doc-section continuous-section" id="section-corpo">${editable ? '<div class="section-editor rich-host" data-rich-section="corpo"></div>' : `<div class="rich-preview">${R.html(section)}</div>`}</section>` : `<section class="doc-section" id="section-${e(section.id)}"><div class="doc-section-heading"><h3><span>${String(index + 1).padStart(2, '0')}</span>${e(section.title)}</h3><button class="section-comment" data-action="anchorComment" data-section="${e(section.id)}" aria-label="${mayComment ? 'Comentar seção' : 'Ver comentários da seção'} ${e(section.title)}" title="${mayComment ? 'Comentar esta seção' : 'Ver revisão desta seção'}">${icon('comment')}<span>${item.comments.filter(c => c.sectionId === section.id && c.status !== 'resolved').length || '+'}</span></button></div>${editable && section.help ? `<p class="section-guidance">${e(section.help)}</p>` : ''}${editable ? `<div class="section-editor rich-host" data-rich-section="${e(section.id)}"></div>` : `<div class="rich-preview">${R.html(section)}</div>`}${editable ? AU.section(item, section, ui.userId) : ''}${section.id === 'fatos' && item.docs.some(d => d.id === 'documentos') ? `<button class="source-citation" data-action="source" data-doc="documentos" data-page="0">${icon('document')}Conferir documento de referência ${icon('arrow')}</button>` : ''}</section>`).join('')}<p class="document-disclaimer">Minuta demonstrativa. Conteúdo fictício, sujeito à revisão profissional.</p></div>
    <div class="document-bottom"><span>${editable ? 'Edição salva automaticamente neste navegador.' : 'Troque a visão simulada para acompanhar o papel de cada pessoa.'}</span>${M.canEdit(item, ui.userId) ? btn('Salvar versão', 'saveVersion', 'secondary') : ''}</div></section>
    <aside class="review-panel" aria-label="Contexto e revisão"><div class="panel-tabs" aria-label="Painel lateral">${[['comments', 'Revisão'], ['brief', 'Orientações'], ['sources', 'Fontes']].map(([key, label]) => `<button class="${ui.panel === key ? 'active' : ''}" data-action="panel" data-panel="${key}" aria-pressed="${ui.panel === key}">${label}${key === 'comments' ? `<span>${unresolved}</span>` : ''}</button>`).join('')}</div><div class="panel-content">${ui.panel === 'comments' ? comments(item) : ui.panel === 'brief' ? brief(item) : sources(item)}</div></aside></div>`;
  }
  function wordCount(item) { return G.document(item).sections.map(s => s.text).join(' ').trim().split(/\s+/).filter(Boolean).length; }
  function comments(item) {
    const form = draftForm(item), canComment = item.status !== 'approved' && (ui.userId === 'marina' || item.ownerId === ui.userId);
    return `<div class="panel-heading"><h2>Conversa sobre a minuta</h2><p>Comentários ligados ao texto da peça. ${M.pending(item).length ? M.pending(item).length + (M.pending(item).length === 1 ? ' pendência bloqueia' : ' pendências bloqueiam') + ' a aprovação.' : 'Nenhum comentário impeditivo. Confira também os requisitos da peça.'}</p></div>${item.comments.length ? item.comments.map(c => {
      const section = commentSections(item).find(s => s.id === c.sectionId);
      return `<article class="review-comment ${c.status === 'resolved' ? 'resolved' : ''}"><div class="comment-by"><span class="avatar tiny">${M.USERS[c.userId]?.initials || 'EA'}</span><strong>${M.USERS[c.userId]?.name || 'Equipe'}</strong><time>${e(c.legacyAt || time(c.at))}</time></div><button class="anchor-link" data-action="jumpSection" data-section="${e(c.sectionId)}">${icon('document')}${e(c.sourceSectionTitle ? 'Texto da peça · ' + c.sourceSectionTitle : section?.title || 'Seção preservada')}${icon('arrow')}</button>${c.quote ? `<blockquote>${e(c.quote)}</blockquote>` : ''}<p>${e(c.text)}</p><div class="comment-tags"><span class="comment-tag">${c.status === 'resolved' ? '✓ Resolvido' : c.status === 'addressed' ? 'Tratado · conferir' : c.blocking ? 'Pendência para aprovação' : 'Observação'}</span><span>${e(c.versionId)}</span></div>${c.replies.map(reply => `<div class="reply"><strong>${M.USERS[reply.userId]?.name || 'Equipe'}</strong><p>${e(reply.text)}</p></div>`).join('')}${canComment ? `<div class="comment-actions">${ui.userId === 'marina' ? btn(c.status === 'resolved' ? 'Reabrir' : 'Resolver', c.status === 'resolved' ? 'reopen' : 'resolve', 'text-button', `data-comment="${e(c.id)}"`) : c.status === 'open' && ['working', 'changes'].includes(item.status) ? btn('Marcar como tratado', 'address', 'text-button', `data-comment="${e(c.id)}"`) : ''}${btn('Responder', 'replyForm', 'text-button', `data-comment="${e(c.id)}"`)}</div>` : ''}</article>`;
    }).join('') : `<div class="panel-empty">${icon('comment')}<h3>Uma revisão com contexto.</h3><p>Selecione um trecho no editor e clique em “Comentar trecho” para começar a conversa.</p></div>`}
    ${canComment ? `<form id="commentForm" class="comment-form"><h3>Adicionar comentário</h3><label for="commentSection">Local do comentário</label><select id="commentSection">${commentSections(item).map(s => `<option value="${e(s.id)}" ${s.id === form.sectionId ? 'selected' : ''}>${e(s.title)}</option>`).join('')}</select>${form.quote ? `<div class="selected-quote"><span>TRECHO SELECIONADO</span><blockquote>${e(form.quote)}</blockquote>${btn('Remover citação', 'clearQuote', 'text-button')}</div>` : ''}<label class="sr-only" for="commentText">Seu comentário</label><textarea id="commentText" rows="3" maxlength="2000" placeholder="O que precisa ser conferido ou ajustado?">${e(form.text)}</textarea>${ui.userId === 'marina' ? `<label class="check-line"><input id="blockingComment" type="checkbox" ${form.blocking ? 'checked' : ''}><span>Pendência que bloqueia a aprovação</span></label>` : ''}<button class="button primary" type="submit">Adicionar comentário ${icon('arrow')}</button></form>` : '<p class="panel-footnote">Comentários em leitura para a visão selecionada.</p>'}`;
  }
  function brief(item) {
    const editable = M.canEdit(item, ui.userId);
    return `<div class="panel-heading"><h2>Uma entrega bem definida</h2><p>Responsável: ${M.USERS[item.ownerId].name}<br>Revisora: Marina · advogada</p></div><div class="brief-block"><span class="eyebrow">ORIENTAÇÕES</span><p>${e(item.instructions)}</p></div><div class="brief-date">${icon('clock')}<div><strong>${e(dueText(item))}</strong><span>Entrega interna · ${e(date(item.due))}</span></div></div>${GU.notes(item, ui.userId)}${GU.guidance(item)}${item.guided ? `<div class="checklist"><h3>Conferência da peça</h3><p>${G.requirements(item).filter(r => r.done).length} de ${G.requirements(item).length} itens conferidos.</p><button class="button secondary" data-action="guidedStep" data-step="check">Abrir conferência →</button></div>` : `<div class="checklist"><h3>Antes de enviar</h3>${['Conferi o relato e os documentos de exemplo', 'Sinalizei as informações pendentes', 'Revisei a estrutura e as orientações'].map((label, i) => `<label class="check-line"><input type="checkbox" data-check="${i}" ${item.checks[i] ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${label}</span></label>`).join('')}<p>Conferência manual. As marcações não substituem a revisão e não impedem o envio.</p></div>`}`;
  }
  function sources(item) { return `${AU.library(item, ui.userId)}${item.fullDocument && A.links(item).length ? `<div class="reference-insertion"><p>As referências são texto editável. Insira as que faltam ao final da peça e ajuste sua posição livremente.</p>${M.canEdit(item, ui.userId) && !ui.preview ? btn('Inserir referências na peça', 'insertReferences', 'secondary') : ''}</div>` : ''}${item.editorMode === 'continuous' ? AU.section(item, item.sections.find(s => s.id === 'corpo'), ui.userId) : ''}${item.docs.length ? '<h3 class="legacy-source-heading">Materiais ilustrativos do exemplo</h3>' : ''}${item.docs.map(doc => `<button class="source-card" data-action="source" data-doc="${e(doc.id)}" data-page="0">${icon('document')}<span><strong>${e(doc.title)}</strong><small>${e(doc.subtitle)}</small></span>${icon('arrow')}</button>`).join('')}${item.docs.length ? '<p class="panel-footnote">Os cartões acima são prévias ilustrativas. Envie arquivos na área de documentos para vinculá-los à peça.</p>' : ''}`; }
  function context(item) {
    return `<div class="context-layout"><section><div class="content-card"><span class="eyebrow">PONTO DE PARTIDA</span><h2>Resumo do atendimento</h2><p class="narrative">${e(item.narrative)}</p></div><div class="content-card">${sources(item)}</div></section><section class="content-card"><span class="eyebrow">PESSOAS E ENTREGA</span><h2>Orientações para o trabalho</h2><form id="assignmentForm"><label for="ownerSelect">Responsável pela elaboração</label><select id="ownerSelect" ${ui.userId !== 'marina' || item.status === 'approved' ? 'disabled' : ''}>${['lucas', 'clara'].map(id => `<option value="${id}" ${item.ownerId === id ? 'selected' : ''}>${M.USERS[id].name} · ${M.USERS[id].role.toLowerCase()}</option>`).join('')}</select><label for="internalDue">Entrega interna combinada</label><input id="internalDue" type="date" value="${e(item.due)}" ${ui.userId !== 'marina' || item.status === 'approved' ? 'readonly' : ''}><small>Data de organização da equipe, não prazo judicial.</small><label for="instructionsText">O que precisa ser feito</label><textarea id="instructionsText" rows="6" ${ui.userId !== 'marina' || item.status === 'approved' ? 'readonly' : ''}>${e(item.instructions)}</textarea>${ui.userId === 'marina' && item.status !== 'approved' ? `<button class="button primary" type="submit">${item.status === 'intake' ? 'Distribuir tarefa' : 'Salvar orientações'} ${icon('arrow')}</button>` : ''}</form></section></div>`;
  }
  function historyPage(item) {
    return `<div class="context-layout"><section class="content-card"><div class="section-heading"><h2>Versões da minuta</h2>${btn('Comparar versões', 'compare', 'secondary')}</div>${item.versions.length ? [...item.versions].reverse().map(v => `<div class="version-row"><span class="version-symbol">${e(v.id.toUpperCase())}</span><div><strong>${e(v.label)}</strong><small>${e(M.USERS[v.userId]?.name || 'Equipe')} · ${e(v.legacyAt || time(v.at))}</small></div>${btn('Ler versão', 'readVersion', 'quiet', `data-version="${e(v.id)}"`)}</div>`).join('') : '<p class="empty-copy">A primeira versão será registrada ao salvar uma versão ou enviar para revisão.</p>'}<p class="panel-footnote">O salvamento automático mantém o texto atual. As versões registram marcos do trabalho.</p></section><section class="content-card"><h2>Histórico do caso</h2><ol class="event-list">${item.events.map(ev => `<li><span class="event-dot"></span><p>${e(ev.text)}</p><small>${e(ev.legacyAt || time(ev.at))} · ${e(M.USERS[ev.userId]?.name || 'Equipe')}</small></li>`).join('')}</ol><p class="panel-footnote">Histórico local de demonstração, sem autenticação ou trilha de auditoria de produção.</p></section></div>`;
  }
  function render() {
    window.EloPages.unmount();
    E.unmount();
    const item = current(); if (item.fullDocument && ui.step === 'data') ui.step = 'document';
    const reviewer = user().reviewer, counts = state.cases.filter(c => c.status === 'review').length;
    $('#sidebarNav').innerHTML = [['home', 'home', 'Início'], ['cases', 'folder', 'Casos'], ['reviews', 'review', 'Revisões']].map(([page, glyph, label]) => `<button data-action="${page}" class="side-nav ${ui.page === page ? 'active' : ''}" ${ui.page === page ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${page === 'reviews' ? `<span class="nav-count">${counts}</span>` : ''}</button>`).join('');
    $('#recentCases').innerHTML = sorted(state.cases).slice(0, 3).map(c => `<button class="recent-case ${ui.page === 'case' && c.id === item.id ? 'current' : ''}" data-action="openCase" data-id="${c.id}"><span>${c.id}</span>${e(c.title)}</button>`).join('');
    $('#breadcrumb').innerHTML = ui.page === 'case' ? `Casos <span>/</span> <strong>${e(item.id)}</strong>` : `${e(workspaceOfficeName)} <span>/</span> <strong>${ui.page === 'home' ? 'Início' : ui.page === 'cases' ? 'Casos' : 'Revisões'}</strong>`;
    $('#role').value = ui.userId; $('#userAvatar').textContent = user().initials;
    $('#mainContent').className = ui.page === 'case' ? 'main-content case-content' : 'main-content';
    $('#mainContent').innerHTML = ui.page === 'home' ? home() : ui.page === 'case' ? caseHeading(item) + (ui.tab === 'context' ? context(item) : ui.tab === 'history' ? historyPage(item) : GU.bar(item, ui.step) + (item.guided && ui.step === 'data' ? GU.data(item, ui.userId) : item.guided && ui.step === 'check' ? GU.check(item, ui.userId) : editor(item))) : `<div class="page-heading"><div><div class="eyebrow">CASOS DE DEMONSTRAÇÃO</div><h1>${ui.page === 'reviews' ? 'Cada revisão faz avançar.' : 'Casos, com contexto.'}</h1><p>${ui.page === 'reviews' ? 'Confira o documento, resolva as pendências e devolva uma direção clara.' : 'Acompanhe responsáveis, entregas internas e a próxima ação de cada caso fictício.'}</p></div><span class="counter-label">${state.cases.length} CASOS FICTÍCIOS</span></div>${listSection()}`;
    if (ui.page === 'case' && ui.tab === 'draft' && (!item.guided || ui.step === 'document') && !ui.preview && M.canEdit(item, ui.userId)) E.mount(item, () => { item.updatedAt = new Date().toISOString(); $('#wordCount').textContent = wordCount(item); AU.refreshLinks(item); scheduleSave(); });
    window.EloPages.mount();
    document.title = ui.page === 'case' ? `${item.id} · ${item.title} — EloJus` : 'EloJus — sua mesa de trabalho';
  }
  function showDialog(title, html, large = false) { AU.closePreview(); const d = $('#workspaceDialog'); if (d.open) d.close(); d.className = large ? 'dialog-large' : ''; d.innerHTML = `<div class="dialog-heading"><h2>${e(title)}</h2>${btn(icon('close'), 'closeDialog', 'icon-button', 'aria-label="Fechar janela"')}</div>${html}`; d.showModal(); }
  function sourceDialog(docId, page = 0) {
    const doc = current().docs.find(d => d.id === docId); if (!doc) return;
    page = Math.max(0, Math.min(page, doc.pages.length - 1)); ui.source = { docId, page };
    showDialog(doc.title, `<div class="source-viewer"><div class="source-viewer-meta"><span>PRÉVIA ILUSTRATIVA · CONTEÚDO FICTÍCIO</span><span>Página ${page + 1} de ${doc.pages.length}</span></div><div class="source-paper">${e(doc.pages[page])}</div><div class="source-pager">${btn('← Anterior', 'sourcePage', 'secondary', `data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}`)}${btn('Próxima →', 'sourcePage', 'secondary', `data-page="${page + 1}" ${page === doc.pages.length - 1 ? 'disabled' : ''}`)}</div></div>`, true);
  }
  function compareDialog() {
    const item = current();
    if (!item.versions.length) { notify('Salve uma versão para poder comparar as alterações.'); return; }
    const all = [...item.versions, { id: 'atual', label: 'Texto atual', sections: G.document(item).sections }];
    const options = selected => all.map(v => `<option value="${e(v.id)}" ${v.id === selected ? 'selected' : ''}>${v.id === 'atual' ? 'Texto atual' : `${v.id.toUpperCase()} · ${e(v.label)}`}</option>`).join('');
    const hasEdits = G.document(item).sections.length !== item.versions.at(-1).sections.length || G.document(item).sections.some(s => !R.equal(s, item.versions.at(-1).sections.find(old => old.id === s.id)));
    const previous = hasEdits ? item.versions.at(-1).id : item.versions.length > 1 ? item.versions.at(-2).id : item.versions[0].id;
    const latest = hasEdits || item.versions.length === 1 ? 'atual' : item.versions.at(-1).id;
    showDialog('O que mudou na minuta', `<div class="compare-controls"><label>Comparar de<select id="compareFrom">${options(previous)}</select></label><span>→</span><label>Para<select id="compareTo">${options(latest)}</select></label></div><div class="diff-legend"><span><del>Removido</del> · texto riscado</span><span><ins>Adicionado</ins> · texto sublinhado</span></div><div id="diffContent"></div>`, true);
    renderDiff();
  }
  function renderDiff() {
    const item = current(), all = [...item.versions, { id: 'atual', sections: G.document(item).sections }], a = all.find(v => v.id === $('#compareFrom').value), b = all.find(v => v.id === $('#compareTo').value);
    const ids = [...new Set([...a.sections, ...b.sections].map(s => s.id))]; let changed = 0;
    const html = ids.map(id => { const before = a.sections.find(s => s.id === id), after = b.sections.find(s => s.id === id); const differs = !R.equal(before, after), onlyFormat = differs && R.text(before) === R.text(after); if (differs) changed++; return `<section class="diff-section"><h3>${e(after?.title || before.title)}<span>${onlyFormat ? 'Formatação alterada' : differs ? 'Com alterações' : 'Sem alterações'}</span></h3><div>${M.diffWords(R.text(before), R.text(after))}</div>${differs ? `<details class="format-comparison"><summary>Ver apresentação das versões</summary><div class="format-comparison-grid"><div><h4>Antes</h4><div class="rich-preview">${R.html(before)}</div></div><div><h4>Depois</h4><div class="rich-preview">${R.html(after)}</div></div></div></details>` : ''}</section>`; }).join('');
    $('#diffContent').innerHTML = `<p class="diff-summary">${changed ? `${changed} ${changed === 1 ? 'seção com alterações.' : 'seções com alterações.'}` : 'O conteúdo destas versões é igual.'}</p>${html}`;
  }
  function jumpSection(id) { if (current().guided && !current().sections.some(s => s.id === id)) { ui.step = 'document'; ui.preview = true; render(); } if (current().sections.find(s => s.id === id)?.scope === 'internal') { ui.panel = 'brief'; render(); $('.guided-notes')?.scrollIntoView({ block: 'center' }); return; } const node = document.getElementById('section-' + id); if (node) { node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); node.classList.add('section-highlight'); setTimeout(() => node.classList.remove('section-highlight'), 1800); } }
  function apply(action, data = {}) { const result = M.transition(current(), action, ui.userId, data); if (!result.ok) { if (action === 'approve' && current().guided) { ui.tab = 'draft'; ui.step = 'check'; render(); } notify(result.message); return false; } persist(); render(); notify(({ saveVersion: 'Versão registrada no histórico.', submit: 'Minuta enviada para a revisão de Marina.', return: 'Ajustes solicitados ao responsável.', approve: 'Minuta aprovada internamente na demonstração.', comment: 'Comentário adicionado à peça.', assign: 'Responsável e orientações salvos.', address: 'Ajuste tratado. Marina confirma na revisão.', resolve: 'Comentário resolvido.', reopen: 'Comentário reaberto.', reply: 'Resposta adicionada.' })[action] || 'Alteração salva.'); return true; }
  document.addEventListener('click', async ev => {
    const target = ev.target.closest('[data-action]'); if (!target) return;
    const action = target.dataset.action, item = current();
    if (action === 'logout') {
      if (AU.isBusy()) { notify('Aguarde o salvamento dos arquivos antes de sair.'); return; }
      if (!persist()) return;
      target.disabled = true;
      try { await window.EloAuth.logout(); }
      catch (error) { target.disabled = false; notify(window.EloAuth.message(error)); return; }
      location.assign('login.html'); return;
    }
    if (AU.isBusy() && ['approve', 'submit', 'saveVersion', 'createGuided', 'confirmReset'].includes(action)) { notify('Aguarde o salvamento dos arquivos.'); return; }
    if (action === 'insertReferences') {
      if (!item.fullDocument || !M.canEdit(item, ui.userId) || ui.preview) return;
      if (A.issues(item).length) { notify('Confira os vínculos pendentes antes de inserir as referências.'); return; }
      const text = A.pendingReferences(item);
      if (!text) { notify('As referências dos vínculos já estão no texto.'); return; }
      if (E.appendText(text)) { persist(); notify('Referências inseridas ao final da peça. Você pode editar ou mover esse texto.'); }
      return;
    }
    if (action === 'guidedStep') { persist(); ui.step = target.dataset.step; ui.preview = false; render(); return; }
    if (action === 'newGuided') { showDialog('Criar peça guiada', GU.choose(), true); return; }
    if (action === 'createGuided') {
      const n = Math.max(...state.cases.map(c => Number(c.id.replace('ELO-', '')) || 0)) + 1;
      const created = G.create(item, 'ELO-' + String(n).padStart(3, '0'), target.dataset.type);
      C.ensure(created);
      created.events.push({ text: 'Peça guiada criada a partir de ' + item.id + '.', userId: ui.userId, at: new Date().toISOString() });
      state.cases.push(created); $('#workspaceDialog').close(); navigate('case', created.id); notify('Peça criada. Complete os dados e a redação.'); return;
    }
    if (['home', 'cases', 'reviews'].includes(action)) return navigate(action);
    if (action === 'openCase') return navigate('case', target.dataset.id, state.cases.find(c => c.id === target.dataset.id)?.status === 'intake' ? 'context' : 'draft');
    if (action === 'caseTab' || action === 'context') return navigate('case', item.id, action === 'context' ? 'context' : target.dataset.tab);
    if (action === 'filter') { ui.filter = target.dataset.filter; render(); return; }
    if (action === 'clearFilters') { ui.search = ''; ui.filter = 'all'; render(); return; }
    if (action === 'panel') { ui.panel = target.dataset.panel; render(); return; }
    if (action === 'editMode') { ui.preview = target.dataset.mode === 'preview'; render(); return; }
    if (action === 'anchorComment') { const form = draftForm(item); form.sectionId = target.dataset.section; form.quote = ui.selection?.sectionId === form.sectionId ? ui.selection.text : ''; ui.panel = 'comments'; render(); const field = $('#commentText'); if (field) { field.scrollIntoView({ block: 'center' }); field.focus({ preventScroll: true }); } else $('.review-panel').scrollIntoView({ block: 'start' }); return; }
    if (action === 'jumpSection') return jumpSection(target.dataset.section);
    if (action === 'focusPanel') { ui.panel = 'comments'; render(); $('.review-panel').scrollIntoView({ block: 'start' }); return; }
    if (action === 'clearQuote') { draftForm(item).quote = ''; render(); return; }
    if (action === 'source') return sourceDialog(target.dataset.doc, Number(target.dataset.page));
    if (action === 'sourcePage' && ui.source) return sourceDialog(ui.source.docId, Number(target.dataset.page));
    if (action === 'compare') return compareDialog();
    if (action === 'closeDialog') return $('#workspaceDialog').close();
    if (action === 'readVersion') { const v = item.versions.find(v => v.id === target.dataset.version); if (v) showDialog(v.id.toUpperCase() + ' · ' + v.label, `<p class="version-date">${e(v.legacyAt || time(v.at))} · ${e(M.USERS[v.userId]?.name || 'Equipe')}</p>${v.sections.map(s => `<section class="read-section">${s.omitTitle ? '' : `<h3>${e(s.title)}</h3>`}<div class="rich-preview">${R.html(s)}</div></section>`).join('')}`, true); return; }
    if (action === 'replyForm') { showDialog('Responder ao comentário', `<form id="replyForm" data-comment="${e(target.dataset.comment)}"><label for="replyText">Sua resposta</label><textarea id="replyText" rows="4" maxlength="2000" required></textarea><button class="button primary" type="submit">Enviar resposta ${icon('arrow')}</button></form>`); return; }
    if (action === 'export') { if (A.issues(item).length) { ui.panel = 'sources'; render(); notify('Confira os vínculos pendentes antes de exportar.'); return; } persist(); showDialog('Exportar a minuta', `<p class="export-intro">O texto atual e sua formatação serão incluídos no arquivo. Comentários, orientações, notas e justificativas internas ficam na EloJus.</p>${item.guided ? `<p class="export-note">${G.blockers(item).length ? 'Rascunho: a conferência ainda está pendente.' : 'Conferência registrada para esta redação.'} Exportar não assina nem protocola.</p>` : ''}<label for="exportPaper">Tamanho do papel</label><select id="exportPaper"><option value="A4">A4 · 21 × 29,7 cm</option><option value="LETTER">Carta · 21,6 × 27,9 cm</option></select><div class="export-options">${btn('<strong>Word <span>.docx</span></strong><small>Documento editável com formatação</small>', 'downloadDocument', 'export-option', 'data-format="docx"')}${btn('<strong>PDF <span>.pdf</span></strong><small>Documento paginado com texto selecionável</small>', 'downloadDocument', 'export-option', 'data-format="pdf"')}${btn('<strong>Texto <span>.txt</span></strong><small>Somente o conteúdo, sem estilos</small>', 'downloadDocument', 'export-option', 'data-format="txt"')}</div><p class="export-note">${item.fullDocument ? 'O arquivo reproduz o texto do editor, incluindo as referências que você inseriu.' : 'As referências e a relação de documentos entram na peça.'} Baixe os arquivos de apoio separadamente em Fontes. Gerado neste navegador, sem envio externo.</p><p id="exportStatus" role="status" aria-live="polite"></p><div id="exportResult"></div>`); return; }
    if (action === 'downloadDocument') return window.EloExport.download(item, target.dataset.format, $('#exportPaper').value, $('#workspaceDialog'));
    if (action === 'reset') { showDialog('Reiniciar os casos fictícios?', `<p>Isso restaura os oito exemplos e remove as alterações desta nova demonstração neste navegador. Os dados da versão anterior permanecem preservados.</p><div class="dialog-actions">${btn('Cancelar', 'closeDialog', 'secondary')}${btn('Restaurar exemplos', 'confirmReset', 'primary')}</div>`); return; }
    if (action === 'confirmReset') { state = G.upgrade(M.createSeed()); C.upgrade(state); ui.commentDrafts = {}; $('#workspaceDialog').close(); ui.userId = 'marina'; try { localStorage.setItem(personKey, 'marina'); } catch {} navigate('home'); notify('Os oito casos fictícios foram restaurados.'); return; }
    if (['saveVersion', 'submit', 'return', 'approve', 'address', 'resolve', 'reopen'].includes(action)) return apply(action, { commentId: target.dataset.comment });
  });
  document.addEventListener('input', ev => {
    const target = ev.target, item = current();
    if (target.id === 'caseSearch') { ui.search = target.value; $('#caseResults').innerHTML = caseRows(); $('#resultCount').textContent = filtered().length + (filtered().length === 1 ? ' caso na seleção' : ' casos na seleção'); }
    if (item.guided && M.canEdit(item, ui.userId)) {
      if (!item.fullDocument && target.matches('[data-guided-field]')) { item.guided.fields[target.dataset.guidedField] = target.value; item.documentTitle = item.guided.type === 'initial' ? item.guided.fields.acao || G.types.initial : G.types.defense; scheduleSave(); }
      if (target.matches('[data-guided-notes]')) { item.guided.notes = target.value; scheduleSave(); }
      if (!item.fullDocument && target.matches('[data-guided-annexes]')) { item.guided.annexes = target.value; refreshConference(); scheduleSave(); }
      if (target.matches('[data-requirement-reason]')) { const r = item.guided.checks[target.dataset.requirementReason]; G.review(item, target.dataset.requirementReason, r.status, target.value, ui.userId); refreshConference(); scheduleSave(); }
    }
    if (target.matches('[data-internal-section]') && M.canEdit(item, ui.userId)) { const section = item.sections.find(s => s.id === target.dataset.internalSection); section.text = target.value; delete section.delta; scheduleSave(); }
    if (target.id === 'commentText') draftForm(item).text = target.value;
  });
  document.addEventListener('change', ev => {
    const target = ev.target, item = current();
    if (item.guided && M.canEdit(item, ui.userId)) {
      if (target.matches('[data-requirement]')) { const id = target.dataset.requirement; G.review(item, id, target.value, item.guided.checks[id]?.reason || '', ui.userId); persist(); render(); }
      if (target.matches('[data-requirement-reason], [data-guided-annexes]')) { persist(); }
      if (target.id === 'guidedAttestation' && ui.userId === 'marina' && G.requirements(item).every(r => r.done)) { item.guided.attestation = target.checked ? { userId: ui.userId, key: G.reviewKey(item), at: new Date().toISOString() } : null; persist(); render(); }
    }
    if (target.id === 'role') { persist(); ui.userId = M.USERS[target.value] ? target.value : 'marina'; ui.preview = false; try { localStorage.setItem(personKey, ui.userId); } catch {} render(); notify(`Visão simulada de ${user().name}.`); }
    if (target.id === 'commentSection') { draftForm(item).sectionId = target.value; draftForm(item).quote = ''; render(); }
    if (target.id === 'blockingComment') draftForm(item).blocking = target.checked;
    if (target.matches('[data-check]') && M.canEdit(item, ui.userId)) { item.checks[Number(target.dataset.check)] = target.checked; persist(); }
    if (['compareFrom', 'compareTo'].includes(target.id)) renderDiff();
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id === 'commentForm') { ev.preventDefault(); const form = draftForm(current()); const result = M.transition(current(), 'comment', ui.userId, form); if (result.ok) { ui.commentDrafts[current().id] = { text: '', sectionId: form.sectionId, quote: '', blocking: true }; persist(); render(); notify('Comentário adicionado à peça.'); } else notify(result.message); }
    if (ev.target.id === 'assignmentForm') { ev.preventDefault(); apply('assign', { ownerId: $('#ownerSelect').value, due: $('#internalDue').value, instructions: $('#instructionsText').value }); }
    if (ev.target.id === 'replyForm') { ev.preventDefault(); const data = { commentId: ev.target.dataset.comment, text: $('#replyText').value }; if (apply('reply', data)) $('#workspaceDialog').close(); }
  });
  document.addEventListener('selectionchange', () => { const selection = window.getSelection(); if (!selection || selection.isCollapsed || !selection.anchorNode) return; const parent = selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement; const section = parent.closest?.('.doc-section'); if (section && section.contains(selection.focusNode)) ui.selection = { sectionId: section.id.replace('section-', ''), text: selection.toString().slice(0, 2000) }; });
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);
  window.addEventListener('popstate', () => { persist(); readRoute(); render(); });
  AU.init({ current, cases: () => state.cases, userId: () => ui.userId, selection: () => E.selection() || ui.selection, persist, render, notify, dialog: showDialog, documents: () => { ui.tab = 'context'; render(); }, jump: id => { ui.tab = 'draft'; ui.step = 'document'; ui.preview = false; ui.panel = 'sources'; render(); jumpSection(id); } });
  $('#accessIdentity').textContent = window.EloAuth.displayName() + ' · ';
  readRoute(); render(); persist(); AU.audit();
  window.EloOffice.load().then(({user, office}) => {
    if (user.id !== authenticatedUser.id) return;
    workspaceOfficeName = office?.name || 'EloJus';
    if (ui.page !== 'case') $('#breadcrumb').firstChild.textContent = workspaceOfficeName + ' ';
    $('#workspaceOfficeName').textContent = office?.name || 'Cadastre seu escritório';
    $('#workspaceOfficeName').style.overflowWrap = 'anywhere';
    $('#workspaceOfficeStatus').textContent = office ? 'Cadastro vinculado à sua conta' : 'Comece em Meu escritório';
    $('#officeAvatar').textContent = office ? office.name.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).slice(0,2).map(word => Array.from(word)[0]).join('').toUpperCase() : 'EJ';
  }).catch(() => { $('#workspaceOfficeStatus').textContent = 'Consulte em Meu escritório'; });
})();

