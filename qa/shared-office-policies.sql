-- Isolated authorization/integration fixtures. ROLLBACK removes every fixture.
begin;
create temp table qa_users(k text primary key,id uuid default gen_random_uuid(),email text) on commit drop;
insert into qa_users(k,email) values('owner','shared-owner@example.invalid'),('collab','shared-collab@example.invalid'),('reviewer','shared-reviewer@example.invalid'),('outsider','shared-outsider@example.invalid'),('unverified','shared-unverified@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
select id,email,case when k='unverified' then null else now() end,false,'{"full_name":"Pessoa de teste","role":"admin"}'::jsonb from qa_users;
create temp table qa_ids(k text primary key,id uuid,doc jsonb) on commit drop;
create temp table qa_results(test text,passed boolean) on commit drop;
grant select on qa_users to authenticated,anon;
grant select,insert,update on qa_ids,qa_results to authenticated,anon;
create function pg_temp.qa_user(key text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true) from qa_users where k=key;
$$;
create function pg_temp.check_result(label text,ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; insert into qa_results values(label,true); end; $$;
create function pg_temp.denied(label text,act text,p jsonb,expected text) returns void language plpgsql as $$
begin
  begin perform public.workspace_command(act,p); exception when others then
    if sqlerrm=expected or sqlstate=expected then perform pg_temp.check_result(label,true);return;else raise;end if;
  end;
  raise exception 'FAILED (operation allowed): %',label;
end; $$;
select pg_temp.qa_user('owner');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
select 'QA Escritório A',id,'Responsável A',email,'123','SP' from qa_users where k='owner' returning id)
insert into qa_ids select 'office',id,null from o;
select pg_temp.qa_user('outsider');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
select 'QA Escritório B',id,'Responsável B',email,'456','PR' from qa_users where k='outsider' returning id)
insert into qa_ids select 'other_office',id,null from o;
select pg_temp.qa_user('owner');
set local role authenticated;
select pg_temp.check_result('owner can read only own office',(select count(*)=1 from public.offices));
select pg_temp.check_result('owner membership bootstrapped',(select count(*)=1 and bool_and(role='admin') from public.office_members));
insert into qa_ids(k,doc) select 'invite',public.workspace_command('invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'email',(select email from qa_users where k='collab'),'role','collaborator'));
insert into qa_ids(k,doc) select 'review_invite',public.workspace_command('invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'email',(select email from qa_users where k='reviewer'),'role','reviewer'));
do $$ begin
  begin perform token_hash from public.office_invitations; raise exception 'FAILED: token hash exposed';
  exception when insufficient_privilege then perform pg_temp.check_result('invite hashes not exposed',true); end;
  begin update public.office_members set role='collaborator';raise exception 'FAILED: direct membership write';
  exception when insufficient_privilege then perform pg_temp.check_result('membership cannot be forged directly',true);end;
end; $$;
select pg_temp.qa_user('outsider');
select pg_temp.denied('wrong email cannot accept invite','accept_invite',(select doc from qa_ids where k='invite'),'invite_invalid');
select pg_temp.check_result('outsider cannot read office invitations',(select count(*)=0 from public.office_invitations));
select pg_temp.qa_user('unverified');
select pg_temp.denied('unconfirmed account cannot accept','accept_invite',(select doc from qa_ids where k='invite'),'session_missing');
select pg_temp.qa_user('collab');
select pg_temp.check_result('invite preview identifies role',public.workspace_command('preview_invite',(select doc from qa_ids where k='invite'))->>'role'='collaborator');
select public.workspace_command('accept_invite',(select doc from qa_ids where k='invite'));
select pg_temp.check_result('invited collaborator can read office',(select count(*)=1 from public.offices));
select pg_temp.check_result('user metadata cannot promote permission',(select role='collaborator' from public.office_members where user_id=auth.uid()));
select pg_temp.check_result('accept retry is idempotent',public.workspace_command('accept_invite',(select doc from qa_ids where k='invite'))->>'office_id'=(select id::text from qa_ids where k='office'));
select pg_temp.denied('collaborator cannot invite','invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'email','x@example.invalid','role','reviewer'),'42501');
select pg_temp.denied('collaborator cannot create for someone else','create_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'assignee_id',(select id from qa_users where k='owner')),'42501');
select pg_temp.qa_user('reviewer');
select public.workspace_command('accept_invite',(select doc from qa_ids where k='review_invite'));
select pg_temp.denied('reviewer cannot manage memberships','member_role',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'user_id',(select id from qa_users where k='collab'),'role','reviewer'),'42501');
select pg_temp.qa_user('owner');
insert into qa_ids(k,id,doc) select 'case',(r->>'id')::uuid,r from (select public.workspace_command('create_case',jsonb_build_object('id',gen_random_uuid(),'office_id',(select id from qa_ids where k='office'),'title','Entrega compartilhada QA','client_name','Cliente fictício QA','assignee_id',(select id from qa_users where k='collab'),'created_by',(select id from qa_users where k='outsider'))) r) q;
insert into qa_ids(k,id,doc) select 'review_case',(r->>'id')::uuid,r from (select public.workspace_command('create_case',jsonb_build_object('id',gen_random_uuid(),'office_id',(select id from qa_ids where k='office'),'title','Outra entrega QA','client_name','Cliente fictício QA','assignee_id',(select id from qa_users where k='reviewer'))) r) q;
select pg_temp.check_result('creator derived from authenticated account',(select created_by=auth.uid() from public.office_cases where id=(select id from qa_ids where k='case')));
select pg_temp.qa_user('collab');
select pg_temp.check_result('collaborator reads only assigned case',(select count(*)=1 from public.office_cases));
select pg_temp.denied('cross-case write rejected','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='review_case'),'revision',1,'document','{"ops":[{"insert":"Ataque\n"}]}'::jsonb),'42501');
select pg_temp.denied('embedded documents rejected','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',1,'document','{"ops":[{"insert":{"image":"https://example.invalid"}}]}'::jsonb),'invalid_document');
select public.workspace_command('save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',1,'document','{"ops":[{"insert":"Minuta de teste compartilhada.\n"}]}'::jsonb));
select pg_temp.check_result('collaborator save persists revision',(select revision=2 and document->'ops'->0->>'insert'=E'Minuta de teste compartilhada.\n' from public.office_cases where id=(select id from qa_ids where k='case')));
select pg_temp.denied('stale save cannot overwrite colleague','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',1,'document','{"ops":[{"insert":"Texto antigo\n"}]}'::jsonb),'version_conflict');
select public.workspace_command('comment',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'body','Comentário do autor','blocking',true));
select pg_temp.check_result('collaborator cannot create blocking comment',(select not blocking and author_id=auth.uid() from public.case_comments limit 1));
select public.workspace_command('submit',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))));
select pg_temp.denied('submitted document is read only for collaborator','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case')),'document','{"ops":[{"insert":"Modificação\n"}]}'::jsonb),'read_only');
select pg_temp.denied('collaborator cannot approve','approve',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))),'42501');
select pg_temp.qa_user('reviewer');
select pg_temp.check_result('second user sees first user saved text',(select document->'ops'->0->>'insert'=E'Minuta de teste compartilhada.\n' from public.office_cases where id=(select id from qa_ids where k='case')));
select pg_temp.check_result('reviewer sees all office cases',(select count(*)=2 from public.office_cases));
select public.workspace_command('comment',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'body','Conferir informação','blocking',true));
select pg_temp.denied('unresolved blocker prevents approval','approve',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))),'pending_comments');
select public.workspace_command('return',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))));
select pg_temp.check_result('reviewer can return case for changes',(select status='changes' from public.office_cases where id=(select id from qa_ids where k='case')));
select public.workspace_command('resolve_comment',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'id',(select id from public.case_comments where blocking limit 1),'resolved',true));
select pg_temp.qa_user('collab');
select public.workspace_command('submit',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))));
select pg_temp.qa_user('reviewer');
select public.workspace_command('approve',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case'),'revision',(select revision from public.office_cases where id=(select id from qa_ids where k='case'))));
select pg_temp.check_result('reviewer approval freezes shared case',(select status='approved' from public.office_cases where id=(select id from qa_ids where k='case')));
select pg_temp.denied('approved case cannot be overwritten','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case')),'case_approved');
select public.workspace_command('save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='review_case'),'revision',1,'document','{"ops":[{"insert":"Autoria do revisor\n"}]}'::jsonb));
select public.workspace_command('submit',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='review_case'),'revision',2));
select pg_temp.denied('reviewer cannot approve own assigned case','approve',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='review_case'),'revision',3),'self_approval');
select pg_temp.qa_user('outsider');
select pg_temp.check_result('other office sees no cases',(select count(*)=0 from public.office_cases));
select pg_temp.check_result('other office sees no comments',(select count(*)=0 from public.case_comments));
select pg_temp.check_result('other office sees no versions',(select count(*)=0 from public.case_versions));
select pg_temp.check_result('other office sees no activity',(select count(*)=0 from public.office_activity));
select pg_temp.denied('other office cannot call mutation','save_case',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'case_id',(select id from qa_ids where k='case')),'42501');
select pg_temp.qa_user('owner');
select pg_temp.denied('responsible owner cannot be removed','remove_member',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'user_id',auth.uid()),'owner_protected');
select pg_temp.denied('open assignments must be reassigned before removal','remove_member',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'user_id',(select id from qa_users where k='reviewer')),'reassign_first');
select public.workspace_command('remove_member',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'user_id',(select id from qa_users where k='collab')));
select pg_temp.qa_user('collab');
select pg_temp.check_result('revoked member immediately loses case reads',(select count(*)=0 from public.office_cases));
select pg_temp.check_result('revoked member loses team reads',(select count(*)=0 from public.office_members));
select pg_temp.denied('accepted invite cannot restore revoked membership','accept_invite',(select doc from qa_ids where k='invite'),'invite_invalid');
select pg_temp.qa_user('owner');
insert into qa_ids(k,doc) select 'revoked_invite',public.workspace_command('invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'email',(select email from qa_users where k='outsider'),'role','reviewer'));
select public.workspace_command('revoke_invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'id',(select id from public.office_invitations where email=(select email from qa_users where k='outsider') and revoked_at is null)));
select pg_temp.qa_user('outsider');
select pg_temp.denied('revoked invitation cannot be accepted','accept_invite',(select doc from qa_ids where k='revoked_invite'),'invite_invalid');
select pg_temp.qa_user('owner');
insert into qa_ids(k,doc) select 'expired_invite',public.workspace_command('invite',jsonb_build_object('office_id',(select id from qa_ids where k='office'),'email',(select email from qa_users where k='outsider'),'role','reviewer'));
reset role;
update public.office_invitations set expires_at=now()-interval '1 minute' where office_id=(select id from qa_ids where k='office') and email=(select email from qa_users where k='outsider') and revoked_at is null;
set local role authenticated;
select pg_temp.qa_user('outsider');
select pg_temp.denied('expired invitation cannot be accepted','accept_invite',(select doc from qa_ids where k='expired_invite'),'invite_invalid');
reset role;
set local role anon;
do $$ begin
  begin perform public.workspace_command('invite','{}');raise exception 'FAILED: anonymous rpc';
  exception when insufficient_privilege then perform pg_temp.check_result('anonymous RPC denied',true);end;
  begin perform * from public.office_cases;raise exception 'FAILED: anonymous case read';
  exception when insufficient_privilege then perform pg_temp.check_result('anonymous table read denied',true);end;
end; $$;
reset role;
select jsonb_build_object('passed',(select count(*) from qa_results where passed),'checks',(select jsonb_agg(test) from qa_results),'fixtures','rolled back') as result;
rollback;
