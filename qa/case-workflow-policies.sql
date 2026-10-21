-- Runs in local-postgres.cjs; all identities and objects are fictional.
begin;
create temp table qa_people(k text primary key,id uuid default gen_random_uuid(),email text) on commit drop;
insert into qa_people(k,email) values('admin','v23-admin@example.invalid'),('intern','v23-intern@example.invalid'),('other','v23-other@example.invalid'),('outside','v23-outside@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select id,email,now(),false from qa_people;
create temp table qa_data(k text primary key,data jsonb) on commit drop;
create temp table qa_results(test text,passed boolean) on commit drop;
grant select on qa_people to authenticated,anon;
grant all on qa_data,qa_results to authenticated,anon;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true) from qa_people where qa_people.k=as_user.k;
$$;
create or replace function pg_temp.check_result(label text,ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label;end if;insert into qa_results values(label,true);end;$$;
create or replace function pg_temp.cmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.workspace_command(action,jsonb_build_object('office_id',(select data->>'id' from qa_data where k='office'))||extra);
$$;
create function pg_temp.filecmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.attachment_command(action,jsonb_build_object('office_id',(select data->>'id' from qa_data where k='office'),'case_id',(select data->>'id' from qa_data where k='case'),'id',(select data->>'id' from qa_data where k='file'))||extra);
$$;
create or replace function pg_temp.denied(label text,action text,extra jsonb,expected text) returns void language plpgsql as $$
begin begin perform pg_temp.filecmd(action,extra);exception when others then
 if sqlerrm=expected or sqlstate=expected then perform pg_temp.check_result(label,true);return;else raise;end if;
end;raise exception 'FAILED allowed: %',label;end;$$;
select pg_temp.as_user('admin');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
 select 'Workflow QA',id,'QA Admin',email,'1234','SP' from qa_people where k='admin' returning *)
insert into qa_data select 'office',to_jsonb(o) from o;
insert into public.office_members(office_id,user_id,role,display_name,email,professional_type)
select (select (data->>'id')::uuid from qa_data where k='office'),id,'collaborator','QA Intern',email,'intern' from qa_people where k in ('intern','other');
set local role authenticated;
insert into qa_data select 'othercase',pg_temp.cmd('create_case',jsonb_build_object('id',gen_random_uuid(),'title','Caso outro','client_name','Cliente QA','assignee_id',(select id from qa_people where k='other')));
select pg_temp.as_user('intern');
insert into qa_data select 'case',pg_temp.cmd('create_case',jsonb_build_object('id',gen_random_uuid(),'title','Minha peça','client_name','Cliente QA','created_by',(select id from qa_people where k='admin')));
select pg_temp.check_result('intern creates self assigned draft with authenticated authorship',(select assignee_id=auth.uid() and created_by=auth.uid() and status='working' from public.office_cases));
select pg_temp.check_result('intern sees only own assigned piece',(select count(*)=1 from public.office_cases));
select pg_temp.check_result('create retry returns same id',pg_temp.cmd('create_case',(select data from qa_data where k='case'))->>'id'=(select data->>'id' from qa_data where k='case'));
do $$begin begin
 perform pg_temp.cmd('create_case',jsonb_build_object('id',gen_random_uuid(),'title','Unauthorized','client_name','QA','assignee_id',(select id from qa_people where k='other')));
 raise exception 'FAILED other assignee';exception when insufficient_privilege then perform pg_temp.check_result('intern cannot create for another member',true);end;end;$$;
