(() => {
  'use strict';
  const client = () => window.EloAuth.client();
  async function result(request) { const {data,error}=await request; if(error) throw error; return data; }
  const caseColumns='id,office_id,number,title,client_name,area,instructions,due_date,assignee_id,created_by,status,revision,updated_by,created_at,updated_at';
  const offices=()=>result(client().from('offices').select('id,name,responsible_user_id').order('created_at'));
  const members=id=>result(client().from('office_members').select('*').eq('office_id',id).order('joined_at'));
  const cases=id=>result(client().from('office_cases').select(caseColumns).eq('office_id',id).order('updated_at',{ascending:false}).limit(200));
  const one=id=>result(client().from('office_cases').select('*').eq('id',id).single());
  const comments=id=>result(client().from('case_comments').select('*').eq('case_id',id).order('created_at'));
  const versions=id=>result(client().from('case_versions').select('id,case_id,revision,label,created_by,created_at').eq('case_id',id).order('created_at',{ascending:false}).limit(50));
  const version=id=>result(client().from('case_versions').select('*').eq('id',id).single());
  const activity=id=>result(client().from('office_activity').select('*').eq('case_id',id).order('created_at',{ascending:false}).limit(50));
  const invitations=id=>result(client().from('office_invitations').select('id,email,role,created_at,expires_at,accepted_at,revoked_at').eq('office_id',id).order('created_at',{ascending:false}).limit(100));
  const command=(action,data)=>result(client().rpc('workspace_command',{p_action:action,p_data:data}));
  function message(error) {
    const messages={access_denied:'Você não tem permissão para esta ação ou o acesso foi removido.',session_missing:'Sua sessão terminou. Entre novamente.',invite_invalid:'Convite indisponível. Entre com o e-mail convidado e verifique se o link ainda é válido.',already_member:'Esta conta já faz parte do escritório.',invalid_role:'Escolha uma permissão válida.',invite_limit:'O limite de convites por hora foi atingido. Aguarde para gerar outro.',owner_protected:'O responsável pelo escritório mantém o acesso de administrador.',member_missing:'Esse integrante não está mais ativo. Atualize a equipe.',reassign_first:'Reatribua os casos abertos desse integrante antes de remover seu acesso.',case_approved:'Este caso foi aprovado e está em leitura.',version_conflict:'Outra pessoa atualizou este caso. Seu texto foi mantido nesta tela; confira a versão salva antes de continuar.',read_only:'A minuta está em revisão. Aguarde a devolutiva para continuar a elaboração.',invalid_document:'O documento excede os limites ou contém uma formatação incompatível.',invalid_transition:'A etapa do caso mudou. Atualize os dados antes de continuar.',self_approval:'A aprovação deve ser feita por outro revisor, diferente do responsável pela elaboração.',pending_comments:'Resolva os comentários impeditivos antes de aprovar.',comment_required:'Registre um comentário com os ajustes solicitados antes de devolver.',empty_document:'Escreva o conteúdo da minuta antes de enviar.'};
    if(messages[error?.message]) return messages[error.message];
    if(error?.code==='42501') return messages.access_denied;
    if(['23514','23502','22P02','22007'].includes(error?.code)) return 'Confira os campos informados e tente novamente.';
    return 'Não foi possível confirmar a operação. Confira sua conexão e tente novamente.';
  }
  window.EloShared={offices,members,cases,one,comments,versions,version,activity,invitations,command,message};
})();
