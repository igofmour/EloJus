(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./attachment-model.js'));
  else root.EloGuided = factory(root.EloAttachments);
})(typeof globalThis === 'object' ? globalThis : this, function (A) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const CPC = 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm';
  const types = { initial: 'Petição inicial cível', defense: 'Contestação' };
  const common = [
    ['fatos', 'Dos fatos', 'Organize a cronologia e distinga as alegações das informações documentadas.'],
    ['fundamentos', 'Dos fundamentos jurídicos', 'Relacione as normas ao caso concreto. Confira a vigência e a origem de cada referência.'],
    ['pedidos', 'Dos pedidos', 'Especifique cada providência requerida e sua relação com os fatos e fundamentos.'],
    ['provas', 'Das provas', 'Indique as provas pretendidas e a finalidade de cada uma. Referencie os documentos pelo mesmo nome do índice de anexos.']
  ];
  function templates(type) {
    return (type === 'initial' ? common : [
      ['tempestividade', 'Da tempestividade', 'Registre o marco, a contagem e os elementos que sustentam a tempestividade. A EloJus não calcula prazos judiciais.'],
      ['sintese', 'Síntese da demanda', 'Resuma os pedidos e as alegações da inicial, sem assumir que os fatos alegados são incontroversos.'],
      ['preliminares', 'Das preliminares', 'Examine as questões processuais pertinentes ao caso. Se nenhuma for aplicável, justifique na conferência.', true],
      ['impugnacao', 'Da impugnação aos fatos', 'Responda especificamente às alegações relevantes, indicando o que é admitido, controvertido e a prova correspondente.'],
      ...common.slice(1)
    ]).map(([id, title, help, optional]) => ({ id, title, help, optional: !!optional, text: '' }));
  }
  function finalSections(item) { return item.sections.filter(s => s.scope !== 'internal'); }
  function document(item) {
    if (item.documentProjection) return item;
    // The editor is the complete authored document. Never recompose old fields
    // or append hidden references after an author edits or removes that text.
    if (item.fullDocument) return { ...item, documentProjection: true, sections: finalSections(item) };
    const linkedIndex = A.index(item), body = A.project(item, finalSections(item));
    if (!item.guided) return { ...item, documentProjection: true, sections: [...body, ...(linkedIndex ? [{ id: 'anexos', title: 'Documentos vinculados', text: linkedIndex }] : [])] };
    const f = item.guided.fields, section = (id, title, text) => ({ id, title, text: String(text || '') });
    const prefix = [section('juizo', 'Endereçamento', f.juizo)];
    if (item.guided.type === 'defense') prefix.push(section('processo', 'Processo', f.processo));
    prefix.push(section('partes', 'Das partes', `Autor(es):\n${f.autor || ''}\n\nRéu(s):\n${f.reu || ''}`));
    prefix.push(section('representacao', 'Da representação', f.representacao));
    const suffix = [];
    if (item.guided.type === 'initial') {
      suffix.push(section('valor', 'Do valor da causa', f.valor ? `Dá-se à causa o valor de ${f.valor}.` : ''));
      suffix.push(section('conciliacao', 'Da conciliação ou mediação', f.conciliacao));
    }
    suffix.push(section('fecho', 'Encerramento', [f.localData, f.assinatura].filter(Boolean).join('\n')));
    const annexes = [linkedIndex && 'Documentos vinculados ao caso:\n' + linkedIndex, item.guided.annexes.trim() && (linkedIndex ? 'Relação complementar:\n' : '') + item.guided.annexes.trim()].filter(Boolean).join('\n\n');
    if (annexes) suffix.push(section('anexos', 'Relação de documentos', annexes));
    return { ...item, documentProjection: true, documentTitle: item.guided.type === 'initial' ? (f.acao || types.initial) : types.defense,
      sections: [...prefix, ...body.filter(s => !s.optional || s.text.trim()), ...suffix].filter(s => s.text.trim()) };
  }
  function fingerprint(item) { return JSON.stringify({ type: item.guided?.type, fullDocument: item.fullDocument || undefined, fields: item.fullDocument ? undefined : item.guided?.fields, annexes: item.fullDocument ? undefined : item.guided?.annexes, attachments: A.links(item).length || A.files(item).length ? A.fingerprint(item) : undefined, sections: finalSections(item).map(({ id, title, text, delta }) => ({ id, title, text, delta })) }); }
  function requirements(item) {
    if (!item.guided) return [];
    const f = item.guided.fields, free = item.editorMode === 'continuous', has = id => !!item.sections.find(s => s.id === (free ? 'corpo' : id))?.text.trim();
    const req = (id, title, basis, present, exception = false, optional = false) => ({ id, title, basis, present: !!present, exception, optional });
    const list = [req('juizo', 'Juízo e adequação do procedimento', 'CPC · arts. 318 e 319, I', f.juizo.trim()), req('partes', 'Identificação e qualificação das partes', 'Conferir os dados disponíveis e eventuais lacunas justificadas', f.autor.trim() && f.reu.trim(), true)];
    if (item.guided.type === 'initial') list.push(req('acao', 'Identificação da demanda', 'Correspondência entre a ação, os fatos e os pedidos', f.acao.trim()), req('fatos', 'Fatos que sustentam a pretensão', 'CPC · art. 319, III', has('fatos')));
    else list.push(req('processo', 'Identificação do processo', 'Conferência com os autos', f.processo.trim()), req('tempestividade', 'Tempestividade conferida nos autos', 'CPC · art. 335 · sem cálculo automático', has('tempestividade')), req('sintese', 'Demanda e pedidos compreendidos', 'Conferência da inicial e de seus documentos', has('sintese')), req('preliminares', 'Preliminares examinadas', 'CPC · art. 337 · quando aplicáveis', has('preliminares'), false, true), req('impugnacao', 'Impugnação específica dos fatos', 'CPC · arts. 336 e 341 · examinar as exceções cabíveis', has('impugnacao'), true));
    list.push(req('fundamentos', 'Fundamentos e referências conferidos', 'Conferência humana das fontes e da aplicação ao caso', has('fundamentos')), req('pedidos', 'Pedidos coerentes e especificados', 'Verificar o resultado pretendido e os requerimentos pertinentes', has('pedidos')), req('provas', 'Provas especificadas', 'CPC · arts. 319, VI, e 336', has('provas')));
    if (item.guided.type === 'initial') list.push(req('valor', 'Valor da causa e critério de cálculo', 'CPC · arts. 291, 292 e 319, V', f.valor.trim()), req('conciliacao', 'Manifestação sobre conciliação ou mediação', 'CPC · art. 319, VII', f.conciliacao.trim()));
    list.push(req('representacao', 'Representação e identificação profissional', 'Conferir procuração e hipóteses legais de dispensa', f.representacao.trim() && f.assinatura.trim() && f.localData.trim(), true), req('anexos', 'Documentos e correspondência com os anexos', 'CPC · arts. 320 e 434 · conferir os arquivos e sua juntada no destino', item.guided.annexes.trim() || A.index(item), true));
    if (A.links(item).length) list.push(req('vinculos', 'Vínculos entre texto e documentos', 'Conferir conteúdo, localização e pertinência de cada prova; vínculo não valida a alegação', !A.issues(item).length));
    const fp = fingerprint(item);
    return list.map(r => { const c = item.guided.checks[r.id] || {}; const fresh = c.fingerprint === fp;
      const manual = item.fullDocument ? r.id !== 'vinculos' : free && ['fatos', 'sintese', 'tempestividade', 'preliminares', 'impugnacao', 'fundamentos', 'pedidos', 'provas'].includes(r.id);
      if (item.fullDocument && manual) r.present = has('corpo');
      const accepted = fresh && ((c.status === 'checked' && r.present) || (c.status === 'na' && r.optional && c.reason?.trim()) || (c.status === 'exception' && r.exception && c.reason?.trim()));
      return { ...r, ...c, manual, fresh, done: !!accepted }; });
  }
  function reviewKey(item) { return fingerprint(item) + JSON.stringify(item.guided.checks); }
  function blockers(item) {
    if (!item.guided) return [];
    const pending = requirements(item).filter(r => !r.done).map(r => r.title);
    if (item.guided.attestation?.userId !== 'marina' || item.guided.attestation?.key !== reviewKey(item)) pending.push('Conferência final da advogada');
    return pending;
  }
  function review(item, id, status, reason, userId, now = Date.now()) {
    const r = requirements(item).find(r => r.id === id);
    if (!r || !['pending', 'checked', 'na', 'exception'].includes(status)) return false;
    if ((status === 'na' && !r.optional) || (status === 'exception' && !r.exception)) return false;
    item.guided.checks[id] = { status, reason: String(reason || '').slice(0, 2000), userId, at: new Date(now).toISOString(), fingerprint: fingerprint(item) };
    item.guided.attestation = null; return true;
  }
  function create(base, id, type, now = Date.now()) {
    if (!types[type]) throw new Error('Tipo de peça desconhecido.');
    const item = clone(base);
    delete item.editorMode; delete item.sectionArchive; delete item.fullDocument; delete item.fullDocumentArchive; delete item.documentProjection;
    item.documentLinks = [];
    Object.assign(item, { id, title: `${types[type]} — ${base.client}`, documentTitle: types[type], status: 'working', comments: [], versions: [], events: [], checks: [false, false, false], sections: templates(type), updatedAt: new Date(now).toISOString() });
    item.guided = { type, fields: { juizo: '', processo: '', autor: '', reu: '', acao: '', representacao: '', valor: '', conciliacao: '', localData: '', assinatura: '' }, checks: {}, notes: '', annexes: '', attestation: null, sourceId: base.id };
    item.internalSections = clone(base.internalSections || []);
    item.guided.notes = base.sections.map(s => s.title + '\n' + s.text).join('\n\n');
    return item;
  }
  function upgrade(state, now = Date.now()) {
    // Tag internal text without deleting it or rewriting historical snapshots.
    for (const item of state.cases) if (!item.guided) for (const s of item.sections) if (['analise', 'encaminhamento'].includes(s.id)) s.scope = 'internal';
    if (state.guidedExamples === 1) return state;
    for (const [type, name, client] of [['initial', 'Restituição de caução — exemplo guiado', 'Bruno Exemplo'], ['defense', 'Defesa em cobrança — exemplo guiado', 'Oficina Modelo — fictícia']]) {
      const base = state.cases.find(c => c.id === 'ELO-004') || state.cases[0];
      const n = Math.max(...state.cases.map(c => Number(c.id.replace('ELO-', '')) || 0)) + 1;
      const item = create(base, `ELO-${String(n).padStart(3, '0')}`, type, now);
      Object.assign(item, { title: name, client, ownerId: type === 'initial' ? 'lucas' : 'clara', area: 'Cível', instructions: 'Confira os dados fictícios, desenvolva os fundamentos e os pedidos e registre a revisão dos requisitos antes da aprovação.', docs: [] });
      item.guided.sourceId = ''; item.guided.notes = 'Exemplo incompleto para exercitar a conferência. Validar os dados de qualificação, a documentação e a fundamentação antes da aprovação.';
      item.guided.fields = { ...item.guided.fields, juizo: 'Ao Juízo da Vara Cível da Comarca Exemplo — SP (fictícia)', autor: type === 'initial' ? 'Bruno Exemplo, brasileiro, solteiro, designer, sem união estável, residente na Rua Modelo, 100, Comarca Exemplo/SP; e-mail: bruno@example.invalid. CPF: dado fictício não informado.' : 'Empresa Alfa — fictícia, pessoa jurídica com sede na Rua Exemplo, 20, Comarca Exemplo/SP; e-mail: alfa@example.invalid. CNPJ: dado fictício não informado.', reu: type === 'initial' ? 'Locadora Exemplo — fictícia, pessoa jurídica com sede na Rua Modelo, 200, Comarca Exemplo/SP; e-mail: locadora@example.invalid. CNPJ: dado fictício não informado.' : 'Oficina Modelo — fictícia, pessoa jurídica com sede na Rua Modelo, 30, Comarca Exemplo/SP; e-mail: oficina@example.invalid. CNPJ: dado fictício não informado.', acao: type === 'initial' ? 'Ação de restituição de caução' : '', processo: type === 'defense' ? 'Processo demonstrativo — sem número judicial válido' : '', valor: type === 'initial' ? 'R$ 3.000,00' : '', conciliacao: type === 'initial' ? 'O autor manifesta interesse na realização de audiência de conciliação ou mediação.' : '', representacao: 'A parte é representada por Marina Exemplo, advogada fictícia.', localData: 'Comarca Exemplo, 18 de outubro de 2026.', assinatura: 'Marina Exemplo\nOAB/UF: identificação fictícia não cadastrada' };
      const texts = type === 'initial' ? { fatos: 'O autor celebrou contrato de locação e entregou caução de R$ 3.000,00. Após a devolução das chaves, relata que o valor não foi restituído. A locadora alega danos no imóvel. O caso e todos os dados deste exemplo são fictícios.', pedidos: 'Requer a citação da ré e a restituição da caução de R$ 3.000,00.', provas: 'Pretende demonstrar a entrega da caução e a devolução das chaves por documentos, conforme a relação de documentos desta minuta.' } : { sintese: 'A autora pretende receber R$ 2.500,00 por serviços de manutenção. A ré afirma ter pago integralmente o valor. Trata-se de situação fictícia.', impugnacao: 'A ré admite a contratação do serviço e controverte a alegação de inadimplemento. Sustenta que realizou o pagamento em 10/10/2026, no valor de R$ 2.500,00, conforme o comprovante de pagamento indicado na relação de documentos.', pedidos: 'Requer o acolhimento da defesa e a improcedência da cobrança.', provas: 'Pretende produzir prova documental do pagamento e de sua correspondência com o serviço cobrado.' };
      for (const s of item.sections) s.text = texts[s.id] || '';
      item.narrative = texts.fatos || texts.sintese;
      item.guided.annexes = type === 'initial' ? '01 — Contrato de locação (documento fictício)\n02 — Comprovante da caução (documento fictício)\n03 — Termo de entrega das chaves (documento fictício)' : '01 — Contrato de prestação de serviços (documento fictício)\n02 — Comprovante de pagamento (documento fictício)';
      item.events.push({ text: 'Exemplo de construção guiada criado. Conferência ainda pendente.', userId: 'marina', at: new Date(now).toISOString() });
      state.cases.push(item);
    }
    state.guidedExamples = 1; return state;
  }
  return { CPC, types, templates, finalSections, document, fingerprint, requirements, reviewKey, blockers, review, create, upgrade };
});
