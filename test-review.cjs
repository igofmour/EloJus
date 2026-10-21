const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./dist/review-model.js');
test('review order prioritizes overdue then priority, deadline and oldest waiting; does not mutate input',()=>{
 const items=[{id:'c',status:'approved',due_date:'2020-01-01'},{id:'b',status:'review',priority:'high',review_due_date:'2026-10-25'},{id:'a',status:'review',review_due_date:'2026-10-19'},{id:'d',status:'review',due_date:'2026-10-26'}];
 assert.deepEqual(M.order(items,Date.parse('2026-10-20T12:00:00')).map(x=>x.id),['a','b','d','c']);assert.equal(items[0].id,'c');
});
test('review filters distinguish assigned review, unresolved questions, returned work and read updates',()=>{
 const items=[{id:'a',title:'Manifestação',status:'review',reviewer_id:'lawyer'},{id:'b',status:'working',reviewer_id:'other'},{id:'c',status:'changes',reviewer_id:'lawyer'}];
 const ctx={userId:'lawyer',signals:[{case_id:'a',questions:1,unread:true},{case_id:'b',questions:2}]};
 assert.deepEqual(M.select(items,{...ctx,filter:'mine'}).map(x=>x.id),['a']);
 assert.deepEqual(M.select(items,{...ctx,filter:'questions'}).map(x=>x.id),['a']);
 assert.deepEqual(M.select(items,{...ctx,filter:'changes'}).map(x=>x.id),['c']);
 assert.deepEqual(M.select(items,{...ctx,filter:'updates'}).map(x=>x.id),['a']);
 assert.equal(M.select(items,{...ctx,search:'manifestacao'}).length,1);
});
test('threading preserves reply order without mixing other subjects',()=>{
 const result=M.threads([{id:'a'},{id:'b'},{id:'r2',parent_id:'a',created_at:'2026-02-02'},{id:'r1',parent_id:'a',created_at:'2026-02-01'}]);
 assert.deepEqual(result[0].replies.map(x=>x.id),['r1','r2']);assert.equal(result[1].replies.length,0);
});
test('text diff reconstructs both versions and escapes HTML',()=>{
 for(const [a,b] of [['Um pedido antigo.','Um pedido revisado.'],['','Novo'],['Texto',''],['a b a','b a b'],['<script>','<img src=x>']]){
  const d=M.diffHtml(a,b);
  assert.equal(d.parts.filter(x=>x.kind!=='added').map(x=>x.value).join(''),a);
  assert.equal(d.parts.filter(x=>x.kind!=='removed').map(x=>x.value).join(''),b);
  assert.ok(!d.html.includes('<script>'));assert.ok(!d.html.includes('<img '));
 }
});
test('long comparisons stay bounded and retain all content',()=>{
 const a=Array.from({length:1000},(_,i)=>'a'+i).join(' '),b=Array.from({length:1000},(_,i)=>'b'+i).join(' ');
 const d=M.diff(a,b);assert.ok(d.simplified);assert.equal(d.parts.find(x=>x.kind==='removed').value,a);assert.equal(d.parts.find(x=>x.kind==='added').value,b);
});
test('metrics distinguish missing response from zero and do not invent active work time',()=>{
 assert.equal(M.metrics([]).medianResponseMinutes,null);
 const m=M.metrics([{submitted_at:'2026-01-01T10:00:00Z',first_response_at:'2026-01-01T10:10:00Z',outcome:'approved'},{submitted_at:'2026-01-01T10:00:00Z'}]);
 assert.equal(m.deliveries,2);assert.equal(m.responded,1);assert.equal(m.medianResponseMinutes,10);assert.equal(m.approved,1);assert.ok(!('activeMinutes' in m));
});
test('live case API retrieves rows beyond 200 using stable ordering, including older review cases',async()=>{
 const rows=Array.from({length:405},(_,i)=>({id:String(i),status:i===404?'review':'approved'})),requests=[];
 const api={from:()=>({select(){return this},eq(){return this},order(name){assert.equal(name,'number');return this},range:async(start,end)=>{requests.push([start,end]);return {data:rows.slice(start,end+1),error:null}}})};
 const context={window:{EloAuth:{client:()=>api}}};vm.runInNewContext(fs.readFileSync('dist/shared-api.js','utf8'),context);
 const result=await context.window.EloShared.cases('office');assert.equal(result.length,405);assert.equal(result[404].status,'review');assert.equal(requests.length,3);
});
test('conversation, signals and versions are paginated without dropping earlier review evidence',async()=>{
 const rows=Array.from({length:405},(_,i)=>({id:String(i)})),calls=[];
 const builder=()=>({select(){return this},eq(){return this},order(){return this},range:async(a,b)=>{calls.push([a,b]);return {data:rows.slice(a,b+1),error:null}}});
 const ctx={window:{EloAuth:{client:()=>({from:builder,rpc:builder})}}};vm.runInNewContext(fs.readFileSync('dist/shared-api.js','utf8'),ctx);
 for(const method of ['comments','signals','versions'])assert.equal((await ctx.window.EloShared[method]('case')).length,405);
 assert.equal(calls.length,9);
});
