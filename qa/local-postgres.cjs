// PostgreSQL/WASM with the Auth and Storage contracts used by these migrations.
// Never connects to Supabase. Storage HTTP behavior still needs staging validation.
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
async function database({review=true,delivery=true,billing=true}={}){
  const db=new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid;$$;
    grant usage on schema auth,storage to authenticated,anon,service_role;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  for(const file of ['office-registration','office-plan-selection','shared-office','team-registration','case-workflow','case-attachments']){
    const sql=fs.readFileSync(path.join(root,'database',file+'.sql'),'utf8');
    await db.exec(file==='office-plan-selection'&&!billing?sql.split('-- v0.27:')[0]:sql);
  }
  if(review)await db.exec(fs.readFileSync(path.join(root,'database/review-workflow.sql'),'utf8'));
  if(review&&delivery){await db.exec(fs.readFileSync(path.join(root,'database/file-review.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(root,'database/file-review-indexes.sql'),'utf8'));}
  return db;
}
module.exports={database};
if(require.main===module)(async()=>{
 const db=await database({review:false});
 try{
   for(const file of ['shared-office-policies','team-registration-policies','case-workflow-policies']){
     const results=await db.exec(fs.readFileSync(path.join(root,'qa',file+'.sql'),'utf8'));
     const rows=results.flatMap(r=>r.rows||[]),summary=rows.find(r=>r.tests!==undefined)||rows.find(r=>r.result)?.result;
     if(!summary||!(summary.passed===true||summary.passed>0))throw Error('No passing test summary: '+file);
     console.log(file+': '+(summary.tests||summary.passed)+' checks passed.');
   }
   await db.exec(fs.readFileSync(path.join(root,'database/review-workflow.sql'),'utf8'));
   const results=await db.exec(fs.readFileSync(path.join(root,'qa/review-workflow-remote.sql'),'utf8'));
   const summary=results.flatMap(r=>r.rows||[]).find(r=>r.result)?.result;
   if(!summary?.passed)throw Error('No passing test summary: review-workflow-remote');
   console.log('review-workflow-remote: '+summary.passed+' checks passed locally.');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message,e.detail||'');process.exitCode=1;});
