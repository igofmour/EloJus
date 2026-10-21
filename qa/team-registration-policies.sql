-- Isolated registration, acceptance and administration tests; no fixtures survive.
begin;
create temp table qa_people(k text primary key,id uuid default gen_random_uuid(),email text) on commit drop;
insert into qa_people(k,email) values ('admin','team-admin@example.invalid'),('intern','team-intern@example.invalid'),('lawyer','team-lawyer@example.invalid'),('outside','team-outside@example.invalid'),('pending','team-pending@example.invalid'),('unconfirmed','team-unconfirmed@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data)
select id,email,case when k='unconfirmed' then null else now() end,false,'{"full_name":"Untrusted account name","role":"admin","professional_type":"lawyer"}' from qa_people;
create temp table qa_data(k text primary key,data jsonb) on commit drop;
create temp table qa_results(test text,passed boolean) on commit drop;
grant select on qa_people to authenticated,anon;
grant select,insert,update on qa_data,qa_results to authenticated,anon;
create function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true) from qa_people where qa_people.k=as_user.k;
$$;
create function pg_temp.check_result(label text,ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if;insert into qa_results values(label,true);end; $$;
create function pg_temp.cmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
  select public.workspace_command(action,jsonb_build_object('office_id',(select data->>'id' from qa_data where k='office'))||extra);
$$;
create function pg_temp.denied(label text,action text,extra jsonb,expected text) returns void language plpgsql as $$
begin begin perform pg_temp.cmd(action,extra);exception when others then
  if sqlerrm=expected or sqlstate=expected then perform pg_temp.check_result(label,true);return;else raise;end if;
end;raise exception 'FAILED (allowed): %',label;end; $$;
select pg_temp.as_user('admin');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
select 'Team QA Office',id,'QA Administrator',email,'12345','SP' from qa_people where k='admin' returning *)
insert into qa_data select 'office',to_jsonb(o) from o;
insert into qa_data values ('intern_profile','{"display_name":"QA Intern","email":"TEAM-INTERN@example.invalid","professional_type":"intern","role":"collaborator"}'),('lawyer_profile','{"display_name":"QA Lawyer","email":"team-lawyer@example.invalid","professional_type":"lawyer","role":"reviewer","oab_number":"12345-A","oab_state":"PR"}');
set local role authenticated;
select pg_temp.check_result('owner seeded with professional registration',(select professional_type='lawyer' and oab_number='12345' and role='admin' from public.office_members where user_id=auth.uid()));
select pg_temp.denied('lawyer requires OAB','register_member',(select data-'oab_number' from qa_data where k='lawyer_profile'),'invalid_team_profile');
select pg_temp.denied('lawyer requires valid UF','register_member',(select data||'{"oab_state":"XX"}' from qa_data where k='lawyer_profile'),'invalid_team_profile');
select pg_temp.denied('registration requires name','register_member',(select data-'display_name' from qa_data where k='intern_profile'),'invalid_team_profile');
select pg_temp.denied('intern cannot be reviewer','register_member',(select data||'{"role":"reviewer"}' from qa_data where k='intern_profile'),'invalid_team_profile');
select pg_temp.denied('new admin cannot be forged','register_member',(select data||'{"role":"admin"}' from qa_data where k='lawyer_profile'),'invalid_team_profile');
insert into qa_data select 'intern_invite',pg_temp.cmd('register_member',(select data from qa_data where k='intern_profile'));
insert into qa_data select 'lawyer_invite',pg_temp.cmd('register_member',(select data from qa_data where k='lawyer_profile'));
select pg_temp.check_result('registration stores normalized email and category',(select display_name='QA Intern' and email='team-intern@example.invalid' and professional_type='intern' from public.office_invitations where id=(select (data->>'id')::uuid from qa_data where k='intern_invite')));
select pg_temp.check_result('pending registration grants no membership',(select count(*)=1 from public.office_members));
select pg_temp.denied('duplicate pending email is explicit','register_member',(select data from qa_data where k='intern_profile'),'invite_pending');
do $$begin
  begin update public.office_members set professional_type='lawyer';raise exception 'FAILED: direct update allowed';exception when insufficient_privilege then perform pg_temp.check_result('profiles cannot be forged by table write',true);end;
  begin perform token_hash from public.office_invitations;raise exception 'FAILED: token hash exposed';exception when insufficient_privilege then perform pg_temp.check_result('token hash stays private',true);end;
