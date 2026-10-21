(() => {
  'use strict';
  const M=window.EloReview,e=M.escape;
  const btn=(label,action,extra='',cls='secondary')=>`<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const code=c=>'ELO-'+String(c.number).padStart(4,'0');
  const day=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'Sem prazo interno';
  const when=d=>d?new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
  const names={working:'Em elaboração',review:'Para revisar',changes:'Ajustes solicitados',approved:'Aprovada'};
  const kinds={question:'Dúvida',adjustment:'Ajuste solicitado',note:'Observação'};
  const errors='<div class="form-error" role="alert" tabindex="-1" hidden></div>';
  const person=(ctx,id)=>ctx.members.find(m=>m.user_id===id)?.display_name||'A definir';
  function list(ctx){
    const items=M.select(ctx.cases,{...ctx,userId:ctx.user.id});
    if(!items.length)return '<section class="review-empty"><h2>Nenhuma entrega nesta seleção.</h2><p>Altere o filtro ou a busca para consultar outras peças.</p></section>';
    const matters=new Map(ctx.matters.map(m=>[m.id,m.name])),signals=new Map(ctx.signals.map(s=>[s.case_id,s]));
    return items.map(c=>{
      const signal=signals.get(c.id)||{};
      const action=c.status==='review'?(ctx.personal?'Acompanhar revisão':'Revisar peça'):c.status==='changes'?(ctx.personal?'Ajustar peça':'Conferir ajustes'):c.status==='approved'?'Consultar peça':'Continuar peça';
      return `<article class="review-card">
        <div class="review-card-main"><div class="eyebrow">${e(code(c))} · ${e(c.area)} ${signal.unread?'<span class="review-new">Atualização</span>':''}</div>
        <a href="#trabalho/${e(c.id)}" data-route="trabalho/${e(c.id)}"><h2>${e(c.title)}</h2></a>
        <p>${e(c.client_name)}${matters.has(c.matter_id)?' · Caso: '+e(matters.get(c.matter_id)):''}</p>
        <div class="review-card-signals">${Number(signal.questions)?`<span>${signal.questions} dúvida(s) aberta(s)</span>`:''}${Number(signal.addressed)?`<span>${signal.addressed} ajuste(s) para conferir</span>`:''}${Number(signal.blocked_questions)?'<strong>Elaboração depende de orientação</strong>':''}</div></div>
        <div class="review-card-people"><small>ELABORAÇÃO</small><p>${e(person(ctx,c.assignee_id))}</p>${ctx.enabled?`<small>REVISÃO</small><p>${e(person(ctx,c.reviewer_id))}</p>`:''}</div>
        <div class="review-card-time"><span class="status">${e(names[c.status])}</span><p class="${M.overdue(c)?'review-overdue':''}">${M.overdue(c)?'Prazo interno vencido · ':''}${e(day(M.deadline(c)))}</p>${c.review_requested_at&&c.status==='review'?`<small>${e(M.waitingSince(c.review_requested_at))}</small>`:''}${c.priority==='high'?`<details><summary>Prioridade alta</summary><p>${e(c.priority_reason)}</p></details>`:''}</div>
        <a class="button secondary" href="#trabalho/${e(c.id)}" data-route="trabalho/${e(c.id)}">${action} →</a>
      </article>`;
    }).join('');
  }
  function dashboard(ctx){
    const count=filter=>M.select(ctx.cases,{...ctx,filter,userId:ctx.user.id,search:''}).length;
    const filters=ctx.personal?[['all','Todas'],['working','Para elaborar'],['changes','Ajustes'],['waiting','Aguardando retorno'],['approved','Aprovadas']]:
      [['all','Todas'],['mine',ctx.enabled?'Minha revisão':'Para revisar'],...(ctx.enabled?[['questions','Dúvidas'],['updates','Atualizações']]:[]),['changes','Em ajuste'],['overdue','Prazo vencido']];
    return `<div class="page-heading"><div><div class="eyebrow">${e(ctx.office.name)} · ${ctx.personal?'SUAS ENTREGAS':'REVISÃO E ACOMPANHAMENTO'}</div>
      <h1>${ctx.personal?'Clareza para avançar.':ctx.view==='casos'?'Casos e peças.':'Sua atenção, no próximo passo.'}</h1>
      <p>${ctx.personal?'Elabore suas peças, acompanhe os ajustes e veja o que aguarda orientação.':'Reúna as decisões, acompanhe as entregas e revise com contexto.'}</p></div>
      ${btn(ctx.personal?'Nova peça +':'Nova peça +','newCase',ctx.personal&&!ctx.filesEnabled?'disabled title="A criação será liberada após a atualização do escritório"':'','primary')}</div>
      <div class="review-metrics">${(ctx.personal?[['working','Para elaborar'],['changes','Ajustes solicitados'],['waiting','Aguardando retorno']]:[['mine','Para revisar'],[ctx.enabled?'questions':'changes',ctx.enabled?'Dúvidas abertas':'Ajustes solicitados'],['overdue','Prazo interno vencido']]).map(([key,label])=>`<button type="button" data-action="reviewFilter" data-filter="${key}" class="review-metric"><span>${label}</span><strong>${count(key)}</strong><small>Ver entregas →</small></button>`).join('')}</div>
      <div class="review-queue-heading"><div><h2>${ctx.personal?'Seu trabalho em andamento':'Central de revisão'}</h2><p>Prazos vencidos, prioridade e prazo interno orientam a fila.</p></div>${btn('Atualizar','refresh','','text-button')}</div>
      <div class="review-filters" role="group" aria-label="Filtrar entregas">${filters.map(([key,label])=>`<button type="button" data-action="reviewFilter" data-filter="${key}" aria-pressed="${ctx.filter===key}">${label} <span>${count(key)}</span></button>`).join('')}</div>
      <label class="sr-only" for="caseSearch">Buscar peças</label><input class="shared-input review-search" id="caseSearch" type="search" placeholder="Buscar peça, caso, cliente ou responsável" value="${e(ctx.search)}">
      <div id="caseList" class="review-list">${list(ctx)}</div>
      <p class="form-help review-footnote">Prazos de organização interna, informados pela equipe. Combine a entrega e o retorno da revisão com os responsáveis.</p>`;
  }
  function options(ctx,c){
    if(!ctx.enabled)return '';
    const assignee=c?.assignee_id||ctx.user.id,reviewer=c?.reviewer_id||(ctx.personal?ctx.office.responsible_user_id:'');
    return `<fieldset class="review-form-section"><legend>Organização da entrega</legend>
      <div class="form-row"><label>Advogado responsável pela revisão<select name="reviewer_id"><option value="">Definir antes de enviar</option>${ctx.members.filter(m=>!m.removed_at&&['admin','reviewer'].includes(m.role)).map(m=>`<option value="${e(m.user_id)}" ${m.user_id===assignee?'disabled':''} ${m.user_id===reviewer&&m.user_id!==assignee?'selected':''}>${e(m.display_name)}</option>`).join('')}</select><span class="form-help">Quem elabora não aprova a própria entrega.</span></label>
      <label>Retorno da revisão até<input type="date" name="review_due_date" value="${e(c?.review_due_date)}"><span class="form-help">Combine este prazo interno com o revisor.</span></label></div>
      ${ctx.personal?'<input type="hidden" name="priority" value="normal">':`<div class="form-row"><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high" ${c?.priority==='high'?'selected':''}>Alta</option></select></label><label>Motivo da prioridade<input name="priority_reason" maxlength="600" value="${e(c?.priority_reason)}" placeholder="Necessário quando a prioridade é alta"></label></div>`}
      <label>Caso relacionado<select name="matter_id"><option value="">Peça independente</option>${ctx.matters.map(m=>`<option value="${m.id}" ${c?.matter_id===m.id?'selected':''}>${e(m.name)}</option>`).join('')}</select></label>
      <label>Ou criar um caso para agrupar peças<input name="matter_name" maxlength="180" placeholder="Ex.: Contrato de prestação de serviços"><span class="form-help">Use um caso existente ou informe um novo nome. Cada peça mantém sua própria revisão.</span></label>
    </fieldset>`;
  }
  function brief(ctx){
    if(!ctx.enabled||!ctx.rounds.length)return '';
    const r=ctx.rounds[0];
    return `<section class="review-brief" aria-label="Resumo da entrega"><div class="eyebrow">RODADA ${r.round_number} · ${e(when(r.submitted_at))}</div><h2>O que conferir nesta entrega</h2><p class="form-help">${e(window.EloDelivery.label(r,ctx.attachments||[]))}</p>${r.attachment_id?btn('Baixar arquivo entregue','downloadFile',`data-id="${r.attachment_id}"`):''}<p>${e(r.summary)}</p>${r.attention?`<div class="review-attention"><strong>Pontos de atenção</strong><p>${e(r.attention)}</p></div>`:''}<div class="review-brief-footer"><span>Revisor: ${e(person(ctx,r.completed_at?r.reviewer_id:ctx.selected.reviewer_id))}</span>${btn('Comparar alterações','compareVersions','','text-button')}</div></section>`;
  }
  function commentFields(ctx){
    return ctx.enabled?`<label>Tipo de assunto<select name="kind"><option value="question">Dúvida</option>${ctx.personal?'':'<option value="adjustment">Ajuste solicitado</option>'}<option value="note">Observação</option></select></label><label class="checkbox-label review-blocks"><input type="checkbox" name="blocks_work"> Preciso desta resposta para avançar</label>`:'';
  }
  function conversation(ctx){
    const c=ctx.selected,canResolve=ctx.role==='admin'||ctx.role==='reviewer'&&(!c.reviewer_id||c.reviewer_id===ctx.user.id);
    const all=M.threads(ctx.comments),filter=ctx.commentFilter||'all',shown=all.filter(t=>filter==='all'||filter==='open'&&!t.resolved_at||filter==='adjustment'&&!t.resolved_at&&t.kind==='adjustment'||filter==='question'&&!t.resolved_at&&t.kind==='question');
    const tools='<div class="review-thread-tools" role="group" aria-label="Filtrar conversa">'+[['open','Pendentes'],['adjustment','Ajustes'],['question','Dúvidas'],['all','Todos']].map(([key,label])=>btn(label,'commentFilter','data-filter="'+key+'" aria-pressed="'+(filter===key)+'"','text-button')).join('')+btn('Próximo pendente','nextPending','','text-button')+'</div>';
    return tools+(shown.map(t=>`<article tabindex="-1" data-thread-id="${t.id}" class="shared-comment review-thread ${t.resolved_at?'resolved':''}">
      <div class="comment-author"><strong>${e(person(ctx,t.author_id))}</strong><small>${e(kinds[t.kind]||'Observação')}</small></div>
      ${t.quote?`<blockquote>${e(t.quote)}</blockquote><small>Referência da revisão ${t.document_revision}; confira se o trecho mudou.</small>${!t.reference_attachment_id?btn('Localizar trecho','locateQuote',`data-id="${t.id}"`,'text-button'):''}`:''}${t.reference_attachment_id?`<div class="review-file-reference"><small>Referência: ${e(ctx.attachments?.find(a=>a.id===t.reference_attachment_id)?.display_name||'Arquivo preservado')}</small>${btn('Baixar arquivo referenciado','downloadFile',`data-id="${t.reference_attachment_id}"`,'text-button')}</div>`:''}
      <p>${e(t.body)}</p><small>${e(when(t.created_at))}</small>
      <div class="review-thread-state">${t.resolved_at?'<span>Resolvido</span>':`${t.blocking?'<span>Impede aprovação</span>':''}${t.blocks_work?'<span>Aguarda orientação para avançar</span>':''}${t.addressed_at?'<strong>Atendido pelo autor · conferir</strong>':''}`}</div>
      <div class="review-replies">${t.replies.map(r=>`<div class="review-reply"><strong>${e(person(ctx,r.author_id))}</strong><p>${e(r.body)}</p><small>${e(when(r.created_at))}</small></div>`).join('')}</div>
      ${c.status!=='approved'?`<div class="review-thread-actions">${btn('Responder','replyThread',`data-id="${t.id}"`,'text-button')}${!t.resolved_at&&t.kind==='adjustment'&&c.assignee_id===ctx.user.id&&['working','changes'].includes(c.status)?btn(t.addressed_at?'Ainda preciso ajustar':'Marcar como atendido','addressThread',`data-id="${t.id}" data-addressed="${!t.addressed_at}"`,'text-button'):''}${canResolve?btn(t.resolved_at?'Reabrir':'Confirmar resolução','resolve',`data-id="${t.id}" data-resolved="${!t.resolved_at}"`,'text-button'):''}</div>`:''}
    </article>`).join('')||'<p class="form-help">Nenhum assunto nesta seleção. Use Todos para consultar o histórico.</p>');
  }
  function deliveryForm(ctx){
    const c=ctx.selected;
    return `<form id="deliveryForm" class="shared-form"><div class="review-recipient"><small>DESTINO DA REVISÃO</small><strong>${e(person(ctx,c.reviewer_id))}</strong><span>${e(day(c.review_due_date))}</span></div>
      ${!c.reviewer_id?'<p class="shared-callout">Defina um advogado revisor no contexto da peça antes de enviar.</p>':''}
      <div class="shared-callout"><strong>Conteúdo a revisar:</strong> ${e(c.delivery_source==='file'?ctx.attachments.find(a=>a.id===c.primary_attachment_id)?.display_name||'Arquivo principal':'Texto do editor')}</div><label>Resumo da entrega<textarea name="summary" required minlength="2" maxlength="2000" placeholder="O que foi preparado? Se é uma nova rodada, quais ajustes você realizou?"></textarea></label>
      <label>Pontos que precisam de atenção <span class="form-help">Opcional</span><textarea name="attention" maxlength="2000" placeholder="Destaque decisões pendentes, trechos ou documentos que o revisor deve conferir."></textarea></label>
      <p class="form-help">O envio preserva uma versão e coloca a minuta em leitura até a devolutiva.</p>${errors}
      <div class="form-actions">${btn('Cancelar','close')}<button type="submit" class="button primary" ${!c.reviewer_id?'disabled':''}>Enviar para revisão →</button></div></form>`;
  }
  function replyForm(ctx,parent){
    const canResolve=ctx.role==='admin'||ctx.role==='reviewer'&&(!ctx.selected.reviewer_id||ctx.selected.reviewer_id===ctx.user.id);
    return `<form id="replyForm" class="shared-form" data-parent="${parent.id}"><blockquote class="review-question">${e(parent.body)}</blockquote><label>Resposta<textarea name="body" required maxlength="4000"></textarea></label>${canResolve&&!parent.resolved_at?'<label class="checkbox-label"><input type="checkbox" name="resolve"> Esta resposta resolve o assunto</label>':''}${errors}<div class="form-actions">${btn('Cancelar','close')}<button type="submit" class="button primary">Registrar resposta</button></div></form>`;
  }
  function comparison(ctx){
    const base=(['working','changes'].includes(ctx.selected.status)?ctx.rounds[0]?.version_id:ctx.rounds[1]?.version_id)||ctx.versions[0]?.id;
    return `<div class="shared-form"><p>${ctx.selected.delivery_source==='file'?'Confira o arquivo de cada entrega. Os originais podem ser baixados para revisão.':'Compare uma versão preservada com o texto atual. Inclusões são sublinhadas; exclusões aparecem riscadas.'}</p><label>Versão de referência<select id="compareVersion">${ctx.versions.map(v=>`<option value="${v.id}" ${v.id===base?'selected':''}>${e(v.label)} · revisão ${v.revision} · ${e(when(v.created_at))}</option>`).join('')}</select></label><div id="reviewDiff" class="review-diff" role="region" aria-label="Alterações entre versões">Carregando comparação…</div><p class="form-help">Confira também a formatação e o documento completo antes de aprovar.</p><div class="form-actions">${btn('Fechar','close')}</div></div>`;
  }
  function contextDetails(ctx){
    if(!ctx.enabled)return '';
    const c=ctx.selected;
    return `<dl class="context-values"><div><dt>Revisão</dt><dd>${e(person(ctx,c.reviewer_id))}</dd></div><div><dt>Retorno combinado</dt><dd>${e(day(c.review_due_date))}</dd></div><div><dt>Caso relacionado</dt><dd>${e(ctx.matters.find(m=>m.id===c.matter_id)?.name||'Peça independente')}</dd></div><div><dt>Prioridade</dt><dd>${c.priority==='high'?'Alta · '+e(c.priority_reason):'Normal'}</dd></div></dl>`;
  }
  function roundHistory(ctx){
    if(!ctx.enabled||!ctx.rounds.length)return '';
    return `<section class="shared-panel review-rounds"><h2>Rodadas de revisão</h2><ul class="shared-history">${ctx.rounds.map(r=>`<li><strong>Rodada ${r.round_number} · ${r.outcome==='approved'?'Aprovada':r.outcome==='changes'?'Ajustes solicitados':'Aguardando devolutiva'}</strong><small>${e(when(r.submitted_at))} · revisão de ${e(person(ctx,r.reviewer_id))}</small><p>${e(r.summary)}</p><small>${e(window.EloDelivery.label(r,ctx.attachments||[]))}</small>${r.attachment_id?btn('Baixar arquivo da rodada','downloadFile',`data-id="${r.attachment_id}"`):''}${r.attention?`<p><strong>Pontos de atenção:</strong> ${e(r.attention)}</p>`:''}</li>`).join('')}</ul></section>`;
  }
  function pilotForm(entry={}){
    return `<form id="pilotForm" class="shared-form"><p>Registre os tempos observados com a dupla. Tempo com a página aberta não é tempo de trabalho.</p>
      <label>Modo de trabalho<select name="mode"><option value="elojus">Com EloJus</option><option value="baseline" ${entry.mode==='baseline'?'selected':''}>Referência anterior / fora da EloJus</option></select></label>
      <div class="form-row"><label>Elaboração (minutos ativos)<input type="number" name="drafting_minutes" min="0" max="100000" required value="${e(entry.drafting_minutes)}"></label><label>Revisão (minutos ativos)<input type="number" name="review_minutes" min="0" max="100000" required value="${e(entry.review_minutes)}"></label></div>
      <div class="form-row"><label>Contatos por fora da plataforma<input type="number" name="external_contacts" min="0" max="10000" required value="${e(entry.external_contacts)}"></label><label>Qualidade percebida (1 a 5)<input type="number" name="quality_score" min="1" max="5" required value="${e(entry.quality_score)}"></label></div>
      <label>Observações da dupla<textarea name="notes" maxlength="1000" placeholder="Complexidade, dificuldades ou situações que afetaram os tempos.">${e(entry.notes)}</textarea></label>${errors}<div class="form-actions">${btn('Cancelar','close')}<button type="submit" class="button primary">Salvar registro do piloto</button></div></form>`;
  }
  function metrics(ctx){
    const m=M.metrics(ctx.allRounds),group=mode=>ctx.pilot.filter(p=>p.mode===mode),average=(items,key)=>items.length?(items.reduce((a,x)=>a+Number(x[key]),0)/items.length).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
    return `<div class="page-heading"><div><div class="eyebrow">${e(ctx.office.name)} · ACOMPANHAMENTO DO PILOTO</div><h1>Medir para melhorar.</h1><p>Espera por retorno e esforço da dupla são medidas diferentes.</p></div></div>
      ${!ctx.enabled?'<section class="shared-panel"><h2>Indicadores em preparação.</h2><p>Os registros de rodadas e do piloto dependem da ativação do novo fluxo.</p></section>':`<div class="review-metrics"><div class="review-metric"><span>Entregas registradas</span><strong>${m.deliveries}</strong></div><div class="review-metric"><span>Mediana até primeiro retorno</span><strong>${m.medianResponseMinutes===null?'—':Math.round(m.medianResponseMinutes)+' min'}</strong><small>${m.responded} entrega(s) com retorno observado</small></div><div class="review-metric"><span>Devoluções para ajuste</span><strong>${m.returned}</strong></div></div>
      <div class="review-metrics review-cycle-metrics"><div class="review-metric"><span>Mediana até decisão da rodada</span><strong>${m.medianDecisionMinutes===null?'—':Math.round(m.medianDecisionMinutes)+' min'}</strong><small>${m.completed} rodada(s) concluída(s)</small></div><div class="review-metric"><span>Primeira entrega até aprovação</span><strong>${m.medianCycleMinutes===null?'—':Math.round(m.medianCycleMinutes)+' min'}</strong><small>Mediana · ${m.approvedCases} peça(s) aprovada(s)</small></div><div class="review-metric"><span>Rodadas sem decisão</span><strong>${m.pending}</strong><small>${m.oldestPendingMinutes===null?'Sem espera pendente':'Maior espera: '+Math.round(m.oldestPendingMinutes)+' min'}</small></div></div><p class="form-help">Tempos corridos, incluindo noites e fins de semana. A primeira resposta pode ser um comentário; a decisão é a aprovação ou devolução para ajuste. Peças ainda não aprovadas não entram na mediana do ciclo.</p><section class="shared-panel"><h2>Observações da dupla</h2><p>Registre os dados em cada peça, na aba “Versões e atividade”.</p><div class="review-table-wrap"><table class="review-table"><thead><tr><th>Grupo</th><th>Registros</th><th>Elaboração média</th><th>Revisão média</th><th>Contatos externos</th><th>Qualidade</th></tr></thead><tbody>${[['baseline','Referência anterior'],['elojus','Com EloJus']].map(([key,title])=>{const rows=group(key);return `<tr><th>${title}</th><td>${rows.length}</td><td>${average(rows,'drafting_minutes')} min</td><td>${average(rows,'review_minutes')} min</td><td>${average(rows,'external_contacts')}</td><td>${average(rows,'quality_score')} / 5</td></tr>`;}).join('')}</tbody></table></div><p class="form-help">Dados declarados e amostras possivelmente diferentes. Estes valores não demonstram causalidade nem uma economia comprovada de tempo. Compare entregas de complexidade semelhante e preserve a qualidade.</p></section>`}`;
  }
  window.EloReviewUI={dashboard,list,options,brief,commentFields,conversation,deliveryForm,replyForm,comparison,contextDetails,roundHistory,pilotForm,metrics};
})();
