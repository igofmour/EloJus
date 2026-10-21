(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./guided-model.js'), require('./attachment-model.js'));
  else root.EloModel = factory(root.EloGuided, root.EloAttachments);
})(typeof globalThis === 'object' ? globalThis : this, function (G, A) {
  'use strict';
  const KEY = 'elojus-workspace-v2';
  const USERS = { marina: { name: 'Marina', initials: 'MA', role: 'Advogada', professionalType: 'lawyer', reviewer: true }, lucas: { name: 'Lucas', initials: 'LU', role: 'Estagiário', professionalType: 'intern' }, clara: { name: 'Clara', initials: 'CL', role: 'Estagiária', professionalType: 'intern' } };
  const STATUS = { intake: 'A distribuir', working: 'Em elaboração', review: 'Para revisar', changes: 'Ajustes solicitados', approved: 'Aprovado internamente' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function dateKey(value) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function event(item, text, userId, now) { item.events.unshift({ text, userId, at: new Date(now).toISOString() }); item.updatedAt = new Date(now).toISOString(); }
  function snapshot(item, label, userId, now) { item.versions.push({ id: 'v' + (item.versions.length + 1), label, userId, at: new Date(now).toISOString(), sections: clone(G.document(item).sections), attachments: clone(A.files(item)), documentLinks: clone(A.links(item)), guided: item.guided ? clone(item.guided) : undefined }); }
  function sections(person, facts, pending) { return [
    { id: 'contexto', title: 'Contexto do atendimento', text: `${person}. Atendimento inteiramente fictício, preparado para demonstrar a organização do trabalho da equipe.` },
    { id: 'fatos', title: 'Síntese dos fatos', text: facts },
    { id: 'analise', title: 'Pontos para conferência', text: pending },
    { id: 'encaminhamento', title: 'Próximo encaminhamento', text: 'Submeter o relato e os documentos de exemplo à revisão da advogada. Os fundamentos e as medidas cabíveis dependem de análise profissional. Esta minuta não contém conclusão jurídica validada.' }
  ]; }
  function createSeed(now = Date.now()) {
    const day = offset => { const d = new Date(now); d.setDate(d.getDate() + offset); return dateKey(d); };
    const records = [
      ['ELO-001', 'Cobrança de serviço não contratado', 'Consumidor', 'Ana Exemplo', 'intake', 'lucas', 3, 'Organize a sequência dos fatos e vincule cada afirmação aos documentos de exemplo. Sinalize informações pendentes para revisão.', 'A cliente fictícia relata duas cobranças por um serviço que afirma não ter contratado. Informa que procurou atendimento e ainda não recebeu uma resposta conclusiva.', 'Confirmar a origem das cobranças, as datas dos contatos e os documentos disponíveis.'],
      ['ELO-002', 'Reembolso de compra cancelada', 'Consumidor', 'Júlia Exemplo', 'review', 'lucas', 1, 'Revisar a cronologia do cancelamento e distinguir o relato da cliente das informações confirmadas pelos documentos. Conferir os valores antes de concluir.', 'A compra fictícia foi realizada em 05/10, no valor de R$ 480,00. O pedido de cancelamento foi registrado em 08/10. No comprovante de exemplo, o estorno ainda consta como pendente. A cliente relata novo contato em 12/10, sem confirmação documental.', 'Conferir se existe confirmação do segundo contato. O comprovante demonstra a solicitação de estorno, mas não a efetivação do pagamento.'],
      ['ELO-003', 'Contestação de cobrança duplicada', 'Consumidor', 'Rafael Fictício', 'changes', 'clara', 0, 'Ajustar o relato para diferenciar duas cobranças de dois pagamentos. Relacionar cada valor ao comprovante correspondente.', 'O relato inicial menciona duas cobranças de R$ 250,00 pelo mesmo serviço. O cliente fictício informa que houve pagamento em duplicidade.', 'Solicitar um segundo comprovante. Até o momento, os exemplos disponíveis não confirmam os dois pagamentos.'],
      ['ELO-004', 'Relatório de atendimento — locação', 'Cível', 'Bruno Exemplo', 'working', 'lucas', 2, 'Preparar um relatório objetivo do atendimento. Separar o que está documentado, o que é relato e o que ainda precisa ser confirmado.', 'O locatário fictício relata uma divergência sobre o estado do imóvel ao final da locação. Há um relatório de vistoria de entrada e uma troca de mensagens de exemplo.', 'A vistoria de saída e a sequência completa das mensagens ainda precisam ser conferidas.'],
      ['ELO-005', 'Revisão de termo de prestação de serviços', 'Contratos', 'Empresa Horizonte — fictícia', 'review', 'clara', 2, 'Conferir a coerência entre escopo, entregas e condições de pagamento. Destacar dúvidas para a reunião com a advogada.', 'O termo fictício descreve três entregas mensais, mas o anexo apresenta somente duas. O pagamento está vinculado à conclusão das entregas, sem detalhar a forma de aceite.', 'Alinhar o número de entregas entre o termo e o anexo. Confirmar a forma de aceite antes de consolidar o texto.'],
      ['ELO-006', 'Organização de documentos — acordo', 'Cível', 'Oficina Modelo — fictícia', 'approved', 'lucas', -1, 'Organizar o conjunto de documentos e preparar uma lista de pontos para conferência final.', 'Os documentos fictícios foram organizados por data. O relatório registra as informações presentes em cada arquivo e as lacunas que dependem de confirmação.', 'Relatório conferido internamente na demonstração. Nenhuma medida foi tomada e nenhum documento foi enviado.']
    ];
    const cases = records.map((r, index) => {
      const [id, title, area, client, status, ownerId, offset, instructions, facts, pending] = r;
      const item = { id, title, area, client, status, ownerId, due: day(offset), instructions, narrative: facts, documentTitle: id === 'ELO-005' ? 'Notas de revisão do termo' : 'Relatório e minuta de trabalho', sections: sections(client, facts, pending), checks: [status === 'review' || status === 'approved', status === 'approved', status === 'approved'], comments: [], versions: [], events: [], updatedAt: new Date(now - index * 900000).toISOString(), docs: [
        { id: 'relato', title: 'Registro do atendimento', subtitle: 'Relato organizado · 1 página', pages: [`REGISTRO FICTÍCIO DO ATENDIMENTO\n\n${client}\n\n${facts}\n\nOrigem: relato de exemplo. As informações não representam um caso real.`] },
        { id: 'documentos', title: id === 'ELO-005' ? 'Termo e anexo de exemplo' : 'Comprovantes de exemplo', subtitle: 'Material ilustrativo · 2 páginas', pages: [id === 'ELO-002' ? 'COMPROVANTE FICTÍCIO\n\nPedido: EX-0480\nCompra: 05/10\nValor: R$ 480,00\nCancelamento solicitado: 08/10\n\nEste material foi criado exclusivamente para a demonstração.' : `DOCUMENTO FICTÍCIO — PÁGINA 1\n\n${facts}\n\nMaterial ilustrativo. Não comprova acontecimentos reais.`, id === 'ELO-002' ? 'REGISTRO FICTÍCIO DE ESTORNO\n\nPedido: EX-0480\nSituação: solicitação registrada; efetivação pendente.\n\nNão há registro do contato de 12/10 neste material.' : `DOCUMENTO FICTÍCIO — PÁGINA 2\n\n${pending}\n\nEste exemplo contém informações pendentes de conferência.`] }
      ] };
      event(item, 'Atendimento organizado e documentos de exemplo reunidos.', 'marina', now - 172800000 - index * 60000);
      if (status !== 'intake') { snapshot(item, 'Primeiro rascunho', ownerId, now - 86400000); event(item, `Tarefa distribuída para ${USERS[ownerId].name}.`, 'marina', now - 86400000); }
      if (['review', 'changes', 'approved'].includes(status)) {
        item.versions[0].sections[1].text = status === 'review' ? 'Relato inicial organizado. A cronologia e os documentos ainda serão detalhados para revisão.' : item.sections[1].text + '\nPendente: conferir a documentação.';
        snapshot(item, 'Enviada para revisão', ownerId, now - (index + 1) * 1800000);
        event(item, 'Minuta enviada para revisão de Marina.', ownerId, now - (index + 1) * 1800000);
      }
      if (id === 'ELO-002') item.comments.push({ id: 'c1', sectionId: 'fatos', quote: 'A cliente relata novo contato em 12/10, sem confirmação documental.', text: 'Manter clara a distinção entre o relato da cliente e o registro documental. A redação atual já sinaliza essa diferença; conferir antes da aprovação.', userId: 'marina', at: new Date(now - 1500000).toISOString(), blocking: false, status: 'open', replies: [], versionId: 'v2' });
      if (status === 'changes') { item.comments.push({ id: 'c1', sectionId: 'fatos', quote: 'O cliente fictício informa que houve pagamento em duplicidade.', text: 'O segundo pagamento não está confirmado. Ajustar a afirmação e registrar a falta do comprovante como pendência.', userId: 'marina', at: new Date(now - 2400000).toISOString(), blocking: true, status: 'open', replies: [], versionId: 'v2' }); event(item, 'Marina solicitou um ajuste no relato dos fatos.', 'marina', now - 2400000); }
      if (status === 'approved') event(item, 'Minuta aprovada internamente na demonstração.', 'marina', now - 3600000);
      return item;
    });
    return { schema: 2, cases };
  }
  function importLegacy(state, legacy, now = Date.now()) {
    if (!legacy || typeof legacy.draft !== 'string' || !Array.isArray(legacy.events)) return state;
    const item = state.cases[0];
    item.title = typeof legacy.title === 'string' ? legacy.title : item.title;
    item.narrative = typeof legacy.narrative === 'string' ? legacy.narrative : item.narrative;
    item.instructions = typeof legacy.instructions === 'string' ? legacy.instructions : item.instructions;
    item.ownerId = String(legacy.owner).startsWith('Clara') ? 'clara' : 'lucas';
    item.status = STATUS[legacy.status] ? legacy.status : 'intake';
    item.due = /^\d{4}-\d{2}-\d{2}$/.test(legacy.due) ? legacy.due : item.due;
    item.sections = [{ id: 'legado', title: 'Minuta preservada da demonstração anterior', text: legacy.draft }];
    item.checks = Array.isArray(legacy.checks) ? [0, 1, 2].map(i => Boolean(legacy.checks[i])) : [false, false, false];
    item.versions = (legacy.versions || []).map((v, i) => ({ id: 'v' + (i + 1), label: String(v.label || 'Versão importada'), userId: item.ownerId, at: new Date(now).toISOString(), legacyAt: v.at, sections: [{ id: 'legado', title: item.sections[0].title, text: String(v.text || '') }] }));
    item.comments = (legacy.comments || []).map((c, i) => ({ id: 'c' + (i + 1), sectionId: 'legado', quote: '', text: `[${String(c.section || 'Geral')}] ${String(c.text || '')}`, userId: 'marina', at: new Date(now).toISOString(), legacyAt: c.at, status: c.resolved ? 'resolved' : 'open', blocking: true, replies: [] }));
    item.events = legacy.events.map(e => ({ text: String(e.text || ''), at: new Date(now).toISOString(), legacyAt: e.at, userId: 'marina' }));
    event(item, 'Conteúdo da demonstração anterior preservado neste caso.', 'marina', now);
    return state;
  }
  function validState(value) { return value && value.schema === 2 && Array.isArray(value.cases) && value.cases.length > 0 && value.cases.every(c => c && typeof c.id === 'string' && STATUS[c.status] && USERS[c.ownerId] && Array.isArray(c.sections) && c.sections.every(s => typeof s.text === 'string') && ['comments', 'versions', 'events', 'docs', 'checks'].every(k => Array.isArray(c[k]))); }
  function canEdit(item, userId) { return item.status !== 'approved' && item.status !== 'intake' && (userId === 'marina' || (item.ownerId === userId && ['working', 'changes'].includes(item.status))); }
  function pending(item) { return item.comments.filter(c => c.blocking && c.status !== 'resolved'); }
  function transition(item, action, userId, data = {}, now = Date.now()) {
    const reviewer = userId === 'marina';
    const fail = message => ({ ok: false, message });
    if (!USERS[userId]) return fail('Selecione uma pessoa da equipe.');
    if (action === 'assign') {
      if (!reviewer || item.status === 'approved') return fail('A distribuição está disponível para Marina em casos abertos.');
      if (!['lucas', 'clara'].includes(data.ownerId) || !/^\d{4}-\d{2}-\d{2}$/.test(data.due) || !String(data.instructions || '').trim()) return fail('Informe responsável, entrega interna e orientações.');
      Object.assign(item, { ownerId: data.ownerId, due: data.due, instructions: data.instructions.trim() });
      if (item.status === 'intake') item.status = 'working';
      event(item, `Orientações e responsabilidade definidas para ${USERS[item.ownerId].name}.`, userId, now);
    } else if (action === 'saveVersion' || action === 'submit') {
      if (!canEdit(item, userId)) return fail('Esta minuta está em leitura para a visão selecionada.');
      if (!G.finalSections(item).some(s => s.text.trim())) return fail('Escreva o conteúdo da minuta antes de continuar.');
      snapshot(item, action === 'submit' ? 'Enviada para revisão' : 'Versão de trabalho', userId, now);
      if (action === 'submit') item.status = 'review';
      event(item, action === 'submit' ? 'Minuta enviada para revisão de Marina.' : 'Uma versão de trabalho foi registrada.', userId, now);
    } else if (action === 'comment') {
      if (item.status === 'approved' || (!reviewer && item.ownerId !== userId)) return fail('Comentários indisponíveis para esta visão.');
      if (!String(data.text || '').trim()) return fail('Escreva o comentário.');
      if (![...item.sections, ...G.document(item).sections].some(s => s.id === data.sectionId)) return fail('Selecione uma seção válida.');
      item.comments.push({ id: 'c' + now + '-' + item.comments.length, sectionId: data.sectionId, quote: String(data.quote || '').slice(0, 500), text: data.text.trim().slice(0, 2000), userId, at: new Date(now).toISOString(), blocking: reviewer && Boolean(data.blocking), status: 'open', replies: [], versionId: item.versions.at(-1)?.id || 'rascunho' });
      event(item, 'Um comentário foi adicionado à minuta.', userId, now);
    } else if (['address', 'resolve', 'reopen', 'reply'].includes(action)) {
      if (item.status === 'approved') return fail('Esta revisão já foi concluída.');
      const comment = item.comments.find(c => c.id === data.commentId);
      if (!comment) return fail('Comentário não encontrado.');
      if (action === 'reply') {
        if (!reviewer && item.ownerId !== userId) return fail('Responda com a visão do responsável pelo caso.');
        if (!String(data.text || '').trim()) return fail('Escreva uma resposta.');
        comment.replies.push({ text: data.text.trim().slice(0, 2000), userId, at: new Date(now).toISOString() });
      } else if (action === 'address') {
        if (reviewer || item.ownerId !== userId || !['working', 'changes'].includes(item.status)) return fail('O responsável pode marcar o ajuste durante a elaboração.');
        comment.status = 'addressed';
      } else {
        if (!reviewer) return fail('Marina confirma a resolução dos comentários.');
        comment.status = action === 'resolve' ? 'resolved' : 'open';
      }
      event(item, action === 'reply' ? 'Uma resposta foi adicionada à revisão.' : action === 'address' ? 'Ajuste marcado como tratado; aguarda conferência de Marina.' : action === 'resolve' ? 'Comentário resolvido por Marina.' : 'Comentário reaberto por Marina.', userId, now);
    } else if (action === 'return') {
      if (!reviewer || item.status !== 'review') return fail('Somente Marina pode devolver uma minuta em revisão.');
      if (!item.comments.some(c => c.status === 'open')) return fail('Adicione ou reabra um comentário com o ajuste solicitado.');
      item.status = 'changes'; event(item, `Marina solicitou ajustes a ${USERS[item.ownerId].name}.`, userId, now);
    } else if (action === 'approve') {
      if (!reviewer || item.status !== 'review') return fail('Somente Marina pode aprovar uma minuta em revisão.');
      if (pending(item).length) return fail('Confira e resolva os comentários que bloqueiam a aprovação.');
      if (A.issues(item).length) return fail('Confira os vínculos pendentes: há trechos alterados ou documentos indisponíveis.');
      if (G.blockers(item).length) return fail('Aprovação pendente: conclua os itens da conferência e a confirmação final da advogada.');
      snapshot(item, 'Aprovada internamente', userId, now); item.status = 'approved'; event(item, 'Minuta aprovada internamente na demonstração. Nenhum documento foi enviado.', userId, now);
    } else return fail('Ação desconhecida.');
    return { ok: true };
  }
  function diffWords(before, after) {
    if (before === after) return escape(after);
    const a = String(before).match(/\S+\s*|\s+/g) || [], b = String(after).match(/\S+\s*|\s+/g) || [];
    if (a.length * b.length > 250000) return `<del>${escape(before)}</del> <ins>${escape(after)}</ins>`;
    const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
    let i = 0, j = 0, html = '';
    while (i < a.length || j < b.length) { if (i < a.length && j < b.length && a[i] === b[j]) { html += escape(a[i++]); j++; } else if (j < b.length && (i === a.length || rows[i][j + 1] >= rows[i + 1][j])) html += `<ins>${escape(b[j++])}</ins>`; else html += `<del>${escape(a[i++])}</del>`; }
    return html;
  }
  // Permissions for the fictional profiles in demonstracao.html.
  function canCreateGuided(userId) { return USERS[userId]?.professionalType === 'lawyer'; }
  function createGuided(base, id, type, userId, now = Date.now()) {
    if (!canCreateGuided(userId)) return null;
    return G.create(base, id, type, now);
  }
  return { KEY, USERS, STATUS, clone, escape, dateKey, createSeed, importLegacy, validState, canEdit, canCreateGuided, createGuided, pending, transition, diffWords };
});
