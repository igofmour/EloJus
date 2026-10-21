-- v25 file-delivery integration checks. Disposable identities and office; always ROLLBACK.
-- Does not insert/update/delete storage.objects or touch existing office records.
begin;
create temp table qa_people(k text primary key,id uuid default gen_random_uuid(),email text) on commit drop;
insert into qa_people(k,email) values
 ('admin','review-admin@example.invalid'),('reviewer','review-lawyer@example.invalid'),
 ('intern','review-intern@example.invalid'),('other','review-other@example.invalid'),('outside','review-outside@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select id,email,now(),false from qa_people;
create temp table qa_data(k text primary key,data jsonb) on commit drop;
create temp table qa_results(test text,passed boolean) on commit drop;
grant select on qa_people to authenticated,anon;
grant all on qa_data,qa_results to authenticated,anon;
create function pg_temp.as_user(k text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true)
 from qa_people where qa_people.k=as_user.k;
$$;
create function pg_temp.check_result(label text,ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label;end if;
 insert into qa_results values(label,true);end;$$;
create function pg_temp.cmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.workspace_command(action,jsonb_build_object('office_id',(select data->>'id' from qa_data where k='office'))||extra);
$$;
create function pg_temp.piece() returns jsonb language sql as $$
 select jsonb_build_object('case_id',id,'revision',revision) from public.office_cases
 where id=(select (data->>'id')::uuid from qa_data where k='piece');
$$;
create function pg_temp.denied(label text,action text,extra jsonb,expected text) returns void language plpgsql as $$
begin begin perform pg_temp.cmd(action,extra);
 exception when others then
 if sqlerrm=expected or sqlstate=expected then perform pg_temp.check_result(label,true);return;else raise;end if;
 end;raise exception 'FAILED allowed: %',label;end;$$;
create function pg_temp.filecmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.attachment_command(action,jsonb_build_object(
 'office_id',(select data->>'id' from qa_data where k='office'),
 'case_id',(select data->>'id' from qa_data where k='piece'),
 'id',(select data->>'id' from qa_data where k='file'))||extra);
$$;
select pg_temp.as_user('admin');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
 select 'QA v25 descartável',id,'QA Admin',email,'1234','SP' from qa_people where k='admin' returning *)
insert into qa_data select 'office',to_jsonb(o) from o;
insert into public.office_members(office_id,user_id,role,display_name,email,professional_type,oab_number,oab_state)
select (select (data->>'id')::uuid from qa_data where k='office'),id,
 case when k='reviewer' then 'reviewer' else 'collaborator' end,k,email,
 case when k='reviewer' then 'lawyer' else 'intern' end,
 case when k='reviewer' then '5678' end,case when k='reviewer' then 'SP' end
from qa_people where k in ('reviewer','intern','other');
set local role authenticated;
select pg_temp.as_user('intern');
insert into qa_data select 'piece',pg_temp.cmd('create_case',jsonb_build_object('id',gen_random_uuid(),'title','Peça por arquivo QA','client_name','Fictício','reviewer_id',(select id from qa_people where k='admin')));
insert into qa_data values('file',jsonb_build_object('id',gen_random_uuid()));
update qa_data set data=pg_temp.filecmd('prepare','{"name":"Entrega 1.docx","size":73}') where k='file';
select pg_temp.denied('arquivo pendente não pode ser peça principal','set_delivery_source',pg_temp.piece()||jsonb_build_object('delivery_source','file','attachment_id',(select data->>'id' from qa_data where k='file')),'primary_file_required');
select pg_temp.denied('editor vazio continua bloqueado','submit',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid(),'summary','Entrega inicial'),'empty_document');
-- Fixture metadata only. Storage bytes/HTTP are verified separately in the browser.
reset role;
update public.case_attachments set uploaded_at=now() where id=(select (data->>'id')::uuid from qa_data where k='file');
set local role authenticated;
select pg_temp.as_user('other');
select pg_temp.denied('outro estagiário não escolhe arquivo do caso','set_delivery_source',jsonb_build_object('case_id',(select data->>'id' from qa_data where k='piece'),'delivery_source','file','attachment_id',(select data->>'id' from qa_data where k='file')),'42501');
select pg_temp.check_result('anexos ocultos para outro estagiário',(select count(*)=0 from public.case_attachments));
select pg_temp.as_user('intern');
select pg_temp.cmd('set_delivery_source',pg_temp.piece()||jsonb_build_object('delivery_source','file','attachment_id',(select data->>'id' from qa_data where k='file')));
select pg_temp.check_result('arquivo confirmado escolhido',(select delivery_source='file' and primary_attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.office_cases));
select pg_temp.check_result('repetir seleção é idempotente',pg_temp.cmd('set_delivery_source',jsonb_build_object('case_id',(select data->>'id' from qa_data where k='piece'),'revision',1,'delivery_source','file','attachment_id',(select data->>'id' from qa_data where k='file')))->>'revision'=(select revision::text from public.office_cases));
select pg_temp.denied('revisão antiga não pode trocar conteúdo','set_delivery_source',pg_temp.piece()||'{"revision":1,"delivery_source":"editor"}','version_conflict');
insert into qa_data select 'delivery1',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid(),'summary','Arquivo original, sem texto duplicado.');
select pg_temp.cmd('submit',(select data from qa_data where k='delivery1'));
select pg_temp.check_result('envio por arquivo aceita editor vazio',(select status='review' and document->'ops'='[{"insert":"\n"}]'::jsonb from public.office_cases));
select pg_temp.check_result('rodada preserva arquivo exato',(select delivery_source='file' and attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.case_review_rounds));
select pg_temp.check_result('versão preserva arquivo exato',(select delivery_source='file' and attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.case_versions));
select pg_temp.denied('estagiário não troca conteúdo em revisão','set_delivery_source',pg_temp.piece()||'{"delivery_source":"editor"}','read_only');
select pg_temp.as_user('admin');
select pg_temp.denied('administrador não troca arquivo entregue','set_delivery_source',pg_temp.piece()||'{"delivery_source":"editor"}','read_only');
insert into qa_data values('comment',jsonb_build_object('id',gen_random_uuid()));
select pg_temp.cmd('comment',pg_temp.piece()||(select data from qa_data where k='comment')||'{"body":"Corrigir página 2.","quote":"Página 2","kind":"adjustment","blocking":true}');
select pg_temp.check_result('comentário vinculado ao arquivo original',(select reference_attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.case_comments));
select pg_temp.denied('comentário impeditivo bloqueia aprovação','approve',pg_temp.piece(),'pending_comments');
select pg_temp.cmd('return',pg_temp.piece());
select pg_temp.as_user('intern');
insert into qa_data select 'oldfile',data from qa_data where k='file';
update qa_data set data=jsonb_build_object('id',gen_random_uuid()) where k='file';
update qa_data set data=pg_temp.filecmd('prepare','{"name":"Entrega 2.pdf","size":73}') where k='file';
reset role;
update public.case_attachments set uploaded_at=now() where id=(select (data->>'id')::uuid from qa_data where k='file');
set local role authenticated;
select pg_temp.cmd('set_delivery_source',pg_temp.piece()||jsonb_build_object('delivery_source','file','attachment_id',(select data->>'id' from qa_data where k='file')));
select pg_temp.cmd('submit',(select data from qa_data where k='delivery1'));
select pg_temp.check_result('repetir envio antigo não altera arquivo da rodada',(select attachment_id=(select (data->>'id')::uuid from qa_data where k='oldfile') from public.case_review_rounds where round_number=1));
select pg_temp.cmd('address_comment',pg_temp.piece()||(select data from qa_data where k='comment')||'{"addressed":true}');
select pg_temp.cmd('reply_comment',pg_temp.piece()||jsonb_build_object('id',gen_random_uuid(),'parent_id',(select data->>'id' from qa_data where k='comment'),'body','Página 2 corrigida na nova versão.'));
select pg_temp.check_result('resposta mantém referência ao arquivo discutido',(select bool_and(reference_attachment_id=(select (data->>'id')::uuid from qa_data where k='oldfile')) from public.case_comments));
select pg_temp.cmd('submit',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid(),'summary','Página 2 corrigida.'));
select pg_temp.check_result('segunda rodada usa novo arquivo',(select attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.case_review_rounds where round_number=2));
select pg_temp.as_user('admin');
select pg_temp.cmd('comment',pg_temp.piece()||(select data from qa_data where k='comment')||'{"body":"Corrigir página 2.","quote":"Página 2","kind":"adjustment","blocking":true}');
select pg_temp.check_result('repetir comentário não troca referência histórica',(select reference_attachment_id=(select (data->>'id')::uuid from qa_data where k='oldfile') from public.case_comments where parent_id is null));
select pg_temp.denied('atendido pelo autor ainda requer resolução','approve',pg_temp.piece(),'pending_comments');
select pg_temp.cmd('resolve_comment',pg_temp.piece()||(select data from qa_data where k='comment')||'{"resolved":true}');
select pg_temp.cmd('approve',pg_temp.piece());
select pg_temp.check_result('aprovação identifica arquivo final',(select status='approved' and primary_attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.office_cases));
select pg_temp.check_result('versão aprovada mantém arquivo final',(select attachment_id=(select (data->>'id')::uuid from qa_data where k='file') from public.case_versions where label='Minuta aprovada internamente.'));
select pg_temp.denied('peça aprovada não troca conteúdo','set_delivery_source',pg_temp.piece()||'{"delivery_source":"editor"}','read_only');
select pg_temp.as_user('outside');
select pg_temp.check_result('outra pessoa não lê versões e comentários',(select count(*)=0 from public.case_versions) and (select count(*)=0 from public.case_comments));
do $$begin begin perform private.workspace_command_v24('set_delivery_source','{}');raise exception 'FAILED core accessible';exception when insufficient_privilege then perform pg_temp.check_result('núcleo antigo não contorna wrapper',true);end;end;$$;
reset role;
select pg_temp.check_result('função de captura não está exposta',not has_function_privilege('authenticated','private.capture_comment_source()','EXECUTE'));
select jsonb_build_object('passed',count(*),'tests',jsonb_agg(test)) as result from qa_results;
rollback;