end;$$;
select pg_temp.as_user('outside');
select pg_temp.denied('outside office cannot register','register_member',(select data from qa_data where k='intern_profile'),'42501');
select pg_temp.denied('wrong email cannot accept','accept_invite',(select data from qa_data where k='intern_invite'),'invite_invalid');
select pg_temp.check_result('outsider cannot read profiles',(select count(*)=0 from public.office_members));
select pg_temp.check_result('outsider cannot read invitations',(select count(*)=0 from public.office_invitations));
select pg_temp.as_user('unconfirmed');
select pg_temp.denied('unconfirmed account cannot accept','accept_invite',(select data from qa_data where k='intern_invite'),'session_missing');
select pg_temp.as_user('intern');
select pg_temp.check_result('preview includes administrator registered name',pg_temp.cmd('preview_invite',(select data from qa_data where k='intern_invite'))->>'display_name'='QA Intern');
select pg_temp.cmd('accept_invite',(select data from qa_data where k='intern_invite'));
select pg_temp.check_result('accept preserves profile and ignores metadata role',(select display_name='QA Intern' and professional_type='intern' and role='collaborator' from public.office_members where user_id=auth.uid()));
select pg_temp.check_result('accept retry is idempotent',pg_temp.cmd('accept_invite',(select data from qa_data where k='intern_invite'))->>'office_id'=(select data->>'id' from qa_data where k='office'));
select pg_temp.denied('intern cannot register colleagues','register_member',(select data from qa_data where k='lawyer_profile'),'42501');
select pg_temp.denied('intern cannot edit self','update_member',jsonb_build_object('user_id',auth.uid())||(select data from qa_data where k='lawyer_profile'),'42501');
select pg_temp.as_user('lawyer');
select pg_temp.cmd('accept_invite',(select data from qa_data where k='lawyer_invite'));
select pg_temp.check_result('lawyer OAB persists on membership',(select professional_type='lawyer' and oab_number='12345-A' and oab_state='PR' and role='reviewer' from public.office_members where user_id=auth.uid()));
select pg_temp.denied('reviewer cannot register colleagues','register_member',(select data from qa_data where k='intern_profile'),'42501');
select pg_temp.denied('reviewer cannot edit colleague','update_member',jsonb_build_object('user_id',(select id from qa_people where k='intern'))||(select data from qa_data where k='intern_profile'),'42501');
select pg_temp.as_user('admin');
select pg_temp.denied('legacy role endpoint cannot promote intern','member_role',jsonb_build_object('user_id',(select id from qa_people where k='intern'),'role','reviewer'),'intern_restricted');
select pg_temp.denied('owner cannot be demoted via profile endpoint','update_member',jsonb_build_object('user_id',auth.uid())||(select data from qa_data where k='intern_profile'),'owner_protected');
select pg_temp.cmd('update_member',jsonb_build_object('user_id',(select id from qa_people where k='lawyer'))||(select data||'{"display_name":"QA Lawyer Updated","role":"collaborator","email":"replacement@example.invalid"}' from qa_data where k='lawyer_profile'));
select pg_temp.check_result('profile edit persists role and protects account email',(select display_name='QA Lawyer Updated' and role='collaborator' and email='team-lawyer@example.invalid' from public.office_members where user_id=(select id from qa_people where k='lawyer')));
insert into qa_data select 'pending_invite',pg_temp.cmd('register_member',(select data||'{"email":"team-pending@example.invalid"}' from qa_data where k='intern_profile'));
insert into qa_data select 'renewed_invite',pg_temp.cmd('renew_invite',(select data from qa_data where k='pending_invite'));
select pg_temp.check_result('renewal keeps registered profile',(select professional_type='intern' and display_name='QA Intern' and accepted_at is null and revoked_at is null from public.office_invitations where id=(select (data->>'id')::uuid from qa_data where k='renewed_invite')));
select pg_temp.as_user('pending');
select pg_temp.denied('old token invalid after renewal','accept_invite',(select data from qa_data where k='pending_invite'),'invite_invalid');
select pg_temp.check_result('renewed token previews',pg_temp.cmd('preview_invite',(select data from qa_data where k='renewed_invite'))->>'professional_type'='intern');
select pg_temp.as_user('admin');
select pg_temp.cmd('revoke_invite',(select data from qa_data where k='renewed_invite'));
select pg_temp.as_user('pending');
select pg_temp.denied('revoked token cannot be used','accept_invite',(select data from qa_data where k='renewed_invite'),'invite_invalid');
select pg_temp.as_user('admin');
select pg_temp.cmd('remove_member',jsonb_build_object('user_id',(select id from qa_people where k='intern')));
select pg_temp.check_result('deactivation preserves member history',(select removed_at is not null and display_name='QA Intern' from public.office_members where user_id=(select id from qa_people where k='intern')));
select pg_temp.as_user('intern');
select pg_temp.check_result('deactivation removes office read access',(select count(*)=0 from public.office_members));
select pg_temp.denied('old accepted invite cannot restore access','accept_invite',(select data from qa_data where k='intern_invite'),'invite_invalid');
select pg_temp.as_user('admin');
insert into qa_data select 'return_invite',pg_temp.cmd('register_member',(select data from qa_data where k='intern_profile'));
select pg_temp.as_user('intern');
select pg_temp.cmd('accept_invite',(select data from qa_data where k='return_invite'));
select pg_temp.check_result('fresh invitation restores same membership',(select count(*)=1 and bool_and(removed_at is null and role='collaborator') from public.office_members where user_id=auth.uid()));
select pg_temp.as_user('admin');
select pg_temp.check_result('team mutations are audited',(select count(*)>=8 from public.office_activity where office_id=(select (data->>'id')::uuid from qa_data where k='office') and case_id is null));
select count(*) as tests,bool_and(passed) as passed from qa_results;
rollback;