insert into qa_data values('comment',jsonb_build_object('id',gen_random_uuid(),'body','Verificar referência','quote','trecho','blocking',true));
select pg_temp.cmd('comment',(select jsonb_build_object('case_id',data->>'id') from qa_data where k='case')||(select data from qa_data where k='comment'));
select pg_temp.cmd('comment',(select jsonb_build_object('case_id',data->>'id') from qa_data where k='case')||(select data from qa_data where k='comment'));
select pg_temp.check_result('comment retry is idempotent',(select count(*)=1 from public.case_comments));
select pg_temp.check_result('comment does not conflict with draft revision',(select revision=1 from public.office_cases));
select pg_temp.cmd('save_case',(select jsonb_build_object('case_id',data->>'id','revision',1,'document','{"ops":[{"insert":"Texto preservado\n"}]}'::jsonb) from qa_data where k='case'));
select pg_temp.check_result('typing save after comment succeeds',(select revision=2 from public.office_cases));
insert into qa_data values('file',jsonb_build_object('id',gen_random_uuid()));
select pg_temp.denied('file format validated in database','prepare','{"name":"attack.html","size":30}','invalid_attachment');
select pg_temp.denied('file size validated in database','prepare','{"name":"big.pdf","size":20971521}','invalid_attachment');
select pg_temp.denied('path traversal rejected','prepare','{"name":"../secret.pdf","size":30}','invalid_attachment');
update qa_data set data=pg_temp.filecmd('prepare','{"name":"Referência.pdf","size":30,"object_path":"forged/path"}') where k='file';
select pg_temp.check_result('storage path is derived from case and attachment ids',(select data->>'object_path'=(select data->>'id' from qa_data where k='office')||'/'||(select data->>'id' from qa_data where k='case')||'/'||(data->>'id')||'.pdf' from qa_data where k='file'));
select pg_temp.check_result('prepare retry does not duplicate',pg_temp.filecmd('prepare','{"name":"Referência.pdf","size":30}')->>'id'=(select data->>'id' from qa_data where k='file'));
select pg_temp.denied('reservation cannot switch file','prepare','{"name":"Other.pdf","size":30}','invalid_attachment');
select pg_temp.denied('completion requires actual object','complete','{}','attachment_pending');
select pg_temp.check_result('own pending upload permitted',(select private.attachment_access(data->>'object_path',true) from qa_data where k='file'));
-- Fake object only in the local PostgreSQL contract (no Storage HTTP request).
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'case-documents',data->>'object_path',auth.uid()::text,'{"size":30,"mimetype":"application/pdf"}' from qa_data where k='file';
select pg_temp.filecmd('complete');
select pg_temp.filecmd('complete');
select pg_temp.check_result('completion is durable and idempotent',(select count(*)=1 and bool_and(uploaded_at is not null) from public.case_attachments));
select pg_temp.check_result('completed upload cannot be replaced',not (select private.attachment_access(data->>'object_path',true) from qa_data where k='file'));
select pg_temp.check_result('authenticated storage download sees own object',(select count(*)=1 from storage.objects));
do $$declare n integer;begin
 update storage.objects set metadata='{"size":999}' where name=(select data->>'object_path' from qa_data where k='file');
 get diagnostics n=row_count;perform pg_temp.check_result('storage originals cannot be updated',n=0);
 delete from storage.objects where name=(select data->>'object_path' from qa_data where k='file');
 get diagnostics n=row_count;perform pg_temp.check_result('storage originals cannot be deleted',n=0);
 for i in 1..9 loop perform pg_temp.filecmd('prepare',jsonb_build_object('id',gen_random_uuid(),'name','pending-'||i||'.txt','size',1));end loop;
 perform pg_temp.denied('case enforces ten file quota','prepare',jsonb_build_object('id',gen_random_uuid(),'name','excess.txt','size',1),'attachment_limit');
 for n in 1..9 loop perform pg_temp.filecmd('cancel',jsonb_build_object('id',(select id from public.case_attachments where uploaded_at is null limit 1)));end loop;
 perform pg_temp.check_result('unuploaded reservations can be cancelled',(select count(*)=1 from public.case_attachments));
 for i in 1..4 loop perform pg_temp.filecmd('prepare',jsonb_build_object('id',gen_random_uuid(),'name','large-'||i||'.pdf','size',20971520));end loop;
 perform pg_temp.denied('case enforces total byte quota','prepare',jsonb_build_object('id',gen_random_uuid(),'name','excess.pdf','size',20971520),'attachment_limit');
 for n in 1..4 loop perform pg_temp.filecmd('cancel',jsonb_build_object('id',(select id from public.case_attachments where uploaded_at is null limit 1)));end loop;
 perform pg_temp.denied('completed file reservation cannot be cancelled','cancel','{}','attachment_exists');
end;$$;
do $$begin
 begin insert into storage.objects(bucket_id,name,owner_id) values('case-documents','forged/path',auth.uid()::text);raise exception 'FAILED storage bypass';exception when insufficient_privilege then perform pg_temp.check_result('storage insert requires reservation',true);end;
 begin update public.case_attachments set uploaded_at=now();raise exception 'FAILED direct write';exception when insufficient_privilege then perform pg_temp.check_result('metadata cannot be forged by direct write',true);end;
end;$$;
select pg_temp.as_user('other');
select pg_temp.check_result('other intern cannot list case metadata',(select count(*)=0 from public.case_attachments));
select pg_temp.check_result('other intern cannot download case objects',(select count(*)=0 from storage.objects));
select pg_temp.denied('other intern cannot reserve attachment','prepare','{"name":"other.pdf","size":30}','42501');
select pg_temp.as_user('outside');
select pg_temp.check_result('outsider sees no cases',(select count(*)=0 from public.office_cases));
select pg_temp.check_result('outsider sees no comments',(select count(*)=0 from public.case_comments));
select pg_temp.check_result('outsider sees no documents',(select count(*)=0 from storage.objects));
select pg_temp.denied('outsider cannot complete another upload','complete','{}','42501');
select pg_temp.as_user('admin');
select pg_temp.check_result('administrator sees both cases',(select count(*)=2 from public.office_cases));
select pg_temp.check_result('administrator can download assigned intern document',(select count(*)=1 from storage.objects));
select pg_temp.cmd('resolve_comment',(select jsonb_build_object('case_id',data->>'id') from qa_data where k='case')||(select data||'{"resolved":true}' from qa_data where k='comment'));
select pg_temp.check_result('resolving does not change document revision',(select revision=2 from public.office_cases where id=(select (data->>'id')::uuid from qa_data where k='case')));
select pg_temp.cmd('assign',(select data||jsonb_build_object('case_id',data->>'id','assignee_id',(select id from qa_people where k='other'),'revision',2) from qa_data where k='case'));
select pg_temp.as_user('intern');
select pg_temp.check_result('reassignment removes old assignee case access',(select count(*)=0 from public.office_cases));
select pg_temp.check_result('reassignment removes old assignee object access',(select count(*)=0 from storage.objects));
do $$begin begin perform pg_temp.cmd('create_case',(select data from qa_data where k='case'));raise exception 'FAILED retry leaked reassigned case';
exception when insufficient_privilege then perform pg_temp.check_result('creation retry does not leak reassigned case',true);end;end;$$;
select pg_temp.as_user('other');
select pg_temp.check_result('new assignee receives case documents',(select count(*)=1 from storage.objects));
reset role;
update public.office_members set removed_at=now() where user_id=(select id from qa_people where k='other');
set local role authenticated;
select pg_temp.check_result('revocation removes case and object access',(select count(*)=0 from public.office_cases) and (select count(*)=0 from storage.objects));
reset role;
set local role anon;
do $$begin begin perform public.attachment_command('prepare','{}');raise exception 'FAILED anonymous rpc';exception when insufficient_privilege then perform pg_temp.check_result('anonymous file commands rejected',true);end;end;$$;
reset role;
select count(*) as tests,bool_and(passed) as passed from qa_results;
rollback;
