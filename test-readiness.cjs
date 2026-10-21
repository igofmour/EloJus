const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./dist/draft-recovery.js'),N=require('./dist/workspace-notices.js'),M=require('./dist/review-model.js');
function storage(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
const row={id:'case',office_id:'office',revision:3},doc={ops:[{insert:'Rascunho\n'}]};
test('recovery isolates users, offices and tabs, clearing only the saved tab',()=>{
 const s=storage(),a=D.create(s,'u','a'),b=D.create(s,'u','b'),other=D.create(s,'other','a');a.put(row,doc);b.put(row,doc);other.put(row,doc);
 assert.equal(a.list(row).length,2);assert.equal(other.list(row).length,1);assert.equal(a.list({...row,office_id:'other'}).length,0);a.saved(row);assert.equal(a.list(row).length,1);a.clear();assert.equal(a.list(row).length,0);assert.equal(other.list(row).length,1);
});
test('unsaved text survives write failure and expires after seven days',async()=>{
 const s=storage();let now=0;const d=D.create(s,'u','a',()=>now),Q=require('./dist/shared-save.js');
 const q=Q.create({...row,document:{ops:[{insert:'\n'}]}},async()=>{throw Error('offline')},async()=>{throw Error('offline')},state=>{if(state.dirty)d.put(state.row,state.draft);else if(!state.busy)d.saved(state.row)});
 q.edit(doc);assert.equal(await q.flush(),false);assert.deepEqual(d.list(row)[0].document,doc);now=D.ttl+1;assert.equal(d.list(row).length,0);
});
test('storage failure is surfaced',()=>{const d=D.create({setItem(){throw Error('quota')}},'u','a');assert.throws(()=>d.put(row,doc),/quota/);});
test('notifications are optional, grouped, deduplicated and scoped by account',()=>{
 let now=1000000;const s=storage(),a=N.create(s,'u',()=>now),b=N.create(s,'u',()=>now),other=N.create(s,'other',()=>now),rows=[{id:'c',review_activity_at:'one'}],signals=[{case_id:'c',unread:true}];
 assert.equal(a.claim('o',rows,signals),0);a.configure(true,5);assert.equal(a.claim('o',rows,signals),1);assert.equal(b.claim('o',rows,signals),0);assert.equal(other.claim('o',rows,signals),0);rows[0].review_activity_at='two';assert.equal(a.claim('o',rows,signals),0);now+=300001;assert.equal(a.claim('o',rows,signals),1);a.configure(false);assert.equal(a.claim('other',rows,signals),0);
});
test('metrics distinguish first reply, decision, whole cycle and pending cases',()=>{
 const time=min=>new Date(Date.UTC(2026,0,1,0,min)).toISOString();const m=M.metrics([{case_id:'a',submitted_at:time(0),first_response_at:time(10),completed_at:time(60),outcome:'changes'},{case_id:'a',submitted_at:time(90),first_response_at:time(100),completed_at:time(120),outcome:'approved'},{case_id:'b',submitted_at:time(100),first_response_at:time(110)}],Date.parse(time(180)));
 assert.equal(m.medianResponseMinutes,10);assert.equal(m.medianDecisionMinutes,45);assert.equal(m.medianCycleMinutes,120);assert.equal(m.approvedCases,1);assert.equal(m.pending,1);assert.equal(m.oldestPendingMinutes,80);
});
