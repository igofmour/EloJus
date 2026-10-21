const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('dist/office-api.js', 'utf8');
const input = { name:' Escritório Exemplo ', responsibleName:' Pessoa Exemplo ', email:' contato@example.invalid ', phone:' ', oabNumber:' 123A ', oabState:'SP', responsible_user_id:'forged', role:'admin' };
function setup({userId='verified-owner', userError=null, reads=[null], insertError=null, inserted=null}={}) {
  const calls=[];
  const A={user:async()=>{if(userError)throw userError;return {id:userId};},client:()=>({from:table=>{
    const q={ select:()=>q, eq:(column,value)=>{calls.push({type:'filter',column,value});return q;},maybeSingle:async()=>({data:reads.shift()??null,error:null}),insert:payload=>{calls.push({type:'insert',table,payload});return q;},update:payload=>{calls.push({type:'update',table,payload});return q;},single:async()=>({data:inserted,error:insertError})};return q;
  }})};
  const window={EloAuth:A}; vm.runInNewContext(source,{window}); return {O:window.EloOffice,calls};
}
test('verified identity is used, unsolicited ownership and role fields are discarded', async()=>{
  const saved={id:'office-1',responsible_user_id:'verified-owner',name:'Escritório Exemplo'};
  const {O,calls}=setup({inserted:saved});
  const result=await O.create(input,'verified-owner');
  const payload=calls.find(c=>c.type==='insert').payload;
  assert.equal(payload.responsible_user_id,'verified-owner'); assert.equal(payload.role,undefined);
  assert.equal(payload.phone,null); assert.equal(payload.responsible_email,'contato@example.invalid');
  assert.equal(result.office,saved); assert.equal(result.alreadyExists,false);
});
test('missing authentication and account changes never submit an office',async()=>{
  for(const options of [{userError:{code:'session_missing'}},{userId:'other-user'}]){
    const {O,calls}=setup(options); await assert.rejects(O.create(input,'verified-owner'));
    assert.equal(calls.some(c=>c.type==='insert'),false);
  }
});
test('existing registrations are returned without overwriting or duplicating',async()=>{
  const saved={id:'existing',name:'Original'}; const {O,calls}=setup({reads:[saved]});
  const result=await O.create(input,'verified-owner'); assert.equal(result.office,saved); assert.equal(result.alreadyExists,true);
  assert.equal(calls.some(c=>c.type==='insert'),false);
});
test('a competing creation recovers the server row after unique violation',async()=>{
  const saved={id:'concurrent'}; const {O}=setup({reads:[null,saved],insertError:{code:'23505'}});
  const result=await O.create(input,'verified-owner'); assert.equal(result.office,saved); assert.equal(result.alreadyExists,true);
});
test('server rejection and lost responses are never reported as success',async()=>{
  for(const insertError of [{code:'42501'},{code:'23514'},{message:'Failed to fetch'},null]){
    const {O}=setup({insertError}); await assert.rejects(O.create(input,'verified-owner'));
  }
});
test('reload uses a fresh verified account and only selects its registration',async()=>{
  const saved={id:'saved'}; const {O,calls}=setup({userId:'owner-2',reads:[saved]});
  assert.equal((await O.load()).office,saved);
  assert.equal(calls[0].column,'responsible_user_id'); assert.equal(calls[0].value,'owner-2');
});
test('raw provider diagnostics are not displayed to users',()=>{
  const {O}=setup(); assert.equal(O.message({message:'secret internal diagnostic'}).includes('secret'),false);
  assert.equal(O.planMessage({message:'secret internal diagnostic'}).includes('secret'),false);
});
const planRow={id:'office-1',responsible_user_id:'verified-owner',plan_code:'equipe',plan_selected_at:'2026-10-19T12:00:00Z'};
test('plan save sends only choice and filters office plus verified owner',async()=>{
  const {O,calls}=setup({inserted:planRow});
  assert.equal(await O.savePlan('equipe','office-1','verified-owner'),planRow);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(c=>c.type==='update').payload)),{plan_code:'equipe'});
  assert.ok(calls.some(c=>c.type==='filter'&&c.column==='id'&&c.value==='office-1'));
  assert.ok(calls.some(c=>c.type==='filter'&&c.column==='responsible_user_id'&&c.value==='verified-owner'));
});
test('invalid choices, no office, session loss and account switch do not write',async()=>{
  for(const [options,code,officeId,expected] of [
    [{},'premium','office-1','verified-owner'],[{}, {plan_code:'equipe'},'office-1','verified-owner'],
    [{},'equipe',null,'verified-owner'],[{},'equipe','office-1',null],
    [{userError:{code:'session_missing'}},'equipe','office-1','verified-owner'],
    [{userId:'other'},'equipe','office-1','verified-owner']
  ]){
    const {O,calls}=setup(options);await assert.rejects(O.savePlan(code,officeId,expected));
    assert.equal(calls.some(c=>c.type==='update'),false);
  }
});
test('plan save requires the returned matching office, plan and timestamp',async()=>{
  for(const inserted of [null,{...planRow,id:'other-office'},{...planRow,responsible_user_id:'other-user'}, {...planRow,plan_code:'other-plan'}, {...planRow,plan_selected_at:null}]){
    const {O}=setup({inserted});await assert.rejects(O.savePlan('equipe','office-1','verified-owner'),{code:'save_unconfirmed'});
  }
  for(const insertError of [{code:'42501'},{code:'PGRST116'},{message:'Failed to fetch'}]){
    const {O}=setup({insertError});await assert.rejects(O.savePlan('equipe','office-1','verified-owner'));
  }
});
test('reload returns the plan persisted with the office',async()=>{
  const {O}=setup({reads:[planRow]});assert.equal((await O.load()).office.plan_code,'equipe');
});

test('retired preferences remain readable but cannot be newly selected',async()=>{
  for(const code of ['essencial','personalizado']){
    const {O,calls}=setup({reads:[{...planRow,plan_code:code}]});
    assert.equal((await O.load()).office.plan_code,code);
    await assert.rejects(O.savePlan(code,'office-1','verified-owner'),{code:'invalid_plan'});
    assert.equal(calls.some(c=>c.type==='update'),false);
  }
});
