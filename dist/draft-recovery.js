(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloDrafts=factory();})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const prefix='elojus-unsaved-v1:',ttl=7*24*60*60*1000;
 function create(storage,userId,tabId,now=()=>Date.now()){
  const userPrefix=prefix+userId+':';
  const key=(office,caseId)=>userPrefix+office+':'+caseId+':'+tabId;
  function records(){const rows=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(!k?.startsWith(userPrefix))continue;try{const r=JSON.parse(storage.getItem(k));if(r?.userId===userId&&r.document?.ops&&Number.isFinite(r.at))rows.push({...r,key:k});}catch{}}return rows;}
  function prune(){for(const r of records())if(now()-r.at>ttl)storage.removeItem(r.key);}
  function put(row,document){storage.setItem(key(row.office_id,row.id),JSON.stringify({userId,officeId:row.office_id,caseId:row.id,baseRevision:row.revision,document,at:now()}));}
  function list(row){prune();return records().filter(r=>r.officeId===row.office_id&&r.caseId===row.id).sort((a,b)=>b.at-a.at);}
  function remove(record){if(record?.key?.startsWith(userPrefix))storage.removeItem(record.key);}
  function saved(row){storage.removeItem(key(row.office_id,row.id));}
  function clearCase(row){for(const r of records())if(r.caseId===row.id&&r.officeId===row.office_id)remove(r);}
  function clearOffice(officeId){for(const r of records())if(r.officeId===officeId)remove(r);}
  function clear(){for(const r of records())remove(r);}
  return {put,list,remove,saved,clearCase,clearOffice,clear};
 }
 return {create,ttl};
});
