(async () => {
  'use strict';
  const A=window.EloAuth,S=window.EloShared,R=window.EloRich,E=window.EloEditor,P=window.EloPages,T=window.EloTeam,F=window.EloCaseFiles,M=window.EloReview,U=window.EloReviewUI,W=window.EloWritingFiles,D=window.EloDelivery;
  const user=await A.requireUser(); if(!user)return;
  document.documentElement.removeAttribute('data-session-required');
  const $=s=>document.querySelector(s),e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roles=T.roles;
  let drafts=null,alerts=null,recoveries=[],restoring=null,draftWarning=false;
  try{drafts=window.EloDrafts.create(localStorage,user.id,crypto.randomUUID());alerts=window.EloNotices.create(localStorage,user.id);}catch{}
  function localCopy(s){
    if(!drafts)return;
    try{if(s.dirty)drafts.put(s.row,s.draft);else if(!s.busy){drafts.saved(s.row);if(restoring){drafts.remove(restoring);restoring=null;}recoveries=drafts.list(s.row).filter(d=>!R.equal({delta:d.document},{delta:s.row.document}));}}
    catch{if(!draftWarning){draftWarning=true;notify('O navegador não conseguiu guardar a cópia de recuperação. Salve no escritório ou baixe seu rascunho.');}}
  }
  function recoveryBanner(){return recoveries.length?'<section class="recovery-banner"><strong>Há um rascunho local para conferir.</strong><p>Uma cópia de '+e(when(recoveries[0].at))+' difere do texto salvo no escritório.</p>'+button('Conferir rascunho','reviewRecovery')+'</section>':'';}
  function showRecovery(){const d=recoveries[0];if(!d)return;dialog('Recuperar rascunho local','<p>Cópia deste navegador, criada na revisão '+e(d.baseRevision)+'. Confira antes de substituir o texto atual.</p><div class="recovery-preview rich-preview">'+R.html({delta:d.document})+'</div><p class="form-help">Cópias não salvas expiram após 7 dias e são removidas ao sair da conta neste navegador.</p><div class="form-actions">'+button('Baixar cópia · TXT','downloadRecovery')+(canEdit()&&selected.delivery_source!=='file'?button('Restaurar no editor','restoreRecovery','primary'):'')+button('Descartar esta cópia','discardRecovery')+'</div>');}
  async function showUpdates(){
    if(!office)return;const id=office.id;
    const [rows,updates]=await Promise.all([S.cases(id),S.signals(id)]);if(office?.id!==id)return;
    const pending=alerts?.pending(rows,updates)||rows.filter(c=>updates.some(s=>s.case_id===c.id&&s.unread));
    const state=alerts?.read()||{},permission=typeof Notification==='undefined'?'unsupported':Notification.permission;
    dialog('Atualizações do escritório','<p>'+pending.length+' peça(s) com atividade ainda não lida.</p><ul class="notice-list">'+pending.map(c=>'<li><a href="#trabalho/'+e(c.id)+'" data-route="trabalho/'+e(c.id)+'">'+e(c.title)+' →</a><small>'+e(statuses[c.status])+' · '+e(when(c.review_activity_at))+'</small></li>').join('')+'</ul><div class="notice-settings"><h3>Avisos no navegador</h3><p>Avisos agrupados enquanto a EloJus estiver aberta. Eles mostram apenas a quantidade de atualizações, sem nomes de clientes ou trechos de documentos.</p><label>Intervalo mínimo entre avisos<select id="alertInterval"><option value="5">5 minutos</option><option value="15" '+(state.minutes===15?'selected':'')+'>15 minutos</option><option value="30" '+(state.minutes===30?'selected':'')+'>30 minutos</option></select></label><p class="form-help">'+(permission==='unsupported'?'Este navegador não oferece notificações.':permission==='denied'?'Permissão bloqueada nas configurações do navegador.':state.enabled?'Avisos ativados neste navegador.':'Avisos opcionais, desativados por padrão.')+'</p>'+button(state.enabled?'Desativar avisos':'Ativar avisos','toggleAlerts','secondary',permission==='unsupported'||permission==='denied'?'disabled':'')+'<p class="form-help">Sem aviso com a aplicação fechada. O envio por e-mail será configurado junto ao serviço remetente.</p></div>');
  }
  let checkingAlerts=false;
  async function checkAlerts(){
    if(checkingAlerts||!sessionValid||!office||!reviewFeatures||!alerts?.read().enabled||typeof Notification==='undefined'||Notification.permission!=='granted')return;
    checkingAlerts=true;const id=office.id;
    try{const [rows,updates]=await Promise.all([S.cases(id),S.signals(id)]);if(!sessionValid||office?.id!==id)return;const count=alerts.claim(id,rows,updates);if(count){const n=new Notification('EloJus · atualizações da equipe',{body:count+' peça(s) com novidades. Abra a EloJus para conferir.',tag:'elojus-'+id});n.onclick=()=>{window.focus();n.close();showUpdates().catch(()=>{});};}}catch{}finally{checkingAlerts=false;}
  }
  const storageName=S.storageLabel||'Supabase';
  const demo=window.EloDemo,preview=window.EloDemoPreview;
  const statuses={working:'Em elaboração',review:'Para revisar',changes:'Ajustes solicitados',approved:'Aprovado internamente'};
  const initials=name=>String(name).split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const when=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
  const day=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'Sem data definida';
  const code=c=>'ELO-'+String(c.number).padStart(4,'0');
  const button=(text,action,cls='secondary',extra='')=>`<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${text}</button>`;
  const errorBox='<div class="form-error" role="alert" tabindex="-1" hidden></div>';
  let offices=[],office=null,members=[],cases=[],invites=[],selected=null,comments=[],versions=[],activity=[],attachments=[];
  let features=false,reviewFeatures=false,deliveryFeatures=false,pendingThread=-1,commentFilter='open',reviewFilter='all',matters=[],signals=[],rounds=[],allRounds=[],pilot=[],mutation=false,pendingFiles=[],retryAttachment=null;
  let teamTab='active',teamQuery='',teamType='all';
  let view='inicio',tab='document',queue=null,editorItem=null,saveTimer,noticeTimer,loading=false,polling=false,search='',latestRemote=null,sessionValid=true;
  const member=id=>members.find(m=>m.user_id===id);
  const role=()=>member(user.id)?.removed_at?null:member(user.id)?.role;
  const personal=()=>role()==='collaborator';
  const manager=()=>['admin','reviewer'].includes(role());
  const canDecide=()=>manager()&&(!reviewFeatures||selected?.assignee_id!==user.id&&(role()==='admin'||selected?.reviewer_id===user.id));
  const canEdit=()=>selected&&selected.status!=='approved'&&(manager()||(selected.assignee_id===user.id&&['working','changes'].includes(selected.status)));
  const badge=c=>`<span class="status status-${e(c.status)}">${e(statuses[c.status])}</span>`;
  const activeMembers=()=>members.filter(m=>!m.removed_at);
  function notify(text){$('#notice').textContent=text;$('#notice').classList.add('shown');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('shown'),6500);}
  function connection(text){$('#connectionStatus').textContent=text;}
  function formError(form,error){const node=form.querySelector('.form-error');node.textContent=S.message(error);node.hidden=false;node.focus();}
  function busy(form,value){form.setAttribute('aria-busy',String(value));form.querySelectorAll('input,select,textarea,button').forEach(n=>{if(value){n.dataset.wasDisabled=String(n.disabled);n.disabled=true;}else{n.disabled=n.dataset.wasDisabled==='true';delete n.dataset.wasDisabled;}});}
  function teardown(){clearTimeout(saveTimer);P.unmount();E.unmount();}
  function dialog(title,content){const d=$('#workspaceDialog');if(d.open)d.close();d.innerHTML=`<div class="dialog-heading"><h2 id="dialogTitle">${e(title)}</h2>${button('×','close','','aria-label="Fechar janela"')}</div><div class="dialog-content">${content}</div>`;d.setAttribute("aria-labelledby","dialogTitle");d.showModal();}
  function officeHeader(){
    const launch=$('[data-action="previewSara"]');
    if(launch)launch.hidden=!demo?.canLaunch(location,role(),preview);
    if($('#demoPreview'))$('#demoPreview').innerHTML=demo?.banner(preview)||'';
    const updates=$('[data-action="updates"]');if(updates){updates.hidden=!reviewFeatures;const count=signals.filter(x=>x.unread).length;updates.textContent='Atualizações'+(count?' ('+count+')':'');}
    if(preview){
      $('[data-action="logout"]').hidden=true;
      $('.sidebar-bottom').hidden=true;
    }
    document.querySelector('nav [data-route="casos"]').textContent=personal()?'▤   Minhas peças':'▤   Casos do escritório';
    document.querySelector('nav [data-route="revisoes"]').hidden=personal();
    document.querySelector('nav [data-route="equipe"]').hidden=personal();
    document.querySelector('nav [data-route="revisoes"]').textContent='✓   Central de revisão';
    let metricsLink=document.querySelector('nav [data-route="indicadores"]');
    if(!metricsLink){metricsLink=document.createElement('a');metricsLink.href='#indicadores';metricsLink.dataset.route='indicadores';metricsLink.className='side-nav';metricsLink.textContent='▥   Indicadores do piloto';$('#sidebarNav').append(metricsLink);}
    metricsLink.hidden=personal();
    $('#accountName').textContent=A.displayName();$('#accountAvatar').textContent=initials(A.displayName());
    $('#officeName').textContent=office?.name||'Seu escritório';$('#officeRole').textContent=preview?.persona==='intern'?'Estagiária · demonstração':roles[role()]||'Sem escritório ativo';$('#officeAvatar').textContent=initials(office?.name||'EloJus');
    const select=$('#officeSelect');select.hidden=offices.length<2;select.innerHTML=offices.map(o=>`<option value="${e(o.id)}" ${o.id===office?.id?'selected':''}>${e(o.name)}</option>`).join('');
    for(const n of document.querySelectorAll('nav [data-route]'))n.classList.toggle('active',n.dataset.route===view);
    $('#viewLabel').textContent=({inicio:'Minha mesa',casos:'Casos',revisoes:'Central de revisão',indicadores:'Indicadores do piloto',equipe:'Equipe do escritório',trabalho:'Caso',convite:'Convite'})[view]||'Minha mesa';
  }
  async function loadOffice(id){
    const capabilities=await S.capabilities();features=capabilities.version>=23;reviewFeatures=capabilities.version>=24;deliveryFeatures=capabilities.version>=25;
    offices=await S.offices();office=offices.find(o=>o.id===id)||offices[0]||null;
    if(!office){members=[];cases=[];matters=[];signals=[];allRounds=[];pilot=[];return;}
    [members,cases,matters,signals]=await Promise.all([S.members(office.id),S.cases(office.id),reviewFeatures?S.matters(office.id):[],reviewFeatures?S.signals(office.id):[]]);
    if(view==='indicadores'&&reviewFeatures&&!personal())[allRounds,pilot]=await Promise.all([S.allRounds(office.id),S.pilot(office.id)]);
    if(!role())throw Object.assign(new Error('access_denied'),{code:'42501'});
    invites=role()==='admin'?await S.invitations(office.id):[];
    connection('Conectado · dados do escritório sincronizados');
  }
  function noOffice(){return `<section class="shared-panel shared-invite-page"><div class="eyebrow">BEM-VINDO À ELOJUS</div><h1>Seu trabalho começa em um escritório.</h1><p>Abra o link recebido do administrador para aceitar um convite. Se você é o responsável, cadastre seu escritório.</p><div class="form-actions"><a class="button primary" href="cadastro-escritorio.html">Cadastrar escritório →</a>${button('Verificar acesso','refresh')}</div></section>`;}
  const reviewContext=()=>({office,user,members,cases,matters,signals,rounds,allRounds,pilot,selected,comments,versions,attachments,deliveryEnabled:deliveryFeatures,commentFilter,role:role(),personal:personal(),enabled:reviewFeatures,filesEnabled:features,view,filter:reviewFilter,search});
  function caseList(){return U.list(reviewContext());}
  function home(){return U.dashboard(reviewContext());}
  const teamContext=()=>({office,members,invites,userId:user.id,admin:role()==='admin',tab:teamTab,query:teamQuery,type:teamType});
  const team=()=>T.render(teamContext());
  function showInviteResult(data,result){
    const url=new URL('index.html',location.href);url.hash='convite/'+result.token;
    dialog('Cadastro salvo. Prepare o próximo passo.',`<p>A pessoa já está na lista de convites do escritório. O acesso será ativado quando ela aceitar com o e-mail cadastrado.</p><div class="team-result-summary"><strong>${e(data.display_name||data.email)}</strong>${e(data.email)}<br><small>${e(T.types[data.professional_type]||'Colaborador(a)')} · ${e(roles[data.role])}</small></div><div class="invite-result"><label for="inviteLink">Link pessoal do convite</label><textarea id="inviteLink" readonly>${e(url.href)}</textarea>${button('Copiar link','copyInvite','primary')}<p class="form-help" style="margin-top:12px">Válido até ${e(when(result.expires_at))}. Compartilhe este link com a pessoa cadastrada. Nenhum e-mail foi enviado automaticamente.</p>${['127.0.0.1','localhost'].includes(location.hostname)?'<p class="form-help" style="margin-top:8px">Ambiente local: o link só funciona neste computador. O acesso externo depende da publicação da EloJus.</p>':''}</div><div class="form-actions">${button('Concluir','close')}</div>`);
  }
  function caseForm(c){
    pendingFiles=[];
    return `<form id="caseForm" class="shared-form" data-edit="${c?'true':'false'}">
      <label>Nome da peça ou entrega<input name="title" required minlength="2" maxlength="180" value="${e(c?.title)}" placeholder="Ex.: Revisão de contrato de prestação de serviços"></label>
      <div class="form-row"><label>Cliente ou referência<input name="client_name" required minlength="2" maxlength="180" value="${e(c?.client_name)}"></label><label>Área<input name="area" maxlength="80" value="${e(c?.area||'Cível')}"></label></div>
      ${!c?filePicker({creating:true}):''}${U.options(reviewContext(),c)}
      <div class="form-row"><label>Responsável pela elaboração<select name="assignee_id" required ${personal()?'aria-readonly="true"':''}>${(personal()?activeMembers().filter(m=>m.user_id===user.id):activeMembers()).map(m=>`<option value="${e(m.user_id)}" ${m.user_id===(c?.assignee_id||user.id)?'selected':''}>${e(m.display_name)} · ${e(roles[m.role])}</option>`).join('')}</select></label><label>Entrega interna<input name="due_date" type="date" value="${e(c?.due_date)}"><span class="form-help">Não calcula prazo processual.</span></label></div>
      <label>Orientações para a equipe<textarea name="instructions" maxlength="10000" placeholder="Objetivo, informações disponíveis e pontos que precisam de conferência.">${e(c?.instructions)}</textarea></label>
      <p class="form-help">${personal()?'Esta peça será atribuída a você e abrirá diretamente no editor. ':''}Administradores e revisores veem todos os casos. Colaboradores veem apenas os casos atribuídos a eles.</p>
      ${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">${c?'Salvar alterações':'Criar peça e abrir editor'} →</button></div>
    </form>`;
  }
  function saveState(s){
    if(selected?.id!==s.row.id)return;
    selected={...selected,...s.row};localCopy(s);
    const status=$('#saveStatus');if(status)status.textContent=s.error?'Não salvo · '+S.message(s.error):s.busy?'Salvando no '+storageName+'…':s.dirty?'Alterações a salvar…':'Salvo no '+storageName+' · revisão '+s.row.revision;
    if(s.error){connection('Há alterações não salvas');showConflict(S.message(s.error));}
    else if(!s.dirty&&!s.busy)connection('Conectado · alterações salvas');
  }
  function createQueue(row){
    const next=window.EloSharedSave.create(row,(document,revision)=>S.command('save_case',{office_id:row.office_id,case_id:row.id,document,revision}),()=>S.one(row.id),s=>{if(queue===next)saveState(s);});
    queue=next;
  }
  async function flush(){clearTimeout(saveTimer);if(!queue)return true;const ok=await queue.flush();if(!ok)notify('Não saímos do caso: há alterações ainda não salvas.');return ok;}
  function showConflict(text){const box=$('#conflict');if(box){box.hidden=false;box.querySelector('p').textContent=text;}}
  function commentList(){if(reviewFeatures)return U.conversation(reviewContext());return comments.map(c=>`<article class="shared-comment ${c.resolved_at?'resolved':''}"><div class="comment-author"><strong>${e(member(c.author_id)?.display_name||'Integrante')}</strong><small>${c.resolved_at?'Resolvido':c.blocking?'Impeditivo':'Comentário'}</small></div>${c.quote?`<blockquote>${e(c.quote)}</blockquote><small>Trecho selecionado na revisão ${c.document_revision}; confira se o texto mudou.</small>`:''}<p>${e(c.body)}</p><small>${e(when(c.created_at))}</small>${manager()&&selected.status!=='approved'?`<div>${button(c.resolved_at?'Reabrir':'Resolver','resolve','text-button',`data-id="${e(c.id)}" data-resolved="${!c.resolved_at}"`)}</div>`:''}</article>`).join('')||'<p class="form-help">Registre uma orientação ou dúvida para a equipe.</p>';}
  function writingFiles(){
    return W.render({editable:canEdit(),enabled:features,files:attachments.map(a=>({id:a.id,name:a.display_name,info:F.size(a.byte_size)+' · '+when(a.created_at),available:!!a.uploaded_at}))});
  }
  function editor(){
    const editable=canEdit(),file=deliveryFeatures&&selected.delivery_source==='file';
    editorItem||={id:selected.id,fullDocument:true,sections:[{id:'corpo',title:'Texto da peça',omitTitle:true,delta:queue.state().draft}]};
    return `<div class="editor-layout shared-editor"><section class="editor-area"><div class="save-line"><span id="saveStatus" role="status">Salvo no ${storageName} · revisão ${selected.revision}</span>${file?'':button('Salvar agora','save')}</div>${D.source(reviewContext())}${writingFiles()}${file?'<div class="file-reading-note"><h3>Revisão do arquivo original</h3><p>Baixe a peça principal para conferir o conteúdo. Registre as observações ao lado, indicando a página ou o trecho. Para corrigir o documento, anexe a nova versão e selecione-a como peça principal após a devolutiva.</p></div>':`${editable?E.toolbar():`<div class="shared-callout">${selected.status==='approved'?'Versão aprovada · leitura.':'Esta peça foi enviada para revisão. O responsável pode solicitar ajustes para liberar novamente sua edição.'}</div>`}<article class="paper"><header class="paper-heading"><p>${e(office.name)} · ${e(code(selected))}</p></header><section class="continuous-section">${editable?'<div data-rich-section="corpo"></div>':`<div class="rich-preview">${R.html(editorItem.sections[0])}</div>`}</section><p class="document-disclaimer">${e(selected.title)} · Entrega interna sujeita à revisão profissional.</p></article>`}</section><aside class="review-panel"><h2>Conversa da revisão</h2>${selected.status!=='approved'?`<form id="commentForm" class="shared-form">${U.commentFields(reviewContext())}<label>Comentário<textarea name="body" required maxlength="4000" placeholder="Deixe uma orientação clara para a próxima etapa."></textarea></label><label>${file?'Página ou trecho do arquivo':'Trecho de referência'}<textarea name="quote" maxlength="1000" ${file?'placeholder="Ex.: Página 3, conclusão — transcreva o trecho se necessário."':'readonly placeholder="Opcional: selecione um trecho da minuta."'}></textarea></label>${file?'':button('Usar trecho selecionado','quote','text-button')}${manager()?'<label class="checkbox-label"><input name="blocking" type="checkbox"> Impede aprovação até ser resolvido</label>':''}${errorBox}<button class="button primary" type="submit">Adicionar comentário</button></form>`:''}<div id="commentList" style="margin-top:20px">${commentList()}</div></aside></div>`;
  }
  function context(){return `<section class="shared-panel"><h2>Contexto da entrega</h2><dl class="context-values"><div><dt>Cliente / referência</dt><dd>${e(selected.client_name)}</dd></div><div><dt>Área</dt><dd>${e(selected.area)}</dd></div><div><dt>Elaboração</dt><dd>${e(member(selected.assignee_id)?.display_name)}</dd></div><div><dt>Entrega interna</dt><dd>${e(day(selected.due_date))}</dd></div><div class="wide"><dt>Orientações</dt><dd>${e(selected.instructions||'Nenhuma orientação registrada.')}</dd></div></dl>${U.contextDetails(reviewContext())}${manager()&&selected.status!=='approved'?button('Editar contexto e responsável','editCase'):''}${features?'<div class="shared-callout">Os documentos da aba Anexos são privados e acompanham o acesso a este caso.</div>':''}</section>`;}
  function historyContent(){return `${U.roundHistory(reviewContext())}${manager()&&reviewFeatures?'<div class="shared-toolbar"><p class="form-help">Registre os tempos e contatos observados com a dupla.</p>'+button('Registrar dados do piloto','pilotForm')+'</div>':''}<div class="shared-grid"><section class="shared-panel"><h2>Versões registradas</h2><p>Registros de trabalho, envio e aprovação preservam o conteúdo da minuta.</p><ul class="shared-history">${versions.map(v=>`<li><strong>${e(v.label)}</strong><small>${e(member(v.created_by)?.display_name||'Integrante')} · ${e(when(v.created_at))} · revisão ${v.revision}</small><div>${button('Abrir versão','viewVersion','secondary',`data-id="${e(v.id)}"`)}</div></li>`).join('')||'<li>Nenhuma versão registrada ainda.</li>'}</ul></section><section class="shared-panel"><h2>Atividade do caso</h2><ul class="shared-history">${activity.map(a=>`<li><strong>${e(a.action)}</strong><small>${e(member(a.actor_id)?.display_name||'Integrante')} · ${e(when(a.created_at))}</small></li>`).join('')}</ul></section></div>`;}
  function casePage(){return `<div class="shared-case-heading"><a class="back-link" href="#casos" data-route="casos">← ${personal()?'Minhas peças':'Todos os casos'}</a><div class="eyebrow">${e(code(selected))} · ${e(selected.area)} · ${e(selected.client_name)}</div><h1>${e(selected.title)}</h1><div class="heading-bottom"><p>${e(member(selected.assignee_id)?.display_name||'Integrante')} · elaboração &nbsp; / &nbsp; Entrega: ${e(day(selected.due_date))}</p>${badge(selected)}</div></div>${recoveryBanner()}${U.brief(reviewContext())}<div class="shared-case-actions">${canEdit()?button('Registrar versão','version'):''}${canEdit()&&['working','changes'].includes(selected.status)?button('Enviar para revisão →','submit','primary'):''}${canDecide()&&selected.status==='review'?button('Solicitar ajustes','return')+button('Aprovar minuta','approve','primary',selected.assignee_id===user.id?'disabled title="Outro revisor deve aprovar esta entrega"':''):''}${versions.length?button('Comparar versões','compareVersions'):''}${button(selected.delivery_source==='file'?'Baixar peça principal':'Exportar documento','exportMenu')}${button('Atualizar caso','refresh')}</div><div id="conflict" class="shared-conflict" hidden><p></p>${button('Conferir versão salva','compare')}${button('Baixar meu rascunho','export')}${button('Carregar versão salva','reloadCase')}</div><div class="shared-case-tabs" role="tablist" aria-label="Conteúdo do caso">${[['document','Minuta e comentários'],['context','Contexto'],...(features?[['attachments','Anexos ('+attachments.filter(a=>a.uploaded_at).length+')']]:[]),['history','Versões e atividade']].map(([key,label])=>`<button role="tab" aria-selected="${tab===key}" class="${tab===key?'active':''}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}</div>${tab==='context'?context():tab==='attachments'?attachmentPanel():tab==='history'?historyContent():editor()}`;}
  function render(){
    teardown();officeHeader();$('#mainContent').classList.toggle('case-content',view==='trabalho');
    $('#mainContent').innerHTML=!office?noOffice():view==='equipe'?team():view==='trabalho'&&selected?casePage():view==='indicadores'?U.metrics(reviewContext()):home();
    if(view==='trabalho'&&selected&&tab==='document'&&selected.delivery_source!=='file'){
      if(canEdit())E.mount(editorItem,()=>{queue.edit(R.delta(editorItem.sections[0]));clearTimeout(saveTimer);if(!queue.state().error)saveTimer=setTimeout(()=>queue.flush(),1000);});
      P.mount();saveState(queue.state());
    }
  }
  async function openCase(id){
    const row=await S.one(id);
    if(office?.id!==row.office_id)await loadOffice(row.office_id);
    selected=row;editorItem=null;createQueue(row);latestRemote=null;restoring=null;commentFilter='open';try{recoveries=drafts?.list(row).filter(d=>!R.equal({delta:d.document},{delta:row.document}))||[];}catch{recoveries=[];}
    [comments,versions,activity,attachments,rounds]=await Promise.all([S.comments(id),S.versions(id),S.activity(id),features?S.attachments(id):[],reviewFeatures?S.rounds(id):[]]);
    if(reviewFeatures){await S.command('seen_review',{office_id:office.id,case_id:id,seen_at:row.review_activity_at});signals=signals.map(x=>x.case_id===id?{...x,unread:false}:x);}
    tab='document';
  }
  async function invitePage(token){
    teardown();view='convite';officeHeader();$('#mainContent').innerHTML='<section class="shared-panel shared-invite-page"><h2>Conferindo seu convite…</h2></section>';
    try{const info=await S.command('preview_invite',{token});$('#mainContent').innerHTML=`<section class="shared-panel shared-invite-page"><div class="eyebrow">CONVITE PARA TRABALHAR EM EQUIPE</div><h1>${e(info.name)}</h1><p style="margin-top:18px">Você foi convidado como <strong>${e(T.types[info.professional_type]||'Colaborador(a)')}</strong> · ${e(roles[info.role])}, com a conta ${e(info.email)}.</p><div class="shared-callout">${info.role==='reviewer'?'Você poderá consultar os casos do escritório, distribuir entregas e revisar o trabalho da equipe.':'Você poderá consultar e elaborar os casos atribuídos a você e enviá-los para revisão.'}</div><p class="form-help">Válido até ${e(when(info.expires_at))}. A entrada não ativa cobrança.</p><div class="form-actions">${button('Aceitar convite e entrar','acceptInvite','primary')}</div></section>`;}
    catch(error){$('#mainContent').innerHTML=`<section class="shared-panel shared-invite-page"><h1>Vamos conferir seu acesso.</h1><p style="margin:20px 0">${e(S.message(error))}</p><p class="form-help">Conta atual: ${e(user.email)}. Se necessário, saia e entre com o e-mail que recebeu o convite.</p><div class="form-actions">${button('Trocar de conta','switchAccount')}${button('Tentar novamente','refresh')}</div></section>`;}
  }
  async function navigate(route,replace=false){
    if(loading||mutation||!sessionValid)return;loading=true;E.setEnabled(false);
    try{
      if(!await flush())return;
      const [page,id]=route.split('/');
      if(page==='convite'){history[replace?'replaceState':'pushState'](null,'','#'+route);await invitePage(id);return;}
      if(page==='trabalho'&&id){view='trabalho';await openCase(id);}else{selected=null;queue=null;view=['inicio','casos','revisoes','equipe','indicadores'].includes(page)?page:'inicio';await loadOffice(office?.id);if(personal()&&['revisoes','equipe','indicadores'].includes(view))view='casos';reviewFilter=view==='revisoes'?'mine':'all';}
      history[replace?'replaceState':'pushState'](null,'','#'+(view==='trabalho'?'trabalho/'+selected.id:view));render();$('#mainContent').focus({preventScroll:true});window.scrollTo(0,0);
    }catch(error){connection('Não foi possível atualizar');notify(S.message(error));if(!$('#mainContent').querySelector('h1,h2'))render();}
    finally{loading=false;if(canEdit())E.setEnabled(true);}
  }
  async function updateCase(action,data={}){
    if(mutation)return false;
    const conversation=features&&['comment','reply_comment','address_comment','resolve_comment','version'].includes(action),id=selected.id;
    mutation=true;if(!conversation)E.setEnabled(false);
    try{
      if(!await flush())return false;
      const result=await S.command(action,{office_id:office.id,case_id:id,revision:queue.state().row.revision,...data});
      if(!conversation){selected=result;queue.reset(result);}
      [comments,versions,activity,rounds]=await Promise.all([S.comments(id),S.versions(id),S.activity(id),reviewFeatures?S.rounds(id):[]]);
      if(conversation){if($('#commentList'))$('#commentList').innerHTML=commentList();}
      else render();
      return true;
    }finally{mutation=false;if(canEdit())E.setEnabled(true);}
  }
  function filePicker({writing=false,creating=false}={}){return `<section class="case-file-picker" aria-labelledby="caseFilesTitle">
    <div class="case-file-heading"><h3 id="caseFilesTitle">${writing?'Peça redigida em outro programa':'Documentos da peça'}</h3><span>${creating?'Opcional':'Arquivos originais'}</span></div>
    <p class="form-help">${writing?'Escolha o arquivo salvo no Word, em PDF ou TXT. Ele ficará anexado ao caso para leitura e download.':'Reúna contratos, comprovantes e outros documentos de apoio.'}</p>
    <fieldset class="case-file-controls" ${features?'':'disabled'}>
      <label for="caseFiles" class="sr-only">Anexar documentos</label>
      <input id="caseFiles" type="file" multiple accept="${writing?W.accept:F.accept}" aria-describedby="caseFilesHelp${features?'':' caseFilesAvailability'}">
    </fieldset>
    <p id="caseFilesHelp" class="form-help">${writing?'Word (.docx), PDF ou TXT':'PDF, DOCX, TXT, JPG ou PNG'} · até 20 MB por arquivo.<br>Máximo de 10 documentos e 100 MB por peça.</p>
    ${features?`<p class="form-help">${creating?'Os documentos serão enviados ao criar a peça e ficarão na aba Anexos.':writing?'O texto do editor será mantido. Os arquivos não são convertidos em texto; você também poderá encontrá-los na aba Anexos.':'Os documentos ficarão disponíveis na aba Anexos.'}</p>`:'<p id="caseFilesAvailability" class="case-file-availability"><strong>Envio de documentos ainda não ativado.</strong> Você pode criar a peça sem anexos enquanto a ativação está pendente.</p>'}
    <div id="fileSelection" aria-live="polite"></div><p id="fileProgress" role="status"></p>
  </section>`;}
  function selectionList(){const box=$('#fileSelection');if(box)box.innerHTML=pendingFiles.map(f=>`<div class="case-file-row"><span><strong>${e(f.file.name)}</strong><small>${F.size(f.file.size)} · ${f.done?'Enviado':'Pronto para enviar'}</small></span>${!f.done?button('Remover','removeFile','text-button',`data-id="${f.id}"`):''}</div>`).join('');}
  async function sendFiles(id){
    const context={office_id:office.id,case_id:id};
    for(const entry of pendingFiles.filter(f=>!f.done)){
      if($('#fileProgress'))$('#fileProgress').textContent='Enviando '+entry.file.name+'…';
      await F.upload(entry,context,{command:S.fileCommand,upload:S.uploadFile});entry.done=true;selectionList();
    }
  }
  function attachmentPanel(){return `<section class="shared-panel"><div class="attachment-heading"><div><h2>Documentos da peça</h2><p>Originais compartilhados com quem tem acesso ao caso.</p></div>${canEdit()?button('Anexar documentos +','addFiles','primary'):''}</div><div class="attachment-list">${attachments.map(a=>`<article class="case-file-row"><span><strong>${e(a.display_name)}</strong><small>${F.size(a.byte_size)} · ${e(member(a.uploaded_by)?.display_name||'Integrante')} · ${e(when(a.created_at))}</small><small>${a.uploaded_at?'Disponível para a equipe':'Envio pendente de confirmação'}</small></span><div>${a.uploaded_at?button('Baixar','downloadFile','secondary',`data-id="${a.id}"`):a.uploaded_by===user.id&&canEdit()?button('Concluir envio','completeFile','secondary',`data-id="${a.id}"`)+button('Repetir envio','retryFile','text-button',`data-id="${a.id}"`)+button('Cancelar pendência','cancelFile','text-button',`data-id="${a.id}"`):''}</div></article>`).join('')||'<p class="empty-state">Nenhum documento anexado ainda.</p>'}</div><p class="form-help">Os documentos originais não são alterados pelo editor. Para a revisão, baixe e confira os arquivos.</p></section>`;}
  async function renderComparison(id){
    const box=$('#reviewDiff');if(!box)return;box.textContent='Carregando comparação…';
    try{const row=await S.version(id);if($('#reviewDiff')!==box||$('#compareVersion')?.value!==id)return;
      if(row.delivery_source==='file'||selected.delivery_source==='file'){box.innerHTML='<h3>Versão de referência</h3>'+(row.delivery_source==='file'?D.fileVersion(row,attachments):'<p>Texto do editor preservado.</p><div class="rich-preview">'+R.html({delta:row.document})+'</div>')+'<h3>Conteúdo atual</h3>'+(selected.delivery_source==='file'?D.fileVersion({attachment_id:selected.primary_attachment_id},attachments):'<p>Texto atual do editor.</p><div class="rich-preview">'+R.html({delta:queue.state().draft})+'</div>');return;}
      const current=queue.state().draft,diff=M.diffHtml(M.text(row.document),M.text(current));
      const formatOnly=!diff.changed&&!R.equal({delta:row.document},{delta:current});
      box.innerHTML='<div class="review-diff-notice">'+(formatOnly?'O texto é igual, mas há diferenças de formatação. Confira as duas versões.':diff.changed?'Inclusões sublinhadas · exclusões riscadas.':'Nenhuma alteração de texto nesta comparação.')+(diff.simplified?' Comparação simplificada para um trecho extenso.':'')+'</div>'+diff.html;
    }catch(error){if(box.isConnected)box.textContent=S.message(error);}
  }
  function exportDraft(){
    if(!selected)return;const blob=new Blob(['\ufeff'+R.text({delta:queue.state().draft})],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=code(selected)+'-minuta.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  document.addEventListener('input',ev=>{
    if(ev.target.id==='caseSearch'){search=ev.target.value;$('#caseList').innerHTML=caseList();}
    if(ev.target.id==='teamSearch'){teamQuery=ev.target.value;$('#teamList').innerHTML=T.list(teamContext());}
  });
  document.addEventListener('change',ev=>{
    if(ev.target.name==='assignee_id'&&ev.target.form?.id==='caseForm'){const select=ev.target.form.elements.reviewer_id;if(select){for(const option of select.options)option.disabled=option.value===ev.target.value;if(select.value===ev.target.value)select.value='';}}
    if(ev.target.id==='caseFiles'){
      try{const files=Array.from(ev.target.files);if(ev.target.form.dataset.writing==='true')W.validate(files);F.validate(files,ev.target.form.id==='caseForm'||retryAttachment?[]:attachments);if(retryAttachment&&(files.length!==1||files[0].name!==retryAttachment.display_name||files[0].size!==retryAttachment.byte_size))throw Error('invalid_attachment');pendingFiles=files.map(file=>({id:retryAttachment?.id||crypto.randomUUID(),file,done:false}));selectionList();}catch(error){ev.target.value='';pendingFiles=[];selectionList();formError(ev.target.form,error);}
    }
    if(ev.target.id==='alertInterval'){try{alerts?.configure(!!alerts.read().enabled,Number(ev.target.value));notify('Intervalo dos avisos atualizado.');}catch{notify('Não foi possível salvar a preferência neste navegador.');}}
    if(ev.target.id==='compareVersion'){renderComparison(ev.target.value);return;}
    if(ev.target.name==='kind'&&ev.target.form?.id==='commentForm'){const controls=ev.target.form.querySelector('.review-blocks');if(controls){controls.hidden=ev.target.value!=='question';if(controls.hidden)controls.querySelector('input').checked=false;}}
    if(ev.target.id==='teamType'){teamType=ev.target.value;$('#teamList').innerHTML=T.list(teamContext());}
    if(ev.target.closest('.team-form')&&['professional_type','role'].includes(ev.target.name))T.syncForm(ev.target.form);
  });
  document.addEventListener('submit',async ev=>{
    const form=ev.target;if(!['caseForm','attachmentForm','inviteForm','commentForm','memberForm','confirmForm','deliveryForm','replyForm','pilotForm','sourceForm'].includes(form.id))return;ev.preventDefault();if(mutation)return;if(form.getAttribute('aria-busy')==='true')return;
    const data=Object.fromEntries(new FormData(form));busy(form,true);form.querySelector('.form-error').hidden=true;
    try{
      if(form.id==='sourceForm'){if(await updateCase('set_delivery_source',{delivery_source:data.source==='editor'?'editor':'file',attachment_id:data.source==='editor'?null:data.source})){$('#workspaceDialog').close();notify('Conteúdo da peça atualizado.');}}else if(form.id==='deliveryForm'){
        form.dataset.deliveryId||=crypto.randomUUID();
        if(await updateCase('submit',{...data,delivery_id:form.dataset.deliveryId})){$('#workspaceDialog').close();notify('Entrega enviada ao revisor com resumo e versão preservada.');}
      }else if(form.id==='replyForm'){
        form.dataset.replyId||=crypto.randomUUID();
        if(await updateCase('reply_comment',{...data,id:form.dataset.replyId,parent_id:form.dataset.parent,resolve:data.resolve==='on'})){$('#workspaceDialog').close();notify('Resposta registrada no assunto.');}
      }else if(form.id==='pilotForm'){
        mutation=true;try{await S.command('record_pilot',{...data,office_id:office.id,case_id:selected.id});$('#workspaceDialog').close();notify('Dados observados do piloto registrados.');}finally{mutation=false;}
      }else if(form.id==='caseForm'){
        if(form.dataset.edit==='true'){if(!await updateCase('assign',data))return;}
        else{
          F.validate(pendingFiles.map(f=>f.file));mutation=true;
          try{form.dataset.caseId||=crypto.randomUUID();const row=await S.command('create_case',{...data,assignee_id:personal()?user.id:data.assignee_id,office_id:office.id,id:form.dataset.caseId});
            await sendFiles(row.id);mutation=false;$('#workspaceDialog').close();await navigate('trabalho/'+row.id);E.focusEnd();notify('Peça criada. Você já pode começar a escrever.');return;
          }catch(error){if($('#fileProgress'))$('#fileProgress').textContent='A peça pode já estar salva. Repetir a ação mantém a mesma peça e retoma os anexos pendentes.';throw error;}finally{mutation=false;}
        }
        $('#workspaceDialog').close();notify('Contexto atualizado.');
      }else if(form.id==='attachmentForm'){
        if(!features||!canEdit())throw Error('read_only');
        if(form.dataset.writing==='true')W.validate(pendingFiles.map(f=>f.file));
        if(!pendingFiles.length)throw Error('attachment_pending');mutation=true;
        try{await sendFiles(selected.id);attachments=await S.attachments(selected.id);$('#workspaceDialog').close();render();notify('Documentos anexados.');}finally{mutation=false;}
      }else if(form.id==='inviteForm'){
        const result=await S.command('register_member',{...data,office_id:office.id});
        teamTab='invites';teamQuery='';teamType='all';showInviteResult(data,result);
        try{invites=await S.invitations(office.id);if(view==='equipe')render();}catch{notify('Cadastro salvo. Copie o link e atualize a lista ao concluir.');}
      }else if(form.id==='commentForm'){
        data.blocking=data.blocking==='on';data.blocks_work=data.blocks_work==='on';form.dataset.commentId||=crypto.randomUUID();data.id=form.dataset.commentId;if(await updateCase('comment',data)){form.reset();const controls=form.querySelector('.review-blocks');if(controls)controls.hidden=false;delete form.dataset.commentId;notify('Comentário compartilhado com a equipe.');}
      }else if(form.id==='memberForm'){
        await S.command('update_member',{...data,office_id:office.id,user_id:form.dataset.id});await loadOffice(office.id);$('#workspaceDialog').close();render();notify('Cadastro e permissão atualizados.');
      }else if(form.id==='confirmForm'){
        const action=form.dataset.action;
        if(action==='renew_invite'){
          const invitation=invites.find(i=>i.id===form.dataset.id);
          const result=await S.command(action,{office_id:office.id,id:form.dataset.id});
          showInviteResult(invitation,result);
          try{invites=await S.invitations(office.id);render();}catch{notify('Link renovado. Copie o link e atualize a lista ao concluir.');}
          return;
        }
        if(action==='approve'){if(!await updateCase('approve'))return;}
        else if(action==='reloadCase'){mutation=true;E.setEnabled(false);clearTimeout(saveTimer);try{if(queue?.state().busy)await queue.flush();await openCase(selected.id);render();}finally{mutation=false;if(canEdit())E.setEnabled(true);}}
        else{await S.command(action,{office_id:office.id,...(action==='remove_member'?{user_id:form.dataset.id}:{id:form.dataset.id})});await loadOffice(office.id);render();}
        $('#workspaceDialog').close();notify(action==='approve'?'Minuta aprovada internamente.':'Alteração concluída.');
      }
    }catch(error){if(form.isConnected)formError(form,error);else notify(S.message(error));}
    finally{if(form.isConnected){busy(form,false);if(form.matches('.team-form'))T.syncForm(form);}}
  });
  document.addEventListener('click',async ev=>{
    if(mutation){if(ev.target.closest('[data-route],button[data-action]'))ev.preventDefault();return;}
    const link=ev.target.closest('[data-route]'),b=ev.target.closest('button[data-action]');
    if(link){ev.preventDefault();$('#workspaceDialog').close();await navigate(link.dataset.route);return;}if(!b||b.disabled)return;
    const action=b.dataset.action;if(action==='close'){$('#workspaceDialog').close();return;}
    b.disabled=true;
    try{
      if(['previewSara','previewPersona','previewReturn'].includes(action)){
        const target=demo?.destination(action,{location,role:role(),preview,persona:b.dataset.persona});
        if(!target||loading)return;
        mutation=true;E.setEnabled(false);
        try{
          if(!await flush())return;
          if(action==='previewSara')await demo.checkAvailable();
          mutation=false;location.assign(target);
        }finally{mutation=false;if(canEdit())E.setEnabled(true);}
      }
      else if(action==='updates')await showUpdates();
      else if(action==='toggleAlerts'){if(!alerts)return;const enabled=alerts.read().enabled;if(enabled)alerts.configure(false);else{const permission=await Notification.requestPermission();if(permission==='granted')alerts.configure(true,Number($('#alertInterval').value));else notify('Avisos não ativados. Você pode acompanhar as atualizações dentro da EloJus.');}await showUpdates();checkAlerts();}
      else if(action==='chooseSource'){if(await flush())dialog('Conteúdo da peça',D.form(reviewContext()));}
      else if(action==='reviewRecovery')showRecovery();
      else if(action==='restoreRecovery'){const copy=recoveries[0],latest=await S.one(selected.id);if(!copy)return;if(latest.revision!==queue.state().row.revision){notify('O texto salvo mudou. Atualize o caso e confira novamente a cópia local.');return;}if(!canEdit()||selected.delivery_source==='file')return;restoring=copy;queue.edit(R.delta({delta:copy.document}));editorItem=null;recoveries=[];$('#workspaceDialog').close();render();notify('Cópia restaurada no editor. Confira e clique em Salvar agora.');}
      else if(action==='downloadRecovery'){const copy=recoveries[0];if(copy){const blob=new Blob([R.text({delta:copy.document})],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=code(selected)+'-rascunho-local.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}}
      else if(action==='discardRecovery'){dialog('Descartar cópia local','<p>Descartar apenas esta cópia não salva? O documento no escritório será mantido.</p><div class="form-actions">'+button('Voltar','reviewRecovery')+button('Descartar cópia local','confirmDiscardRecovery','primary')+'</div>');}
      else if(action==='confirmDiscardRecovery'){drafts.remove(recoveries[0]);recoveries= recoveries.slice(1);$('#workspaceDialog').close();render();}
      else if(action==='commentFilter'){commentFilter=b.dataset.filter;pendingThread=-1;$('#commentList').innerHTML=commentList();}
      else if(action==='nextPending'){const items=[...document.querySelectorAll('.review-thread:not(.resolved)')];pendingThread=(pendingThread+1)%items.length;const target=items[pendingThread];target?.focus();target?.scrollIntoView({block:'center',behavior:'smooth'});}
      else if(action==='locateQuote'){const c=comments.find(x=>x.id===b.dataset.id);if(c&&!E.locateText(c.quote))notify('O trecho mudou, se repete ou está em modo de leitura. Confira a referência do comentário e a versão preservada.');}
      else if(action==='reviewFilter'){reviewFilter=b.dataset.filter;render();document.querySelector('.review-filters [data-filter="'+reviewFilter+'"]')?.focus();}
      else if(action==='replyThread'){const parent=comments.find(c=>c.id===b.dataset.id);if(parent)dialog('Responder ao assunto',U.replyForm(reviewContext(),parent));}
      else if(action==='addressThread'){await updateCase('address_comment',{id:b.dataset.id,addressed:b.dataset.addressed==='true'});}
      else if(action==='pilotForm'){const entries=await S.pilot(office.id);dialog('Dados observados do piloto',U.pilotForm(entries.find(p=>p.case_id===selected.id)));}
      else if(action==='compareVersions'){if(!versions.length){notify('Registre uma versão para comparar alterações.');return;}dialog('Comparar versões da peça',U.comparison(reviewContext()));await renderComparison($('#compareVersion').value);}
      else if(action==='newCase'){if(personal()&&!features)return;retryAttachment=null;dialog(personal()?'Criar minha peça':'Criar peça no escritório',caseForm(null));}
      else if(action==='removeFile'){pendingFiles=pendingFiles.filter(f=>f.id!==b.dataset.id);if($('#caseFiles'))$('#caseFiles').value='';selectionList();}
      else if(['addFiles','addDraftFiles','retryFile'].includes(action)){
        if(!features||!canEdit())return;
        if(!await flush())return;pendingFiles=[];retryAttachment=action==='retryFile'?attachments.find(a=>a.id===b.dataset.id):null;
        const writing=action==='addDraftFiles';
        dialog(retryAttachment?'Repetir envio de documento':writing?'Anexar peça em arquivo':'Anexar documentos',`<form id="attachmentForm" class="shared-form" data-writing="${writing}">${retryAttachment?'<p>Selecione o mesmo arquivo: '+e(retryAttachment.display_name)+'</p>':''}${filePicker({writing})}${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">${writing?'Anexar à peça':'Enviar documentos'}</button></div></form>`);
      }
      else if(['downloadFile','completeFile','cancelFile'].includes(action)){
        const a=attachments.find(a=>a.id===b.dataset.id);if(!a)return;
        if(action==='downloadFile'){const blob=await S.downloadFile(a.object_path),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=a.display_name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
        else{await S.fileCommand(action==='completeFile'?'complete':'cancel',{office_id:office.id,case_id:selected.id,id:a.id});attachments=await S.attachments(selected.id);render();notify(action==='completeFile'?'Documento confirmado.':'Pendência cancelada.');}
      }
      else if(action==='editCase'){if(await flush())dialog('Contexto e responsável',caseForm(selected));}
      else if(action==='invite'){if(role()!=='admin')return;dialog('Cadastrar integrante',T.form());}
      else if(action==='copyInvite'){try{await navigator.clipboard.writeText($('#inviteLink').value);notify('Link copiado.');}catch{$('#inviteLink').select();notify('Selecione e copie o link acima.');}}
      else if(action==='editMember'){if(role()!=='admin')return;dialog('Editar cadastro',T.form(member(b.dataset.id),{editing:true}));}
      else if(action==='reinviteMember'){if(role()!=='admin')return;const m=member(b.dataset.id);dialog('Convidar novamente',T.form({...m,professional_type:m.professional_type==='other'?'lawyer':m.professional_type}));}
      else if(action==='teamTab'){teamTab=b.dataset.tab;render();document.querySelector(`[data-action="teamTab"][data-tab="${teamTab}"]`)?.focus();}
      else if(action==='renewInvite'){
        dialog('Renovar link do convite',`<form id="confirmForm" class="shared-form" data-action="renew_invite" data-id="${e(b.dataset.id)}"><p>Será gerado um novo link, válido por 7 dias. O link anterior deixará de funcionar. Compartilhe o novo link com ${e(invites.find(i=>i.id===b.dataset.id)?.display_name||invites.find(i=>i.id===b.dataset.id)?.email)}.</p>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">Renovar link</button></div></form>`);
      }
      else if(['removeMember','revokeInvite','approve','reloadCase'].includes(action)){
        const text=action==='removeMember'?`Remover o acesso de ${member(b.dataset.id)?.display_name}? O histórico será preservado e casos abertos precisam ser reatribuídos antes.`:action==='revokeInvite'?'Revogar este convite? O link deixará de permitir a entrada no escritório.':action==='approve'?'Confirmar a revisão desta minuta? O conteúdo aprovado ficará em leitura. Esta aprovação é interna e não assina nem protocola o documento.':'Carregar a versão salva no Supabase? Alterações não salvas desta tela serão substituídas. Baixe seu rascunho antes, se precisar preservá-lo.';
        dialog(action==='approve'?'Aprovar minuta':'Confirmar alteração',`<form id="confirmForm" class="shared-form" data-action="${({removeMember:'remove_member',revokeInvite:'revoke_invite'})[action]||action}" data-id="${e(b.dataset.id||'')}"><p>${e(text)}</p>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">Confirmar</button></div></form>`);
      }
      else if(action==='refresh'){
        if(view==='convite')await invitePage(location.hash.split('/')[1]);
        else if(selected){await navigate('trabalho/'+selected.id,true);}
        else{await loadOffice(office?.id);render();}
      }else if(action==='save'){if(await flush())notify('Minuta salva no '+storageName+'.');}
      else if(action==='submit'&&reviewFeatures){if(await flush())dialog('Entregar para revisão',U.deliveryForm(reviewContext()));}
      else if(['submit','version','return'].includes(action)){if(await updateCase(action))notify(action==='submit'?'Minuta enviada para revisão.':action==='return'?'Ajustes solicitados.':'Versão registrada.');}
      else if(action==='tab'){mutation=true;E.setEnabled(false);try{if(await flush()){tab=b.dataset.tab;render();}}finally{mutation=false;if(canEdit())E.setEnabled(true);}}
      else if(action==='resolve')await updateCase('resolve_comment',{id:b.dataset.id,resolved:b.dataset.resolved==='true'});
      else if(action==='quote'){const selection=E.selection();if(selection)$('#commentForm [name="quote"]').value=selection.text.slice(0,1000);else notify('Selecione um trecho na minuta para vinculá-lo ao comentário.');}
      else if(action==='viewVersion'||action==='compare'){
        const row=action==='compare'?await S.one(selected.id):await S.version(b.dataset.id);
        dialog(action==='compare'?'Versão salva no escritório':'Versão preservada',`<p class="form-help">Revisão ${row.revision} · ${e(when(row.updated_at||row.created_at))}</p><div class="shared-version-preview rich-preview">${row.delivery_source==='file'?D.fileVersion({...row,attachment_id:row.attachment_id||row.primary_attachment_id},attachments):R.html({delta:row.document})}</div><div class="form-actions">${button('Fechar','close')}</div>`);
      }else if(action==='export')exportDraft();
      else if(action==='exportMenu'&&selected.delivery_source==='file')dialog('Peça principal',D.fileVersion({attachment_id:selected.primary_attachment_id},attachments));
      else if(action==='exportMenu')dialog('Exportar a minuta',`<p>O arquivo contém apenas o texto e a formatação da minuta. Comentários e orientações internas não acompanham a exportação.</p><div class="form-actions">${button('Word · DOCX','downloadShared','primary','data-format="docx"')}${button('PDF','downloadShared','secondary','data-format="pdf"')}${button('Texto · TXT','export')}</div><p id="downloadStatus" class="form-help" role="status"></p>`);
      else if(action==='downloadShared'){
        const snapshot={id:code(selected),title:selected.title,documentTitle:selected.title,fullDocument:true,shared:true,sections:[{id:'corpo',title:'Minuta',omitTitle:true,delta:queue.state().draft}]};
        const status=$('#downloadStatus');status.textContent='Preparando o arquivo…';
        try{const blob=await window.EloExport.create(snapshot,b.dataset.format,'A4'),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=snapshot.id+'-minuta.'+b.dataset.format;link.textContent='Baixar arquivo';link.className='button secondary';status.replaceChildren(link);link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){status.textContent='Não foi possível exportar agora. Tente novamente ou use o formato TXT.';}
      }
      else if(action==='acceptInvite'){const joined=await S.command('accept_invite',{token:location.hash.split('/')[1]});await loadOffice(joined.office_id);await navigate('inicio',true);notify('Você agora faz parte do escritório.');}
      else if(action==='logout'||action==='switchAccount'){if(!await flush())return;const next=action==='switchAccount'?A.safeRoute(location.hash):'#inicio';try{drafts?.clear();}catch{}await A.logout();location.assign('login.html?next='+encodeURIComponent(next));}
    }catch(error){notify(action.startsWith('preview')?error.message:S.message(error));if(error.message==='version_conflict')showConflict(S.message(error));}
    finally{if(b.isConnected)b.disabled=false;}
  });
  $('#officeSelect').addEventListener('change',async ev=>{
    const id=ev.target.value;
    if(mutation||loading){ev.target.value=office?.id;return;}
    E.setEnabled(false);
    try{if(!await flush()){ev.target.value=office.id;return;}selected=null;queue=null;await loadOffice(id);await navigate('inicio');}
    catch(error){notify(S.message(error));}
    finally{if(canEdit())E.setEnabled(true);}
  });
  window.addEventListener('popstate',()=>{const wanted=location.hash.slice(1);if(queue?.state().dirty){history.pushState(null,'','#trabalho/'+selected.id);notify('Salve ou preserve o rascunho antes de sair.');return;}navigate(wanted,true);});
  $('#workspaceDialog').addEventListener('cancel',event=>{if(mutation||$('#workspaceDialog [aria-busy="true"]'))event.preventDefault();});
  window.addEventListener('beforeunload',event=>{if(mutation||queue?.state().dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('elo-auth-change',event=>{if(event.detail.event==='SIGNED_OUT'||(event.detail.userId&&event.detail.userId!==user.id)){sessionValid=false;clearTimeout(saveTimer);teardown();queue=null;selected=null;$('#mainContent').replaceChildren();location.replace('login.html?reason=session');}});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  async function poll(){
    if(polling||loading||mutation||queue?.state().busy||document.hidden||!sessionValid||!office||view==='convite'||$('#workspaceDialog').open)return;
    polling=true;
    try{
      const freshMembers=await S.members(office.id),me=freshMembers.find(m=>m.user_id===user.id&&!m.removed_at);
      if(!me){try{drafts?.clearOffice(office.id);}catch{}teardown();queue=null;selected=null;office=null;members=[];cases=[];connection('Acesso ao escritório removido');$('#mainContent').innerHTML=noOffice();return;}
      const permissionChanged=me.role!==role(),teamChanged=JSON.stringify(members)!==JSON.stringify(freshMembers);members=freshMembers;
      if(permissionChanged){clearTimeout(saveTimer);if(queue?.state().dirty){E.setEnabled(false);showConflict('Sua permissão mudou. Baixe o rascunho e atualize o caso para conferir seu acesso.');}else await navigate(view==='trabalho'?'trabalho/'+selected.id:view,true);}
      if(view==='equipe'&&!document.activeElement?.matches('input,textarea,select')){
        const nextInvites=role()==='admin'?await S.invitations(office.id):[];
        const changed=teamChanged||JSON.stringify(invites)!==JSON.stringify(nextInvites);invites=nextInvites;if(changed)render();
      }
      if(selected){const id=selected.id,localQueue=queue;const [latest,freshComments]=await Promise.all([S.one(id),S.comments(id)]);if(selected?.id!==id||queue!==localQueue||mutation||loading||queue.state().busy)return;if(JSON.stringify(comments)!==JSON.stringify(freshComments)){comments=freshComments;if($('#commentList'))$('#commentList').innerHTML=commentList();}if(latest.revision>queue.state().row.revision){latestRemote=latest;showConflict('Há uma atualização de outra pessoa. Confira a versão salva ou atualize o caso para continuar.');connection('Atualização da equipe disponível');}}
      else if(!document.activeElement?.matches('input,textarea,select')&&view!=='indicadores'){
        const [nextCases,nextSignals]=await Promise.all([S.cases(office.id),reviewFeatures?S.signals(office.id):[]]);
        const changed=JSON.stringify(cases)!==JSON.stringify(nextCases)||JSON.stringify(signals)!==JSON.stringify(nextSignals);
        cases=nextCases;signals=nextSignals;if(changed&&view!=='equipe')render();
      }
    }catch(error){connection('Sem sincronização · verifique a conexão');if(selected&&['PGRST116','42501'].includes(error.code)){try{drafts?.clearCase(selected);}catch{}teardown();queue=null;selected=null;cases=[];$('#mainContent').innerHTML='<section class="shared-panel"><h2>Acesso ao caso indisponível.</h2><p>O caso pode ter sido reatribuído ou seu acesso removido.</p></section>';}}
    finally{polling=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(poll,15000);setInterval(checkAlerts,60000);
  try{await loadOffice();await navigate(location.hash.slice(1)||'inicio',true);}
  catch(error){officeHeader();connection('Não foi possível conectar');$('#mainContent').innerHTML=`<section class="shared-panel"><h1>Não foi possível abrir o escritório.</h1><p>${e(S.message(error))}</p>${button('Tentar novamente','refresh')}</section>`;}
})();
