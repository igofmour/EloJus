// Exercises the incremental offer migration and existing RLS in disposable PostgreSQL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {database} = require('./local-postgres.cjs');
async function run() {
  const db = await database({billing:false});
  const owner='11111111-1111-4111-8111-111111111111';
  const other='22222222-2222-4222-8222-222222222222';
  const member='33333333-3333-4333-8333-333333333333';
  const office='44444444-4444-4444-8444-444444444444';
  const asUser = (id, job, anonymous=false) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,is_anonymous:anonymous})]);
    return job(tx);
  });
  const update=(tx,code)=>tx.query('update public.offices set plan_code=$1 where id=$2 returning plan_code,plan_selected_at',[code,office]);
  try {
    for(const id of [owner,other,member]) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.invalid']);
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner})]);
    await db.query("insert into public.offices(id,name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state) values($1,'Escritório de teste',$2,'Responsável','owner@example.invalid','12345','PB')",[office,owner]);
    await db.query("insert into public.office_members(office_id,user_id,role,display_name,email,professional_type) values($1,$2,'collaborator','Colaborador','member@example.invalid','intern')",[office,member]);
    await asUser(owner,tx=>update(tx,'equipe'));
    const before=(await db.query('select * from public.offices order by id')).rows;
    const sql=fs.readFileSync(path.join(__dirname,'../database/office-plan-selection.sql'),'utf8').split('-- v0.27:')[1];
    await db.exec('-- v0.27:'+sql);
    assert.deepEqual((await db.query('select * from public.offices order by id')).rows,before);
    for(const code of ['equipe_mensal','equipe_anual','equipe_mensal']) {
      const saved=(await asUser(owner,tx=>update(tx,code))).rows[0];
      assert.equal(saved.plan_code,code);assert.ok(saved.plan_selected_at);
      const retry=(await asUser(owner,tx=>update(tx,code))).rows[0];
      assert.deepEqual(retry,saved);
    }
    for(const code of ['invalid','Equipe anual','',null]) await assert.rejects(asUser(owner,tx=>update(tx,code)));
    for(const id of [other,member]) assert.deepEqual((await asUser(id,tx=>update(tx,'equipe_anual'))).rows,[]);
    assert.deepEqual((await asUser(owner,tx=>update(tx,'equipe_anual'),true)).rows,[]);
    await assert.rejects(asUser(owner,tx=>tx.query("update public.offices set plan_selected_at=now() where id=$1",[office])));
    await assert.rejects(asUser(owner,tx=>tx.query('update public.offices set responsible_user_id=$1 where id=$2',[other,office])));
    for(const code of ['essencial','equipe','personalizado']) {
      // Database compatibility is retained; the current application refuses new legacy choices.
      await asUser(owner,tx=>update(tx,code));
      assert.equal((await db.query('select plan_code from public.offices where id=$1',[office])).rows[0].plan_code,code);
    }
    console.log('Billing database checks passed: non-destructive migration, both periods, retries, legacy compatibility, invalid input, owner isolation, anonymous access, protected timestamp and ownership.');
    const result=await db.exec(fs.readFileSync(path.join(__dirname,'plan-billing-remote.sql'),'utf8'));
    const summary=result.flatMap(item=>item.rows||[]).find(row=>row.result)?.result;
    assert.equal(summary?.passed,8);
    console.log('Billing remote verification script: 8 checks passed locally.');
  } finally {await db.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
