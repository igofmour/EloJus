// Local QA only. Fictional identities, in-memory PostgreSQL and file bytes.
// Never deploy this server: choosing a test persona is intentionally unauthenticated.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {database}=require('./local-postgres.cjs');
const dist=path.resolve(__dirname,'../dist'),port=Number(process.argv[2]||8769),origin=`http://127.0.0.1:${port}`;
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid QA port');
const people={admin:{id:'11111111-1111-4111-8111-111111111111',name:'Administrador',email:'admin@example.invalid'},intern:{id:'22222222-2222-4222-8222-222222222222',name:'Sara',email:'sara@example.invalid'},other:{id:'33333333-3333-4333-8333-333333333333',name:'Outro estagiário QA',email:'other@example.invalid'}};
const office='44444444-4444-4444-8444-444444444444',objects=new Map();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
 const db=await database();
 for(const u of Object.values(people))await db.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),false)',[u.id,u.email]);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:people.admin.id})]);
 await db.query("insert into public.offices(id,name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state) values($1,'Escritório de demonstração',$2,$3,$4,'12345','SP')",[office,people.admin.id,people.admin.name,people.admin.email]);
 for(const k of ['intern','other']){const u=people[k];await db.query("insert into public.office_members(office_id,user_id,role,display_name,email,professional_type) values($1,$2,'collaborator',$3,$4,'intern')",[office,u.id,u.name,u.email]);}
 await db.query("select public.workspace_command('create_case',$1)",[{office_id:office,id:'55555555-5555-4555-8555-555555555555',title:'Caso de outro estagiário · não deve aparecer para você',client_name:'Cliente fictício',assignee_id:people.other.id}]);
 await require('./review-preview-seed.cjs')(db,people,office);
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin);
   // Only the public availability marker is readable from the main local app.
   // API requests remain same-origin and the server binds exclusively to loopback.
   if(url.pathname==='/__qa/status'&&req.method==='GET'){
    if(['http://127.0.0.1:8768','http://localhost:8768'].includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({demo:'elojus-local'}));
   }
   if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end();}
   if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);return res.end();}
   if(url.pathname==='/__qa/adapter.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(__dirname,'workflow-preview-adapter.js')));}
   if(url.pathname==='/__qa/api'){
    if(req.method!=='POST'){res.writeHead(405);return res.end();}
    let chunks=[],length=0;for await(const chunk of req){length+=chunk.length;if(length>30*1024*1024)throw Error('invalid_attachment');chunks.push(chunk);}
    const payload=JSON.parse(Buffer.concat(chunks)),u=people[payload.persona];if(!u)throw Error('invalid_persona');
    if(payload.op==='command'&&payload.action==='comment')await wait(900);
    if(payload.op==='command'&&payload.action==='save_case')await wait(350);
    const data=await db.transaction(async tx=>{
     await tx.exec('set local role authenticated');
     await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:u.id,email:u.email,role:'authenticated',is_anonymous:false})]);
     if(payload.op==='identity')return u;
     if(payload.op==='capabilities')return (await tx.query('select public.workspace_capabilities() as data')).rows[0].data;
     if(payload.op==='command'||payload.op==='fileCommand'){
      const fn=payload.op==='command'?'workspace_command':'attachment_command';
      return (await tx.query(`select public.${fn}($1,$2) as data`,[payload.action,payload.data])).rows[0].data;
     }
     if(payload.op==='upload'){
      const a=(await tx.query('select * from public.case_attachments where object_path=$1',[payload.path])).rows[0];
      if(!a)throw Error('access_denied');const bytes=Buffer.from(payload.base64,'base64');
      if(bytes.length>20971520||bytes.length!==a.byte_size)throw Error('invalid_attachment');
      await tx.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('case-documents',$1,$2,$3)",[payload.path,u.id,{size:bytes.length,mimetype:payload.mime}]);
      objects.set(payload.path,bytes);return {};
     }
     if(payload.op==='download'){
      const visible=(await tx.query("select name from storage.objects where bucket_id='case-documents' and name=$1",[payload.path])).rows;
      if(!visible.length)throw Error('access_denied');return {base64:objects.get(payload.path).toString('base64')};
     }
     const selects={
      offices:['select id,name,responsible_user_id from public.offices',[]],
      members:['select * from public.office_members where office_id=$1 order by joined_at',[payload.id]],
      cases:['select * from public.office_cases where office_id=$1 order by updated_at desc',[payload.id]],
      one:['select * from public.office_cases where id=$1',[payload.id]],
      comments:['select * from public.case_comments where case_id=$1 order by created_at',[payload.id]],
      versions:['select * from public.case_versions where case_id=$1 order by created_at desc',[payload.id]],
      version:['select * from public.case_versions where id=$1',[payload.id]],
      activity:['select * from public.office_activity where case_id=$1 order by created_at desc',[payload.id]],
      attachments:['select * from public.case_attachments where case_id=$1 order by created_at',[payload.id]],
      matters:['select id,name,office_id from public.office_matters where office_id=$1 order by name',[payload.id]],
      signals:['select * from public.review_signals($1)',[payload.id]],
      rounds:['select * from public.case_review_rounds where case_id=$1 order by round_number desc',[payload.id]],
      allRounds:['select r.* from public.case_review_rounds r join public.office_cases c on c.id=r.case_id where c.office_id=$1',[payload.id]],
      pilot:['select p.* from public.case_pilot_entries p join public.office_cases c on c.id=p.case_id where c.office_id=$1',[payload.id]],
      invitations:['select id,email,role,display_name,professional_type,oab_number,oab_state,created_at,expires_at,accepted_at,revoked_at from public.office_invitations where office_id=$1',[payload.id]]
     };
     const q=selects[payload.op];if(!q)throw Error('invalid_operation');const rows=(await tx.query(...q)).rows;
     if(['one','version'].includes(payload.op)){if(!rows.length)throw Object.assign(Error('access_denied'),{code:'42501'});return rows[0];}return rows;
    });
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify({data},(key,value)=>['due_date','review_due_date'].includes(key)&&value?String(value).slice(0,10):value));
   }
   let pathname=decodeURIComponent(url.pathname);
   if(pathname==='/'||pathname==='/index.html'){
    let html=fs.readFileSync(path.join(dist,'index.html'),'utf8').replace(/<script src="(?:vendor\/supabase|auth-config|auth|shared-api)\.js[^>]*><\/script>/g,'')
      .replace('<script src="case-files.js','<script src="/__qa/adapter.js" defer></script><script src="case-files.js')
      .replace('Escritório compartilhado</span>','PRÉVIA LOCAL · dados fictícios</span>')
      .replace('Conectando ao Supabase…','Abrindo banco local de testes…')
      .replace('<title>EloJus — escritório compartilhado</title>','<title>EloJus — prévia local de colaboração e revisão</title>');
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(html);
   }
   const target=path.resolve(dist,'.'+pathname);
   if(!target.startsWith(dist+path.sep)||/auth-config|auth\.js/.test(target)){res.writeHead(404);return res.end();}
   if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end();}
   res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.woff2':'font/woff2'})[path.extname(target)]||'application/octet-stream');
   res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(target));
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:error.message,code:error.code}}));}
 });
 server.listen(port,'127.0.0.1',()=>console.log('Local QA: '+origin+'/index.html?persona=intern#casos — no Supabase connection'));
}
start().catch(e=>{console.error(e.message);process.exitCode=1;});
