(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloReview=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const dateValue=value=>value?Date.parse(value.length===10?value+'T23:59:59':value):Infinity;
  const deadline=c=>c.status==='review'?(c.review_due_date||c.due_date):c.due_date;
  const open=c=>c.status!=='approved';
  const overdue=(c,now=Date.now())=>open(c)&&dateValue(deadline(c))<now;
  function order(items,now=Date.now()){
    return [...items].sort((a,b)=>
      Number(open(b))-Number(open(a)) ||
      Number(overdue(b,now))-Number(overdue(a,now)) ||
      Number(b.priority==='high')-Number(a.priority==='high') ||
      (dateValue(deadline(a))-dateValue(deadline(b))||0) ||
      (dateValue(a.review_requested_at||a.created_at)-dateValue(b.review_requested_at||b.created_at)||0) ||
      String(a.id).localeCompare(String(b.id)));
  }
  function waitingSince(value,now=Date.now()){
    if(!value)return 'Sem envio registrado';
    const minutes=Math.max(0,Math.floor((now-Date.parse(value))/60000));
    return minutes<60?`${minutes} min de espera`:minutes<1440?`${Math.floor(minutes/60)} h de espera`:`${Math.floor(minutes/1440)} dia(s) de espera`;
  }
  function select(items,{filter='all',userId,search='',members=[],matters=[],signals=[],now=Date.now()}={}){
    const people=new Map(members.map(m=>[m.user_id,m.display_name])),groups=new Map(matters.map(m=>[m.id,m.name]));
    const byCase=new Map(signals.map(s=>[s.case_id,s]));
    return order(items.filter(c=>{
      const s=byCase.get(c.id)||{},mine=!c.reviewer_id||c.reviewer_id===userId;
      const pass=filter==='all'||filter==='review'&&c.status==='review'||
        filter==='mine'&&c.status==='review'&&mine||
        filter==='questions'&&open(c)&&Number(s.questions)>0&&mine||
        filter==='changes'&&c.status==='changes'||
        filter==='working'&&c.status==='working'||
        filter==='waiting'&&(c.status==='review'||open(c)&&Number(s.blocked_questions)>0)||
        filter==='overdue'&&overdue(c,now)||
        filter==='updates'&&s.unread===true||
        filter==='approved'&&c.status==='approved';
      return pass&&normalize([c.title,c.client_name,c.number,people.get(c.assignee_id),people.get(c.reviewer_id),groups.get(c.matter_id)].join(' ')).includes(normalize(search));
    }),now);
  }
  function threads(comments){
    const roots=comments.filter(c=>!c.parent_id),byParent=new Map();
    for(const c of comments.filter(c=>c.parent_id)){if(!byParent.has(c.parent_id))byParent.set(c.parent_id,[]);byParent.get(c.parent_id).push(c);}
    return roots.map(c=>({...c,replies:(byParent.get(c.id)||[]).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))}));
  }
  const text=document=>(document?.ops||[]).map(op=>typeof op.insert==='string'?op.insert:'').join('');
  function diff(before,after){
    const a=String(before).split(/(\s+)/),b=String(after).split(/(\s+)/);
    let start=0,endA=a.length,endB=b.length;
    while(start<endA&&start<endB&&a[start]===b[start])start++;
    while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
    const x=a.slice(start,endA),y=b.slice(start,endB),parts=[];
    const add=(kind,value)=>{if(!value)return;if(parts.at(-1)?.kind===kind)parts.at(-1).value+=value;else parts.push({kind,value});};
    add('same',a.slice(0,start).join(''));
    const simplified=x.length*y.length>250000;
    if(simplified){add('removed',x.join(''));add('added',y.join(''));}
    else{
      const rows=Array.from({length:x.length+1},()=>new Uint32Array(y.length+1));
      for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)rows[i][j]=x[i]===y[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
      let i=0,j=0;
      while(i<x.length||j<y.length){
        if(i<x.length&&j<y.length&&x[i]===y[j]){add('same',x[i++]);j++;}
        else if(i<x.length&&(j===y.length||rows[i+1][j]>=rows[i][j+1]))add('removed',x[i++]);
        else add('added',y[j++]);
      }
    }
    add('same',a.slice(endA).join(''));
    return {parts,simplified,changed:before!==after};
  }
  function diffHtml(before,after){
    const result=diff(before,after);
    return { ...result,html:result.parts.map(p=>p.kind==='same'?escape(p.value):`<${p.kind==='added'?'ins':'del'}>${escape(p.value)}</${p.kind==='added'?'ins':'del'}>`).join('') };
  }
  function median(values){
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    return sorted.length?sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:null;
  }
  function metrics(rounds,now=Date.now()){
    const responded=rounds.filter(r=>r.first_response_at);
    const completed=rounds.filter(r=>r.completed_at),pending=rounds.filter(r=>!r.completed_at),cycles=[];
    for(const id of new Set(rounds.map(r=>r.case_id).filter(Boolean))){
      const items=rounds.filter(r=>r.case_id===id),first=Math.min(...items.map(r=>Date.parse(r.submitted_at))),last=items.filter(r=>r.outcome==='approved'&&r.completed_at).sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at))[0];
      if(last)cycles.push(Math.max(0,(Date.parse(last.completed_at)-first)/60000));
    }
    return {deliveries:rounds.length,responded:responded.length,
      completed:completed.length,pending:pending.length,approvedCases:cycles.length,
      medianDecisionMinutes:median(completed.map(r=>Math.max(0,(Date.parse(r.completed_at)-Date.parse(r.submitted_at))/60000))),
      medianCycleMinutes:median(cycles),oldestPendingMinutes:pending.length?Math.max(...pending.map(r=>Math.max(0,(now-Date.parse(r.submitted_at))/60000))):null,
      medianResponseMinutes:median(responded.map(r=>Math.max(0,(Date.parse(r.first_response_at)-Date.parse(r.submitted_at))/60000))),
      approved:rounds.filter(r=>r.outcome==='approved').length,
      returned:rounds.filter(r=>r.outcome==='changes').length};
  }
  return {escape,normalize,deadline,overdue,order,waitingSince,select,threads,text,diff,diffHtml,metrics};
});
