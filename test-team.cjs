const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('./dist/team-management.js');
test('directory search is accent insensitive and combines category with name, email and OAB',()=>{
 const rows=[{display_name:'Lúcia Costa',email:'lucia@example.invalid',professional_type:'lawyer',oab_number:'12345',oab_state:'PR'},{display_name:'João Lima',email:'joao@example.invalid',professional_type:'intern'}];
 assert.equal(T.filter(rows,'lucia','lawyer').length,1);assert.equal(T.filter(rows,'lúcia','intern').length,0);assert.equal(T.filter(rows,'12345 PR').length,1);assert.equal(T.filter(rows,'JOAO@').length,1);assert.equal(T.filter(rows,'sem resultado').length,0);
});
test('invitation expiration, revocation and acceptance have distinct states',()=>{
 const i={expires_at:'2026-01-02T00:00:00Z'},now=Date.parse('2026-01-01T00:00:00Z');
 assert.equal(T.invitationStatus(i,now),'Aguardando aceite');assert.equal(T.invitationStatus(i,now+86400000),'Expirado');assert.equal(T.invitationStatus({...i,revoked_at:'x'},now),'Revogado');assert.equal(T.invitationStatus({...i,accepted_at:'x'},now),'Aceito');assert.equal(T.pending(i),true);assert.equal(T.pending({...i,accepted_at:'x'}),false);
});
test('untrusted identity fields render only as escaped text',()=>{
 const m={user_id:'2',display_name:'<img src=x onerror=alert(1)>',email:'" onfocus="alert(1)',professional_type:'intern',role:'collaborator',joined_at:'2026-01-01'};
 const html=T.render({office:{name:'<script>bad</script>',responsible_user_id:'1'},members:[m],invites:[],admin:true,userId:'1'});
 assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/&lt;img/);assert.match(T.form(m),/&quot; onfocus=&quot;/);
});
test('non administrators have no registration or management controls',()=>{
 const html=T.render({office:{name:'Office',responsible_user_id:'1'},members:[{user_id:'2',display_name:'Name',professional_type:'intern',role:'collaborator',joined_at:'2026-01-01'}],invites:[],admin:false,userId:'2'});
 assert.doesNotMatch(html,/data-action="(?:invite|editMember|removeMember|renewInvite|revokeInvite)"/);assert.doesNotMatch(html,/data-tab="invites"/);
});
test('intern form prohibits review option and requires no OAB or password',()=>{
 const html=T.form({professional_type:'intern',role:'collaborator'});
 assert.match(html,/value="reviewer"[^>]*disabled/);assert.match(html,/name="oab_number"[^>]*disabled/);assert.doesNotMatch(html,/type="password"/);assert.match(T.accessNote('intern','reviewer'),/Não aprovam/);
});
test('directory separates active, deactivated and waiting identities',()=>{
 const base={office:{responsible_user_id:'1'},userId:'1',admin:true,members:[{user_id:'2',display_name:'Ativo',joined_at:'2026-01-01'},{user_id:'3',display_name:'DesativadoPessoa',removed_at:'2026-01-02'}],invites:[{id:'a',display_name:'PendentePessoa',expires_at:'2099-01-01'},{id:'b',display_name:'AceitoPessoa',accepted_at:'2026-01-01'}]};
 assert.doesNotMatch(T.list(base),/DesativadoPessoa|PendentePessoa/);assert.match(T.list({...base,tab:'inactive'}),/DesativadoPessoa/);assert.match(T.list({...base,tab:'invites'}),/PendentePessoa/);assert.doesNotMatch(T.list({...base,tab:'invites'}),/AceitoPessoa/);
});
test('invitation adapter loads pending entries beyond the first page without requesting token hashes',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),requests=[];
 const client={from(table){const request={table};requests.push(request);return {select(columns){request.columns=columns;return this;},eq(column,value){request.office=value;return this;},order(){return this;},range(start,end){request.start=start;request.end=end;return Promise.resolve({data:Array.from({length:start===0?200:3},(_,i)=>({id:start+i})),error:null});}};}};
 const context={window:{EloAuth:{client:()=>client}}};vm.runInNewContext(fs.readFileSync('dist/shared-api.js','utf8'),context);
 const rows=await context.window.EloShared.invitations('office-test');assert.equal(rows.length,203);assert.deepEqual(requests.map(r=>[r.start,r.end]),[[0,199],[200,399]]);assert.ok(requests.every(r=>r.office==='office-test'&&!r.columns.includes('token_hash')));
});
