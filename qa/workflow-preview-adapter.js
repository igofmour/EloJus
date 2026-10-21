// This adapter is served ONLY by the loopback QA server, never by the app.
(()=>{
 const requestedPersona=new URLSearchParams(location.search).get('persona');
 const persona=['admin','intern','other'].includes(requestedPersona)?requestedPersona:'intern';
 window.EloDemoPreview=Object.freeze({persona});
 async function request(op,data={}){
  // Explicit fault injection in the isolated QA adapter, never in dist/.
  if(new URLSearchParams(location.search).get('failSave')==='1'&&op==='command'&&data.action==='save_case')throw Error('Falha de conexão simulada para testar recuperação de rascunho.');
  const response=await fetch('/__qa/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({persona,op,...data})});
  const result=await response.json();if(result.error)throw result.error;return result.data;
 }
 let user;
 window.EloAuth={requireUser:async()=>{user=await request('identity');return user;},displayName:()=>user.name,safeRoute:x=>x,logout:async()=>{}};
 window.EloShared={storageLabel:'banco local de testes',capabilities:async()=>{try{return await request('capabilities');}catch(e){if(e.message==='invalid_operation')return {version:23};throw e;}},command:(action,data)=>request('command',{action,data}),fileCommand:(action,data)=>request('fileCommand',{action,data}),message:e=>({
  version_conflict:'Outra pessoa atualizou a peça. Seu rascunho foi preservado.',
  attachment_pending:'O arquivo ainda não foi recebido. Selecione o mesmo arquivo para repetir o envio.',
  access_denied:'Você não tem permissão para esta ação.',
  invalid_attachment:'Use PDF, DOCX, TXT, JPG ou PNG, de até 20 MB.',
  attachment_limit:'Limite de 10 documentos e 100 MB por peça.',
  pending_comments:'Resolva os comentários impeditivos antes de aprovar.',
  reviewer_required:'Defina um advogado revisor no contexto da peça antes de enviar.',
  delivery_summary_required:'Informe um resumo da entrega.',
  invalid_reviewer:'Escolha um revisor ativo diferente de quem elabora.',
  invalid_priority:'Informe o motivo da prioridade alta.',
  not_designated_reviewer:'Esta decisão cabe ao revisor indicado ou ao administrador.'
 }[e.message]||e.message),
 uploadFile:async(path,file,mime)=>{const buffer=await file.arrayBuffer();let text='';for(const b of new Uint8Array(buffer))text+=String.fromCharCode(b);return request('upload',{path,mime,base64:btoa(text)});},
 downloadFile:async path=>{const {base64}=await request('download',{path});return new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))]);}
 };
 for(const op of ['offices','members','cases','one','comments','versions','version','activity','attachments','invitations','matters','signals','rounds','allRounds','pilot'])window.EloShared[op]=id=>request(op,{id});
 document.addEventListener('DOMContentLoaded',()=>{document.querySelector('.app-footer').textContent='Prévia isolada: usuários, dados e documentos fictícios. Nada é enviado ao Supabase. Os dados de teste são descartados ao encerrar o servidor.';});
})();
