(() => {
  'use strict';
  const client = () => window.EloAuth.client();
  async function result(request) { const {data,error}=await request; if(error) throw error; return data; }
  let schemaVersion=22;
  async function pages(build){
    const rows=[],size=200;
    for(let start=0;;start+=size){const page=await result(build().range(start,start+size-1));rows.push(...page);if(page.length<size)return rows;}
  }
  const caseColumns='id,office_id,number,title,client_name,area,instructions,due_date,assignee_id,created_by,status,revision,updated_by,created_at,updated_at';
  const offices=()=>result(client().from('offices').select('id,name,responsible_user_id').order('created_at'));
  const members=id=>result(client().from('office_members').select('*').eq('office_id',id).order('joined_at'));
  const cases=id=>pages(()=>client().from('office_cases').select(caseColumns+(schemaVersion>=24?',matter_id,reviewer_id,review_due_date,priority,priority_reason,review_requested_at,review_activity_at,review_activity_by':'')+(schemaVersion>=25?',delivery_source,primary_attachment_id':'')).eq('office_id',id).order('number',{ascending:false}));
  const one=id=>result(client().from('office_cases').select('*').eq('id',id).single());
  const comments=id=>pages(()=>client().from('case_comments').select('*').eq('case_id',id).order('created_at').order('id'));
  const versions=id=>pages(()=>client().from('case_versions').select('id,case_id,revision,label,created_by,created_at'+(schemaVersion>=25?',delivery_source,attachment_id':'')).eq('case_id',id).order('created_at',{ascending:false}).order('id'));
  const version=id=>result(client().from('case_versions').select('*').eq('id',id).single());
  const matters=id=>pages(()=>client().from('office_matters').select('id,name,office_id').eq('office_id',id).order('id'));
  const signals=id=>pages(()=>client().rpc('review_signals',{p_office_id:id}).order('case_id'));
  const rounds=id=>pages(()=>client().from('case_review_rounds').select('*').eq('case_id',id).order('round_number',{ascending:false}));
  const allRounds=id=>pages(()=>client().from('case_review_rounds').select('*,office_cases!inner(office_id)').eq('office_cases.office_id',id).order('id'));
  const pilot=id=>pages(()=>client().from('case_pilot_entries').select('*,office_cases!inner(office_id)').eq('office_cases.office_id',id).order('case_id'));
  const activity=id=>result(client().from('office_activity').select('*').eq('case_id',id).order('created_at',{ascending:false}).limit(50));
  async function invitations(id){
    const all=[],size=200;
    for(let start=0;;start+=size){
      const page=await result(client().from('office_invitations').select('id,email,role,display_name,professional_type,oab_number,oab_state,created_at,expires_at,accepted_at,revoked_at').eq('office_id',id).order('created_at',{ascending:false}).order('id').range(start,start+size-1));
      all.push(...page);if(page.length<size)return all;
    }
  }
  const command=(action,data)=>result(client().rpc('workspace_command',{p_action:action,p_data:data}));
  const attachments=id=>result(client().from('case_attachments').select('*').eq('case_id',id).order('created_at'));
  const fileCommand=(action,data)=>result(client().rpc('attachment_command',{p_action:action,p_data:data}));
  const uploadFile=(path,file,mime)=>result(client().storage.from('case-documents').upload(path,file,{contentType:mime,upsert:false}));
  const downloadFile=path=>result(client().storage.from('case-documents').download(path));
  async function capabilities(){
    const {data,error}=await client().rpc('workspace_capabilities');
    if(error?.code==='PGRST202'){schemaVersion=22;return {version:22};}
    if(error)throw error;schemaVersion=data.version;return data;
  }
  function message(error) {
    if(error?.message==='invalid_writing_file')return window.EloWritingFiles.message;
    const reviewMessages={primary_file_required:'Selecione um Word, PDF ou TXT com envio concluído para ser a peça principal.',invalid_delivery_source:'Escolha o texto do editor ou um arquivo válido.',invalid_reviewer:'Escolha um revisor ativo diferente de quem elabora a peça.',reviewer_required:'Defina um advogado revisor no contexto da peça antes de enviar.',not_designated_reviewer:'Esta decisão cabe ao revisor indicado ou ao administrador.',reassign_reviewer:'Reatribua as revisões abertas antes de alterar o acesso deste integrante.',delivery_summary_required:'Informe um resumo da entrega antes de enviar para revisão.',invalid_priority:'Para prioridade alta, o gestor precisa informar um motivo.',invalid_comment_kind:'Escolha um tipo de assunto permitido para seu acesso.'};
    if(reviewMessages[error?.message])return reviewMessages[error.message];
    const fileMessages={invalid_attachment:'Use PDF, DOCX, TXT, JPG ou PNG, de até 20 MB, com nome de até 180 caracteres.',attachment_limit:'Limite de 10 documentos e 100 MB por peça. Envios pendentes também contam.',attachment_pending:'O arquivo ainda não foi recebido. Selecione o mesmo arquivo para repetir o envio.',attachment_exists:'O arquivo já foi recebido. Use “Concluir envio” para confirmar o anexo.',comment_missing:'Comentário não encontrado. Atualize a conversa.'};
    if(fileMessages[error?.message])return fileMessages[error.message];
    const messages={invalid_team_profile:'Confira o nome, a função e o registro OAB/UF. Estagiários só podem acessar casos atribuídos.', intern_restricted:'Estagiários não podem receber permissão de revisão.', invite_pending:'Já existe um cadastro pendente para este e-mail. Abra a aba Convites para renovar ou revogar o link.', access_denied:'Você não tem permissão para esta ação ou o acesso foi removido.',session_missing:'Sua sessão terminou. Entre novamente.',invite_invalid:'Convite indisponível. Entre com o e-mail convidado e verifique se o link ainda é válido.',already_member:'Esta conta já faz parte do escritório.',invalid_role:'Escolha uma permissão válida.',invite_limit:'O limite de convites por hora foi atingido. Aguarde para gerar outro.',owner_protected:'O responsável pelo escritório mantém o acesso de administrador.',member_missing:'Esse integrante não está mais ativo. Atualize a equipe.',reassign_first:'Reatribua os casos abertos desse integrante antes de remover seu acesso.',case_approved:'Este caso foi aprovado e está em leitura.',version_conflict:'Outra pessoa atualizou este caso. Seu texto foi mantido nesta tela; confira a versão salva antes de continuar.',read_only:'A minuta está em revisão. Aguarde a devolutiva para continuar a elaboração.',invalid_document:'O documento excede os limites ou contém uma formatação incompatível.',invalid_transition:'A etapa do caso mudou. Atualize os dados antes de continuar.',self_approval:'A aprovação deve ser feita por outro revisor, diferente do responsável pela elaboração.',pending_comments:'Resolva os comentários impeditivos antes de aprovar.',comment_required:'Registre um comentário com os ajustes solicitados antes de devolver.',empty_document:'Escreva o conteúdo da minuta antes de enviar.'};
    if(messages[error?.message]) return messages[error.message];
    if(error?.code==='42501') return messages.access_denied;
    if(['23514','23502','22P02','22007'].includes(error?.code)) return 'Confira os campos informados e tente novamente.';
    return 'Não foi possível confirmar a operação. Confira sua conexão e tente novamente.';
  }
  window.EloShared={offices,members,cases,one,comments,versions,version,activity,invitations,command,message,attachments,fileCommand,uploadFile,downloadFile,capabilities,matters,signals,rounds,allRounds,pilot};
})();
