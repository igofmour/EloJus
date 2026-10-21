(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloCaseFiles=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const types={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
  const limit=20*1024*1024,totalLimit=100*1024*1024;
  const accept=Object.keys(types).map(x=>'.'+x).join(',');
  const size=n=>n<1024*1024?Math.ceil(n/1024)+' KB':(n/1024/1024).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';
  function validate(files,existing=[]){
    if(files.length+existing.length>10||files.reduce((n,f)=>n+f.size,0)+existing.reduce((n,f)=>n+f.byte_size,0)>totalLimit)throw Error('attachment_limit');
    for(const f of files){const ext=f.name.split('.').pop().toLowerCase();if(!types[ext]||f.size<1||f.size>limit||!f.name.trim()||f.name.length>180||/[/\\\x00-\x1f\x7f]/.test(f.name))throw Error('invalid_attachment');}
  }
  // Stable reservation ID makes retry safe after either response is lost.
  async function upload(entry,context,api){
    const data={...context,id:entry.id,name:entry.file.name,size:entry.file.size};
    const row=await api.command('prepare',data);
    if(row.uploaded_at)return row;
    try{return await api.command('complete',data);}catch(error){if(error.message!=='attachment_pending')throw error;}
    try{await api.upload(row.object_path,entry.file,row.mime_type);}
    catch(error){
      try{return await api.command('complete',data);}catch{throw error;}
    }
    return api.command('complete',data);
  }
  return {types,limit,totalLimit,accept,size,validate,upload};
});
