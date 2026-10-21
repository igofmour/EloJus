(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloDelivery=factory();})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const eligible=a=>!!a.uploaded_at&&/\.(docx|pdf|txt)$/i.test(a.display_name);
 function source(ctx){
  if(!ctx.deliveryEnabled)return '';
  const c=ctx.selected,a=ctx.attachments.find(f=>f.id===c.primary_attachment_id),file=c.delivery_source==='file';
  const editable=['working','changes'].includes(c.status)&&(ctx.role==='admin'||ctx.role==='reviewer'||c.assignee_id===ctx.user.id);
  return `<section class="delivery-source" aria-label="Peça principal"><div><span class="eyebrow">CONTEÚDO PARA REVISÃO</span><h2>${file?'Peça em arquivo':'Peça no editor'}</h2><p>${file?e(a?.display_name||'Arquivo principal'):'O texto abaixo será preservado ao enviar para revisão.'}</p>${file?'<small>Este é o arquivo que será entregue ou já foi entregue nesta rodada. O texto do editor permanece guardado separadamente.</small>':''}</div><div class="delivery-actions">${file&&a?`<button type="button" class="button primary" data-action="downloadFile" data-id="${e(a.id)}">Baixar peça principal</button>`:''}${editable?'<button type="button" class="button secondary" data-action="chooseSource">Escolher conteúdo da peça</button>':''}</div></section>`;
 }
 function form(ctx){
  const c=ctx.selected,files=ctx.attachments.filter(eligible);
  return `<form id="sourceForm" class="shared-form"><p>Escolha o conteúdo que o advogado deverá revisar. Cada envio preserva a versão selecionada.</p><label>Conteúdo da entrega<select name="source"><option value="editor" ${c.delivery_source!=='file'?'selected':''}>Texto do editor</option>${files.map(a=>`<option value="${e(a.id)}" ${a.id===c.primary_attachment_id?'selected':''}>Arquivo: ${e(a.display_name)} · ${e(new Date(a.created_at).toLocaleString('pt-BR'))}</option>`).join('')}</select></label>${files.length?'':'<p class="shared-callout">Para entregar por arquivo, primeiro anexe um Word (.docx), PDF ou TXT.</p>'}<p class="form-help">Trocar a opção não apaga o texto nem os documentos. Durante a revisão, peça uma devolutiva antes de trocar a peça principal.</p><div class="form-error" role="alert" tabindex="-1" hidden></div><div class="form-actions"><button type="button" class="button secondary" data-action="close">Cancelar</button><button class="button primary" type="submit">Usar este conteúdo</button></div></form>`;
 }
 function fileVersion(version,attachments){const a=attachments.find(x=>x.id===version.attachment_id);return `<div class="delivery-file-version"><strong>${e(a?.display_name||'Arquivo da versão')}</strong><p>Original preservado desta entrega. A comparação automática de texto se aplica às minutas elaboradas no editor.</p>${a?`<button type="button" class="button primary" data-action="downloadFile" data-id="${e(a.id)}">Baixar arquivo desta versão</button>`:'<p>Atualize o caso para carregar o documento.</p>'}</div>`;}
 function label(round,attachments){if(round.delivery_source!=='file')return 'Texto do editor';return attachments.find(a=>a.id===round.attachment_id)?.display_name||'Peça em arquivo';}
 return {source,form,fileVersion,label,eligible};
});
