// Local QA only: real Supabase query client + PostgreSQL, fictional authentication.
// Never deploy. This service intentionally accepts named fixture identities.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { database } = require('./local-postgres.cjs');
const people = {
  owner: {id:'11111111-1111-4111-8111-111111111111', email:'owner@example.invalid'},
  other: {id:'22222222-2222-4222-8222-222222222222', email:'other@example.invalid'},
  collaborator: {id:'33333333-3333-4333-8333-333333333333', email:'collaborator@example.invalid'}
};
const officeId = '44444444-4444-4444-8444-444444444444';
async function start(port = 0) {
  const db = await database();
  for (const u of Object.values(people)) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u.id,u.email]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:people.owner.id})]);
  await db.query("insert into public.offices(id,name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state) values($1,'Escritório de exemplo',$2,'Responsável de exemplo',$3,'12345','PB')",[officeId,people.owner.id,people.owner.email]);
  await db.query("insert into public.office_members(office_id,user_id,role,display_name,email,professional_type) values($1,$2,'collaborator','Pessoa colaboradora',$3,'intern')",[officeId,people.collaborator.id,people.collaborator.email]);
  const dist = path.resolve(__dirname,'../dist');
  const mutations = [];
  const server = http.createServer(async (req,res) => {
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403); return res.end(); }
      const url = new URL(req.url, origin);
      res.setHeader('Cache-Control','no-store');
      if (url.pathname === '/auth-config.js') {res.setHeader('Content-Type','text/javascript');return res.end('/* Local QA: no remote configuration. */');}
      if (url.pathname === '/auth.js') {
        res.setHeader('Content-Type','text/javascript');
        return res.end(`(() => {
          const people=${JSON.stringify(people)};
          const key=localStorage.getItem('plan-qa-persona')||'owner';
          const user=people[key];
          const client=supabase.createClient(location.origin,'local-qa-public',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-qa-persona':key}}});
          window.EloAuth={user:async()=>{if(!user||window.qaSignedOut)throw Object.assign(new Error('session_missing'),{code:'session_missing'});return user;},client:()=>client};
        })();`);
      }
      if (url.pathname === '/rest/v1/offices') {
        const user = people[req.headers['x-qa-persona']];
        if (!user) {res.writeHead(401);return res.end('{}');}
        if (!['GET','PATCH'].includes(req.method)) {res.writeHead(405);return res.end('{}');}
        const filters=[], args=[];
        for (const col of ['id','responsible_user_id']) {
          const value=url.searchParams.get(col);
          if(value){if(!value.startsWith('eq.'))throw Error('invalid_filter');args.push(value.slice(3));filters.push(`${col}=$${args.length}`);}
        }
        let payload;
        if(req.method==='PATCH'){
          let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw Error('payload_too_large');}
          payload=JSON.parse(body);
          if(Object.keys(payload).join(',')!=='plan_code')throw Error('invalid_payload');
        }
        const rows=await db.transaction(async tx=>{
          await tx.exec('set local role authenticated');
          await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user.id,role:'authenticated',is_anonymous:false})]);
          const where=filters.length?' where '+filters.join(' and '):'';
          if(req.method==='PATCH'){
            mutations.push({persona:req.headers['x-qa-persona'],payload,filters:args});
            return (await tx.query(`update public.offices set plan_code=$${args.length+1}${where} returning *`,[...args,payload.plan_code])).rows;
          }
          return (await tx.query('select * from public.offices'+where,args)).rows;
        });
        res.setHeader('Content-Type','application/json');
        if(req.headers.accept?.includes('application/vnd.pgrst.object')){
          if(rows.length!==1){res.writeHead(406);return res.end(JSON.stringify({code:'PGRST116',message:'Expected one row'}));}
          return res.end(JSON.stringify(rows[0]));
        }
        return res.end(JSON.stringify(rows));
      }
      const target=path.resolve(dist,'.'+decodeURIComponent(url.pathname));
      if(!target.startsWith(dist+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end();}
      res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(target)]||'application/octet-stream');
      res.end(fs.readFileSync(target));
    } catch(error) {res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({code:error.code||'qa_error',message:'Local QA request failed'}));}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {db,server,mutations,people,officeId,url:`http://127.0.0.1:${server.address().port}`,
    close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
module.exports={start};
if(require.main===module)start(Number(process.argv[2]||8774)).then(s=>console.log('Local plan QA: '+s.url+'/planos.html')).catch(e=>{console.error(e.message);process.exitCode=1;});
