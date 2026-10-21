(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloWritingFiles=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const accept='.docx,.pdf,.txt';
  const message='Use Word (.docx), PDF ou TXT. Para um arquivo .doc, salve uma cópia em .docx no Word.';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const supported=name=>/\.(docx|pdf|txt)$/i.test(String(name||''));
  function validate(files){if(files.some(file=>!supported(file.name)))throw Error('invalid_writing_file');}
  function render({files=[],editable=false,enabled=true,local=false,busy=false}={}){
    const visible=files.filter(file=>supported(file.name));
    if(!editable&&!visible.length)return '';
    const action=local?'data-attachment-action':'data-action';
    return `<section class="writing-files" aria-label="Arquivos na redação">
      <div class="writing-files-heading"><div><h3>${editable?'Já escreveu a peça em outro programa?':'Arquivos anexados à redação'}</h3><p>Anexe o arquivo original para leitura e download. O texto do editor será mantido.</p></div>
      ${editable&&enabled?`<button type="button" class="button secondary" ${action}="${local?'uploadDraft':'addDraftFiles'}" ${busy?'disabled':''}>${busy?'Enviando…':'Anexar Word, PDF ou TXT'}</button>`:''}</div>
      <p class="writing-files-help">${enabled?'Word (.docx), PDF ou TXT · até 20 MB por arquivo.':'Envio de arquivos ainda não disponível neste escritório.'} ${local?'Arquivos guardados somente neste navegador.':'Arquivos privados, disponíveis a quem tem acesso ao caso.'}</p>
      ${visible.length?`<details class="writing-files-list" open><summary>Arquivos disponíveis (${visible.length})</summary>${visible.map(file=>`<div class="writing-file"><span><strong>${escape(file.name)}</strong><small>${escape(file.info||'')}${file.available?'':' · Envio ou disponibilidade pendente'}</small></span>${file.available?`<button type="button" class="button quiet" ${action}="${local?'view':'downloadFile'}" data-${local?'file':'id'}="${escape(file.id)}">${local?'Abrir / baixar':'Baixar arquivo'}</button>`:''}</div>`).join('')}</details>`:''}
    </section>`;
  }
  return {accept,message,supported,validate,render};
});
