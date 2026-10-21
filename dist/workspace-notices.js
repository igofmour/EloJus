(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloNotices=factory();})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function create(storage,userId,now=()=>Date.now()){
  const key='elojus-alerts-v1:'+userId;
  function read(){try{return JSON.parse(storage.getItem(key))||{};}catch{return {};}}
  function configure(enabled,minutes=5){const old=read();storage.setItem(key,JSON.stringify({...old,enabled:!!enabled,minutes:[5,15,30].includes(Number(minutes))?Number(minutes):5}));}
  function pending(cases,signals){const unread=new Set(signals.filter(s=>s.unread).map(s=>s.case_id));return cases.filter(c=>unread.has(c.id));}
  function claim(officeId,cases,signals){
   const state=read();if(!state.enabled)return 0;
   const previous=state.offices?.[officeId]||{},rows=pending(cases,signals);
   const fresh=rows.filter(c=>previous.seen?.[c.id]!==c.review_activity_at);
   if(!fresh.length||now()-(previous.at||0)<(state.minutes||5)*60000)return 0;
   // No client names or document contents are persisted in notification preferences.
   const seen=Object.fromEntries(rows.map(c=>[c.id,c.review_activity_at]));
   storage.setItem(key,JSON.stringify({...state,offices:{...state.offices,[officeId]:{at:now(),seen}}}));return fresh.length;
  }
  return {read,configure,pending,claim};
 }
 return {create};
});
