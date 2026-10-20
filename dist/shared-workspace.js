(async () => {
  'use strict';
  const A=window.EloAuth,S=window.EloShared,R=window.EloRich,E=window.EloEditor,P=window.EloPages;
  const user=await A.requireUser(); if(!user)return;
  document.documentElement.removeAttribute('data-session-required');
  const $=s=>document.querySelector(s),e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roles={admin:'Administrador',reviewer:'Advogado / revisor',collaborator:'Colaborador'};
  const statuses={working:'Em elaboração',review:'Para revisar',changes:'Ajustes solicitados',approved:'Aprovado internamente'};
  const initials=name=>String(name).split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const when=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
  const day=value=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'Sem data definida';
  const code=c=>'ELO-'+String(c.number).padStart(4,'0');
  const button=(text,action,cls='secondary',extra='')=>`<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${text}</button>`;
  const errorBox='<div class="form-error" role="alert" tabindex="-1" hidden></div>';
  let offices=[],office=null,members=[],cases=[],invites=[],selected=null,comments=[],versions=[],activity=[];
  let view='inicio',tab='document',queue=null,editorItem=null,saveTimer,noticeTimer,loading=false,polling=false,search='',latestRemote=null,sessionValid=true;
  const member=id=>members.find(m=>m.user_id===id);
  const role=()=>member(user.id)?.removed_at?null:member(user.id)?.role;
  const manager=()=>['admin','reviewer'].includes(role());
  const canEdit=()=>selected&&selected.status!=='approved'&&(manager()||(selected.assignee_id===user.id&&['working','changes'].includes(selected.status)));
  const badge=c=>`<span class="status status-${e(c.status)}">${e(statuses[c.status])}</span>`;
  const activeMembers=()=>members.filter(m=>!m.removed_at);
  function notify(text){$('#notice').textContent=text;$('#notice').classList.add('shown');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('shown'),6500);}
  function connection(text){$('#connectionStatus').textContent=text;}
  function formError(form,error){const node=form.querySelector('.form-error');node.textContent=S.message(error);node.hidden=false;node.focus();}
  function busy(form,value){form.setAttribute('aria-busy',String(value));form.querySelectorAll('input,select,textarea,button').forEach(n=>n.disabled=value);}
  function teardown(){clearTimeout(saveTimer);P.unmount();E.unmount();}
  function dialog(title,content){const d=$('#workspaceDialog');if(d.open)d.close();d.innerHTML=`<div class="dialog-heading"><h2>${e(title)}</h2>${button('×','close','','aria-label="Fechar janela"')}</div><div class="dialog-content">${content}</div>`;d.showModal();}
  function officeHeader(){
    $('#accountName').textContent=A.displayName();$('#accountAvatar').textContent=initials(A.displayName());
    $('#officeName').textContent=office?.name||'Seu escritório';$('#officeRole').textContent=roles[role()]||'Sem escritório ativo';$('#officeAvatar').textContent=initials(office?.name||'EloJus');
    const select=$('#officeSelect');select.hidden=offices.length<2;select.innerHTML=offices.map(o=>`<option value="${e(o.id)}" ${o.id===office?.id?'selected':''}>${e(o.name)}</option>`).join('');
    for(const n of document.querySelectorAll('nav [data-route]'))n.classList.toggle('active',n.dataset.route===view);
    $('#viewLabel').textContent=({inicio:'Minha mesa',casos:'Casos',revisoes:'Revisões',equipe:'Equipe e convites',trabalho:'Caso',convite:'Convite'})[view]||'Minha mesa';
  }
  async function loadOffice(id){
    offices=await S.offices();office=offices.find(o=>o.id===id)||offices[0]||null;
    if(!office){members=[];cases=[];return;}
    [members,cases]=await Promise.all([S.members(office.id),S.cases(office.id)]);
    if(!role())throw Object.assign(new Error('access_denied'),{code:'42501'});
    invites=role()==='admin'?await S.invitations(office.id):[];
    connection('Conectado · dados do escritório sincronizados');
  }
  function noOffice(){return `<section class="shared-panel shared-invite-page"><div class="eyebrow">BEM-VINDO À ELOJUS</div><h1>Seu trabalho começa em um escritório.</h1><p>Abra o link recebido do administrador para aceitar um convite. Se você é o responsável, cadastre seu escritório.</p><div class="form-actions"><a class="button primary" href="cadastro-escritorio.html">Cadastrar escritório →</a>${button('Verificar acesso','refresh')}</div></section>`;}
  function caseList(){
    const items=cases.filter(c=>(view!=='revisoes'||c.status==='review')&&`${c.title} ${c.client_name} ${code(c)} ${member(c.assignee_id)?.display_name||''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
    if(!items.length)return `<section class="shared-panel empty-state"><h2>${cases.length?'Nenhum caso nesta seleção.':'O primeiro caso começa aqui.'}</h2><p>${manager()?'Crie uma entrega, defina um responsável e reúna as orientações para a equipe.':'Os casos atribuídos a você aparecerão aqui, com a minuta e as orientações do responsável.'}</p>${manager()?button('Criar caso','newCase','primary'):button('Atualizar casos','refresh')}</section>`;
    return items.map(c=>`<article class="shared-case"><a href="#trabalho/${e(c.id)}" data-route="trabalho/${e(c.id)}"><div class="eyebrow">${e(code(c))} · ${e(c.area)}</div><h2>${e(c.title)}</h2><p>${e(c.client_name)}</p></a><div><small>RESPONSÁVEL</small><p>${e(member(c.assignee_id)?.display_name||'Integrante')}</p></div><div><small>ENTREGA INTERNA</small><p>${e(day(c.due_date))}</p></div><div>${badge(c)}</div></article>`).join('');
  }
  function home(){return `<div class="page-heading"><div><div class="eyebrow">${e(office.name)} · TRABALHO COMPARTILHADO</div><h1>${view==='revisoes'?'Uma revisão faz avançar.':view==='casos'?'Casos, com contexto.':'Sua mesa de trabalho.'}</h1><p>${role()==='collaborator'?'Seus casos, orientações e devolutivas no mesmo lugar.':'Acompanhe as entregas e o próximo passo de cada pessoa.'}</p></div>${manager()?button('Novo caso +','newCase','primary'):button('Atualizar','refresh')}</div>
    <div class="shared-stats"><div><span>Em elaboração</span><strong>${cases.filter(c=>['working','changes'].includes(c.status)).length}</strong></div><div><span>Para revisar</span><strong>${cases.filter(c=>c.status==='review').length}</strong></div><div><span>Integrantes ativos</span><strong>${activeMembers().length}</strong></div></div>
    ${activeMembers().length===1&&role()==='admin'?`<div class="shared-callout">Seu escritório já está conectado. Convide a segunda pessoa para distribuir uma entrega e iniciar a revisão em equipe. <a class="button text-button" href="#equipe" data-route="equipe">Abrir equipe e convites →</a></div>`:''}
    <div class="shared-toolbar"><label class="sr-only" for="caseSearch">Buscar casos</label><input class="shared-input" id="caseSearch" type="search" placeholder="Buscar caso, cliente ou responsável" value="${e(search)}">${button('Atualizar casos','refresh')}</div><div class="case-list" id="caseList">${caseList()}</div><p class="form-help" style="margin-top:16px">Até 200 casos recentes. As permissões determinam quais casos aparecem para você.</p>`;}
  function team(){return `<div class="page-heading"><div><div class="eyebrow">${e(office.name)}</div><h1>Um escritório. Uma equipe.</h1><p>Defina quem participa e como cada pessoa pode contribuir.</p></div>${role()==='admin'?button('Convidar pessoa +','invite','primary'):''}</div>
    <div class="shared-grid"><section class="shared-panel"><h2>Pessoas do escritório</h2><p>${activeMembers().length} ${activeMembers().length===1?'integrante ativo':'integrantes ativos'} · acesso por conta individual</p><div class="member-list">${activeMembers().map(m=>`<div class="member-row"><span class="avatar">${e(initials(m.display_name))}</span><div class="member-main"><strong>${e(m.display_name)}${m.user_id===user.id?' · você':''}</strong><small>${e(m.email)}</small></div><span class="role-tag">${e(roles[m.role])}</span>${role()==='admin'&&m.user_id!==office.responsible_user_id?`<div class="member-actions">${button('Permissão','memberRole','quiet',`data-id="${e(m.user_id)}"`)}${button('Remover acesso','removeMember','quiet',`data-id="${e(m.user_id)}"`)}</div>`:''}</div>`).join('')}</div></section>
    <aside class="shared-panel"><div class="eyebrow">ACESSO COM RESPONSABILIDADE</div><h2>Cada pessoa, seu papel.</h2><ul class="permission-list"><li><strong>Administrador</strong><p>Responsável pelo escritório. Gerencia convites e acessos, cria casos, distribui e revisa entregas.</p></li><li><strong>Advogado / revisor</strong><p>Consulta os casos do escritório, cria e distribui entregas, comenta e revisa. Não gerencia a equipe.</p></li><li><strong>Colaborador</strong><p>Consulta apenas os casos atribuídos a ele. Elabora, comenta e envia para revisão; não aprova entregas.</p></li></ul><p class="form-help">Quem está responsável pela elaboração não pode aprovar a própria entrega.</p></aside></div>
    ${role()==='admin'?`<section class="shared-panel" style="margin-top:24px"><h2>Convites</h2><p>Links pessoais, vinculados ao e-mail e válidos por 7 dias. O envio automático de e-mails ainda não está configurado.</p>${invites.length?`<div class="member-list">${invites.map(i=>`<div class="member-row"><div class="member-main"><strong>${e(i.email)}</strong><small>${e(roles[i.role])} · ${i.accepted_at?'Aceito em '+e(when(i.accepted_at)):i.revoked_at?'Revogado':new Date(i.expires_at)<=new Date()?'Expirado':'Válido até '+e(when(i.expires_at))}</small></div>${!i.accepted_at&&!i.revoked_at&&new Date(i.expires_at)>new Date()?button('Revogar','revokeInvite','quiet',`data-id="${e(i.id)}"`):''}</div>`).join('')}</div>`:'<div class="shared-callout">Nenhum convite criado. Comece pelo colega que participará da primeira entrega.</div>'}</section>`:''}`;}
  function caseForm(c){return `<form id="caseForm" class="shared-form" data-edit="${c?'true':'false'}"><label>Nome do caso ou entrega<input name="title" required minlength="2" maxlength="180" value="${e(c?.title)}" placeholder="Ex.: Revisão de contrato de prestação de serviços"></label><div class="form-row"><label>Cliente ou referência<input name="client_name" required minlength="2" maxlength="180" value="${e(c?.client_name)}"></label><label>Área<input name="area" maxlength="80" value="${e(c?.area||'Cível')}"></label></div><div class="form-row"><label>Responsável pela elaboração<select name="assignee_id" required>${activeMembers().map(m=>`<option value="${e(m.user_id)}" ${m.user_id===(c?.assignee_id||user.id)?'selected':''}>${e(m.display_name)} · ${e(roles[m.role])}</option>`).join('')}</select></label><label>Entrega interna<input name="due_date" type="date" value="${e(c?.due_date)}"><span class="form-help">Não calcula prazo processual.</span></label></div><label>Orientações para a equipe<textarea name="instructions" maxlength="10000" placeholder="Objetivo, informações disponíveis e pontos que precisam de conferência.">${e(c?.instructions)}</textarea></label><p class="form-help">Administradores e revisores veem todos os casos. Colaboradores veem apenas os casos atribuídos a eles.</p>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">${c?'Salvar alterações':'Criar caso no escritório'} →</button></div></form>`;}
  function saveState(s){
    if(selected?.id!==s.row.id)return;
    selected={...selected,...s.row};
    const status=$('#saveStatus');if(status)status.textContent=s.error?'Não salvo · '+S.message(s.error):s.busy?'Salvando no Supabase…':s.dirty?'Alterações a salvar…':'Salvo no Supabase · revisão '+s.row.revision;
    if(s.error){connection('Há alterações não salvas');showConflict(S.message(s.error));}
    else if(!s.dirty&&!s.busy)connection('Conectado · alterações salvas');
  }
  function createQueue(row){
    queue=window.EloSharedSave.create(row,(document,revision)=>S.command('save_case',{office_id:row.office_id,case_id:row.id,document,revision}),()=>S.one(row.id),saveState);
  }
  async function flush(){clearTimeout(saveTimer);if(!queue)return true;const ok=await queue.flush();if(!ok)notify('Não saímos do caso: há alterações ainda não salvas.');return ok;}
  function showConflict(text){const box=$('#conflict');if(box){box.hidden=false;box.querySelector('p').textContent=text;}}
  function commentList(){return comments.map(c=>`<article class="shared-comment ${c.resolved_at?'resolved':''}"><div class="comment-author"><strong>${e(member(c.author_id)?.display_name||'Integrante')}</strong><small>${c.resolved_at?'Resolvido':c.blocking?'Impeditivo':'Comentário'}</small></div>${c.quote?`<blockquote>${e(c.quote)}</blockquote><small>Trecho selecionado na revisão ${c.document_revision}; confira se o texto mudou.</small>`:''}<p>${e(c.body)}</p><small>${e(when(c.created_at))}</small>${manager()&&selected.status!=='approved'?`<div>${button(c.resolved_at?'Reabrir':'Resolver','resolve','text-button',`data-id="${e(c.id)}" data-resolved="${!c.resolved_at}"`)}</div>`:''}</article>`).join('')||'<p class="form-help">Registre uma orientação ou dúvida para a equipe.</p>';}
  function editor(){
    const editable=canEdit();
    editorItem={id:selected.id,fullDocument:true,sections:[{id:'corpo',title:'Texto da peça',omitTitle:true,delta:queue.state().draft}]};
    return `<div class="editor-layout shared-editor"><section class="editor-area"><div class="save-line"><span id="saveStatus" role="status">Salvo no Supabase · revisão ${selected.revision}</span>${button('Salvar agora','save')}</div>${editable?E.toolbar():`<div class="shared-callout">${selected.status==='approved'?'Versão aprovada · leitura.':'Minuta em leitura para sua permissão nesta etapa.'}</div>`}<article class="paper"><header class="paper-heading"><p>${e(office.name)} · ${e(code(selected))}</p></header><section class="continuous-section">${editable?'<div data-rich-section="corpo"></div>':`<div class="rich-preview">${R.html(editorItem.sections[0])}</div>`}</section><p class="document-disclaimer">${e(selected.title)} · Entrega interna sujeita à revisão profissional.</p></article></section><aside class="review-panel"><h2>Conversa da revisão</h2>${selected.status!=='approved'?`<form id="commentForm" class="shared-form"><label>Comentário<textarea name="body" required maxlength="4000" placeholder="Deixe uma orientação clara para a próxima etapa."></textarea></label><label>Trecho de referência<textarea name="quote" maxlength="1000" readonly placeholder="Opcional: selecione um trecho da minuta."></textarea></label>${button('Usar trecho selecionado','quote','text-button')}${manager()?'<label class="checkbox-label"><input name="blocking" type="checkbox"> Impede aprovação até ser resolvido</label>':''}${errorBox}<button class="button primary" type="submit">Adicionar comentário</button></form>`:''}<div id="commentList" style="margin-top:20px">${commentList()}</div></aside></div>`;
  }
  function context(){return `<section class="shared-panel"><h2>Contexto da entrega</h2><dl class="context-values"><div><dt>Cliente / referência</dt><dd>${e(selected.client_name)}</dd></div><div><dt>Área</dt><dd>${e(selected.area)}</dd></div><div><dt>Elaboração</dt><dd>${e(member(selected.assignee_id)?.display_name)}</dd></div><div><dt>Entrega interna</dt><dd>${e(day(selected.due_date))}</dd></div><div class="wide"><dt>Orientações</dt><dd>${e(selected.instructions||'Nenhuma orientação registrada.')}</dd></div></dl>${manager()&&selected.status!=='approved'?button('Editar contexto e responsável','editCase'):''}<div class="shared-callout">O compartilhamento desta etapa inclui casos, texto da minuta, comentários e versões. Os anexos da demonstração continuam locais e não são enviados automaticamente para este escritório.</div></section>`;}
  function historyContent(){return `<div class="shared-grid"><section class="shared-panel"><h2>Versões registradas</h2><p>Registros de trabalho, envio e aprovação preservam o conteúdo da minuta.</p><ul class="shared-history">${versions.map(v=>`<li><strong>${e(v.label)}</strong><small>${e(member(v.created_by)?.display_name||'Integrante')} · ${e(when(v.created_at))} · revisão ${v.revision}</small><div>${button('Abrir versão','viewVersion','secondary',`data-id="${e(v.id)}"`)}</div></li>`).join('')||'<li>Nenhuma versão registrada ainda.</li>'}</ul></section><section class="shared-panel"><h2>Atividade do caso</h2><ul class="shared-history">${activity.map(a=>`<li><strong>${e(a.action)}</strong><small>${e(member(a.actor_id)?.display_name||'Integrante')} · ${e(when(a.created_at))}</small></li>`).join('')}</ul></section></div>`;}
  function casePage(){return `<div class="shared-case-heading"><a class="back-link" href="#casos" data-route="casos">← Todos os casos</a><div class="eyebrow">${e(code(selected))} · ${e(selected.area)} · ${e(selected.client_name)}</div><h1>${e(selected.title)}</h1><div class="heading-bottom"><p>${e(member(selected.assignee_id)?.display_name||'Integrante')} · elaboração &nbsp; / &nbsp; Entrega: ${e(day(selected.due_date))}</p>${badge(selected)}</div></div><div class="shared-case-actions">${canEdit()?button('Registrar versão','version'):''}${canEdit()&&['working','changes'].includes(selected.status)?button('Enviar para revisão →','submit','primary'):''}${manager()&&selected.status==='review'?button('Solicitar ajustes','return')+button('Aprovar minuta','approve','primary',selected.assignee_id===user.id?'disabled title="Outro revisor deve aprovar esta entrega"':''):''}${button('Exportar documento','exportMenu')}${button('Atualizar caso','refresh')}</div><div id="conflict" class="shared-conflict" hidden><p></p>${button('Conferir versão salva','compare')}${button('Baixar meu rascunho','export')}${button('Carregar versão salva','reloadCase')}</div><div class="shared-case-tabs" role="tablist" aria-label="Conteúdo do caso">${[['document','Minuta e comentários'],['context','Contexto'],['history','Versões e atividade']].map(([key,label])=>`<button role="tab" aria-selected="${tab===key}" class="${tab===key?'active':''}" data-action="tab" data-tab="${key}">${label}</button>`).join('')}</div>${tab==='context'?context():tab==='history'?historyContent():editor()}`;}
  function render(){
    teardown();officeHeader();$('#mainContent').classList.toggle('case-content',view==='trabalho');
    $('#mainContent').innerHTML=!office?noOffice():view==='equipe'?team():view==='trabalho'&&selected?casePage():home();
    if(view==='trabalho'&&selected&&tab==='document'){
      if(canEdit())E.mount(editorItem,()=>{queue.edit(R.delta(editorItem.sections[0]));clearTimeout(saveTimer);if(!queue.state().error)saveTimer=setTimeout(()=>queue.flush(),1000);});
      P.mount();saveState(queue.state());
    }
  }
  async function openCase(id){
    const row=await S.one(id);
    if(office?.id!==row.office_id)await loadOffice(row.office_id);
    selected=row;createQueue(row);latestRemote=null;
    [comments,versions,activity]=await Promise.all([S.comments(id),S.versions(id),S.activity(id)]);
    tab='document';
  }
  async function invitePage(token){
    teardown();view='convite';officeHeader();$('#mainContent').innerHTML='<section class="shared-panel shared-invite-page"><h2>Conferindo seu convite…</h2></section>';
    try{const info=await S.command('preview_invite',{token});$('#mainContent').innerHTML=`<section class="shared-panel shared-invite-page"><div class="eyebrow">CONVITE PARA TRABALHAR EM EQUIPE</div><h1>${e(info.name)}</h1><p style="margin-top:18px">Você foi convidado como <strong>${e(roles[info.role])}</strong>, com a conta ${e(info.email)}.</p><div class="shared-callout">${info.role==='reviewer'?'Você poderá consultar os casos do escritório, distribuir entregas e revisar o trabalho da equipe.':'Você poderá consultar e elaborar os casos atribuídos a você e enviá-los para revisão.'}</div><p class="form-help">Válido até ${e(when(info.expires_at))}. A entrada não ativa cobrança.</p><div class="form-actions">${button('Aceitar convite e entrar','acceptInvite','primary')}</div></section>`;}
    catch(error){$('#mainContent').innerHTML=`<section class="shared-panel shared-invite-page"><h1>Vamos conferir seu acesso.</h1><p style="margin:20px 0">${e(S.message(error))}</p><p class="form-help">Conta atual: ${e(user.email)}. Se necessário, saia e entre com o e-mail que recebeu o convite.</p><div class="form-actions">${button('Trocar de conta','switchAccount')}${button('Tentar novamente','refresh')}</div></section>`;}
  }
  async function navigate(route,replace=false){
    if(loading||!sessionValid)return;loading=true;
    try{
      if(!await flush())return;
      const [page,id]=route.split('/');
      if(page==='convite'){history[replace?'replaceState':'pushState'](null,'','#'+route);await invitePage(id);return;}
      if(page==='trabalho'&&id){view='trabalho';await openCase(id);}else{selected=null;queue=null;view=['inicio','casos','revisoes','equipe'].includes(page)?page:'inicio';await loadOffice(office?.id);}
      history[replace?'replaceState':'pushState'](null,'','#'+(view==='trabalho'?'trabalho/'+selected.id:view));render();$('#mainContent').focus({preventScroll:true});window.scrollTo(0,0);
    }catch(error){connection('Não foi possível atualizar');notify(S.message(error));if(!$('#mainContent').querySelector('h1,h2'))render();}
    finally{loading=false;}
  }
  async function updateCase(action,data={}){
    if(!await flush())return false;
    const result=await S.command(action,{office_id:office.id,case_id:selected.id,revision:queue.state().row.revision,...data});
    selected=result;queue.reset(result);[comments,versions,activity]=await Promise.all([S.comments(result.id),S.versions(result.id),S.activity(result.id)]);render();return true;
  }
  function exportDraft(){
    if(!selected)return;const blob=new Blob(['\ufeff'+R.text({delta:queue.state().draft})],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=code(selected)+'-minuta.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  document.addEventListener('input',ev=>{if(ev.target.id==='caseSearch'){search=ev.target.value;$('#caseList').innerHTML=caseList();}});
  document.addEventListener('submit',async ev=>{
    const form=ev.target;if(!['caseForm','inviteForm','commentForm','memberForm','confirmForm'].includes(form.id))return;ev.preventDefault();if(form.getAttribute('aria-busy')==='true')return;
    const data=Object.fromEntries(new FormData(form));busy(form,true);form.querySelector('.form-error').hidden=true;
    try{
      if(form.id==='caseForm'){
        if(form.dataset.edit==='true'){if(!await updateCase('assign',data))return;}
        else{form.dataset.caseId||=crypto.randomUUID();const row=await S.command('create_case',{...data,office_id:office.id,id:form.dataset.caseId});$('#workspaceDialog').close();await navigate('trabalho/'+row.id);notify('Caso salvo no escritório.');return;}
        $('#workspaceDialog').close();notify('Contexto atualizado.');
      }else if(form.id==='inviteForm'){
        const result=await S.command('invite',{...data,office_id:office.id}),url=new URL('index.html',location.href);url.hash='convite/'+result.token;
        const d=$('#workspaceDialog');d.innerHTML=`<div class="dialog-heading"><h2>Convite pronto para compartilhar.</h2>${button('×','close','','aria-label="Fechar janela"')}</div><p>Somente a conta <strong>${e(data.email)}</strong> poderá aceitar este convite como ${e(roles[data.role])}.</p><div class="invite-result"><label for="inviteLink">Link do convite</label><textarea id="inviteLink" readonly>${e(url.href)}</textarea>${button('Copiar link','copyInvite','primary')}<p class="form-help" style="margin-top:12px">Válido até ${e(when(result.expires_at))}. Este link não foi enviado por e-mail. No ambiente local, a outra pessoa precisa abrir o link neste mesmo computador.</p></div>`;
        invites=await S.invitations(office.id);if(view==='equipe')render();
      }else if(form.id==='commentForm'){
        data.blocking=data.blocking==='on';if(await updateCase('comment',data))notify('Comentário compartilhado com a equipe.');
      }else if(form.id==='memberForm'){
        await S.command('member_role',{office_id:office.id,user_id:form.dataset.id,role:data.role});await loadOffice(office.id);$('#workspaceDialog').close();render();notify('Permissão atualizada.');
      }else if(form.id==='confirmForm'){
        const action=form.dataset.action;
        if(action==='approve'){if(!await updateCase('approve'))return;}
        else if(action==='reloadCase'){await openCase(selected.id);render();}
        else{await S.command(action,{office_id:office.id,...(action==='remove_member'?{user_id:form.dataset.id}:{id:form.dataset.id})});await loadOffice(office.id);render();}
        $('#workspaceDialog').close();notify(action==='approve'?'Minuta aprovada internamente.':'Alteração concluída.');
      }
    }catch(error){if(form.isConnected)formError(form,error);else notify(S.message(error));}
    finally{if(form.isConnected)busy(form,false);}
  });
  document.addEventListener('click',async ev=>{
    const link=ev.target.closest('[data-route]'),b=ev.target.closest('button[data-action]');
    if(link){ev.preventDefault();await navigate(link.dataset.route);return;}if(!b||b.disabled)return;
    const action=b.dataset.action;if(action==='close'){$('#workspaceDialog').close();return;}
    b.disabled=true;
    try{
      if(action==='newCase')dialog('Criar caso',caseForm(null));
      else if(action==='editCase'){if(await flush())dialog('Contexto e responsável',caseForm(selected));}
      else if(action==='invite')dialog('Convidar para o escritório',`<form id="inviteForm" class="shared-form"><label>E-mail da pessoa<input name="email" type="email" required maxlength="254" placeholder="colega@escritorio.com.br" autocomplete="email"></label><label>Permissão<select name="role"><option value="collaborator">Colaborador · apenas os casos atribuídos</option><option value="reviewer">Advogado / revisor · todos os casos do escritório</option></select></label><p class="form-help">O convite será vinculado a este e-mail e válido por 7 dias. Você receberá um link para compartilhar.</p>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">Gerar convite →</button></div></form>`);
      else if(action==='copyInvite'){try{await navigator.clipboard.writeText($('#inviteLink').value);notify('Link copiado.');}catch{$('#inviteLink').select();notify('Selecione e copie o link acima.');}}
      else if(action==='memberRole'){const m=member(b.dataset.id);dialog('Alterar permissão',`<form id="memberForm" class="shared-form" data-id="${e(m.user_id)}"><p>${e(m.display_name)} · ${e(m.email)}</p><label>Permissão<select name="role"><option value="collaborator" ${m.role==='collaborator'?'selected':''}>Colaborador · casos atribuídos</option><option value="reviewer" ${m.role==='reviewer'?'selected':''}>Advogado / revisor · todos os casos</option></select></label>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary">Salvar permissão</button></div></form>`);}
      else if(['removeMember','revokeInvite','approve','reloadCase'].includes(action)){
        const text=action==='removeMember'?`Remover o acesso de ${member(b.dataset.id)?.display_name}? O histórico será preservado e casos abertos precisam ser reatribuídos antes.`:action==='revokeInvite'?'Revogar este convite? O link deixará de permitir a entrada no escritório.':action==='approve'?'Confirmar a revisão desta minuta? O conteúdo aprovado ficará em leitura. Esta aprovação é interna e não assina nem protocola o documento.':'Carregar a versão salva no Supabase? Alterações não salvas desta tela serão substituídas. Baixe seu rascunho antes, se precisar preservá-lo.';
        dialog(action==='approve'?'Aprovar minuta':'Confirmar alteração',`<form id="confirmForm" class="shared-form" data-action="${({removeMember:'remove_member',revokeInvite:'revoke_invite'})[action]||action}" data-id="${e(b.dataset.id||'')}"><p>${e(text)}</p>${errorBox}<div class="form-actions">${button('Cancelar','close')}<button class="button primary" type="submit">Confirmar</button></div></form>`);
      }
      else if(action==='refresh'){
        if(view==='convite')await invitePage(location.hash.split('/')[1]);
        else if(selected){if(!await flush())return;await openCase(selected.id);render();}
        else{await loadOffice(office?.id);render();}
      }else if(action==='save'){if(await flush())notify('Minuta salva no Supabase.');}
      else if(['submit','version','return'].includes(action)){if(await updateCase(action))notify(action==='submit'?'Minuta enviada para revisão.':action==='return'?'Ajustes solicitados.':'Versão registrada.');}
      else if(action==='tab'){if(await flush()){tab=b.dataset.tab;render();}}
      else if(action==='resolve')await updateCase('resolve_comment',{id:b.dataset.id,resolved:b.dataset.resolved==='true'});
      else if(action==='quote'){const selection=E.selection();if(selection)$('#commentForm [name="quote"]').value=selection.text.slice(0,1000);else notify('Selecione um trecho na minuta para vinculá-lo ao comentário.');}
      else if(action==='viewVersion'||action==='compare'){
        const row=action==='compare'?await S.one(selected.id):await S.version(b.dataset.id);
        dialog(action==='compare'?'Versão salva no escritório':'Versão preservada',`<p class="form-help">Revisão ${row.revision} · ${e(when(row.updated_at||row.created_at))}</p><div class="shared-version-preview rich-preview">${R.html({delta:row.document})}</div><div class="form-actions">${button('Fechar','close')}</div>`);
      }else if(action==='export')exportDraft();
      else if(action==='exportMenu')dialog('Exportar a minuta',`<p>O arquivo contém apenas o texto e a formatação da minuta. Comentários e orientações internas não acompanham a exportação.</p><div class="form-actions">${button('Word · DOCX','downloadShared','primary','data-format="docx"')}${button('PDF','downloadShared','secondary','data-format="pdf"')}${button('Texto · TXT','export')}</div><p id="downloadStatus" class="form-help" role="status"></p>`);
      else if(action==='downloadShared'){
        const snapshot={id:code(selected),title:selected.title,documentTitle:selected.title,fullDocument:true,shared:true,sections:[{id:'corpo',title:'Minuta',omitTitle:true,delta:queue.state().draft}]};
        const status=$('#downloadStatus');status.textContent='Preparando o arquivo…';
        try{const blob=await window.EloExport.create(snapshot,b.dataset.format,'A4'),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=snapshot.id+'-minuta.'+b.dataset.format;link.textContent='Baixar arquivo';link.className='button secondary';status.replaceChildren(link);link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){status.textContent='Não foi possível exportar agora. Tente novamente ou use o formato TXT.';}
      }
      else if(action==='acceptInvite'){const joined=await S.command('accept_invite',{token:location.hash.split('/')[1]});await loadOffice(joined.office_id);await navigate('inicio',true);notify('Você agora faz parte do escritório.');}
      else if(action==='logout'||action==='switchAccount'){if(!await flush())return;const next=action==='switchAccount'?A.safeRoute(location.hash):'#inicio';await A.logout();location.assign('login.html?next='+encodeURIComponent(next));}
    }catch(error){notify(S.message(error));if(error.message==='version_conflict')showConflict(S.message(error));}
    finally{if(b.isConnected)b.disabled=false;}
  });
  $('#officeSelect').addEventListener('change',async ev=>{const id=ev.target.value;if(!await flush()){ev.target.value=office.id;return;}try{selected=null;queue=null;await loadOffice(id);await navigate('inicio');}catch(error){notify(S.message(error));}});
  window.addEventListener('popstate',()=>{const wanted=location.hash.slice(1);if(queue?.state().dirty){history.pushState(null,'','#trabalho/'+selected.id);notify('Salve ou preserve o rascunho antes de sair.');return;}navigate(wanted,true);});
  window.addEventListener('beforeunload',event=>{if(queue?.state().dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('elo-auth-change',event=>{if(event.detail.event==='SIGNED_OUT'||(event.detail.userId&&event.detail.userId!==user.id)){sessionValid=false;clearTimeout(saveTimer);teardown();queue=null;selected=null;$('#mainContent').replaceChildren();location.replace('login.html?reason=session');}});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  async function poll(){
    if(polling||loading||document.hidden||!sessionValid||!office||view==='convite'||$('#workspaceDialog').open)return;
    polling=true;
    try{
      const freshMembers=await S.members(office.id),me=freshMembers.find(m=>m.user_id===user.id&&!m.removed_at);
      if(!me){teardown();queue=null;selected=null;office=null;members=[];cases=[];connection('Acesso ao escritório removido');$('#mainContent').innerHTML=noOffice();return;}
      const permissionChanged=me.role!==role();members=freshMembers;
      if(permissionChanged){clearTimeout(saveTimer);if(queue?.state().dirty){E.unmount();showConflict('Sua permissão mudou. Baixe o rascunho e atualize o caso para conferir seu acesso.');}else await navigate(view==='trabalho'?'trabalho/'+selected.id:view,true);}
      if(selected){const latest=await S.one(selected.id);if(latest.revision!==queue.state().row.revision){latestRemote=latest;showConflict('Há uma atualização de outra pessoa. Confira a versão salva ou atualize o caso para continuar.');connection('Atualização da equipe disponível');}}
      else if(!document.activeElement?.matches('input,textarea,select')){const nextCases=await S.cases(office.id);const changed=JSON.stringify(cases)!==JSON.stringify(nextCases);cases=nextCases;if(changed&&view!=='equipe')render();}
    }catch(error){connection('Sem sincronização · verifique a conexão');if(selected&&['PGRST116','42501'].includes(error.code)){teardown();queue=null;selected=null;cases=[];$('#mainContent').innerHTML='<section class="shared-panel"><h2>Acesso ao caso indisponível.</h2><p>O caso pode ter sido reatribuído ou seu acesso removido.</p></section>';}}
    finally{polling=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(poll,15000);
  try{await loadOffice();await navigate(location.hash.slice(1)||'inicio',true);}
  catch(error){officeHeader();connection('Não foi possível conectar');$('#mainContent').innerHTML=`<section class="shared-panel"><h1>Não foi possível abrir o escritório.</h1><p>${e(S.message(error))}</p>${button('Tentar novamente','refresh')}</section>`;}
})();
