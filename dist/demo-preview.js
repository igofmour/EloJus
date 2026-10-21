// Local demonstration only. This module never changes the authenticated user.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EloDemo=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const origin='http://127.0.0.1:8772';
  const returnUrl='http://127.0.0.1:8768/index.html#inicio';
  const isLocal=location=>location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname);
  const canLaunch=(location,role,preview)=>isLocal(location)&&location.port==='8768'&&role==='admin'&&!preview;
  function destination(action,{location,role,preview,persona}){
    if(!isLocal(location))return null;
    if(action==='previewSara'&&canLaunch(location,role,preview))return origin+'/index.html?persona=intern#inicio';
    if(!preview)return null;
    if(action==='previewReturn')return returnUrl;
    if(action==='previewPersona'&&['admin','intern'].includes(persona))return '/index.html?persona='+persona+'#inicio';
    return null;
  }
  function banner(preview){
    if(!preview)return '';
    return `<section class="demo-preview-bar" aria-label="Demonstração de perfis">
      <div><span class="demo-preview-label">DEMONSTRAÇÃO</span><strong>${preview.persona==='intern'?'Você está na visão da Sara':preview.persona==='admin'?'Você está na visão do Administrador':'Você está na visão de outro estagiário'}</strong><p>Dados fictícios para testar o trabalho em equipe. Sem e-mail ou senha.</p></div>
      <div class="demo-preview-actions"><div class="demo-preview-personas" role="group" aria-label="Alternar perfil de demonstração">
        <button type="button" data-action="previewPersona" data-persona="admin" aria-pressed="${preview.persona==='admin'}">Administrador</button>
        <button type="button" data-action="previewPersona" data-persona="intern" aria-pressed="${preview.persona==='intern'}">Sara · estagiária</button>
      </div><button type="button" class="button quiet" data-action="previewReturn">Voltar ao meu escritório ↗</button></div>
    </section>`;
  }
  async function checkAvailable(fetcher=fetch){
    try{
      const response=await fetcher(origin+'/__qa/status',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(4000)});
      if(!response.ok||(await response.json()).demo!=='elojus-local')throw Error('unavailable');
    }catch{
      throw Error('A demonstração da Sara está indisponível. Inicie o ambiente local de demonstração e tente novamente.');
    }
  }
  return {canLaunch,destination,banner,checkAvailable};
});
