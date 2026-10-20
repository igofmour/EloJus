-- Real database authorization tests, isolated fixtures, no persisted test data.
begin;
create temp table plan_test_accounts (id uuid primary key, email text) on commit drop;
insert into plan_test_accounts values (gen_random_uuid(),'plan-a@example.invalid'),(gen_random_uuid(),'plan-b@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select id,email,now(),false from plan_test_accounts;
insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
select 'Escritório de teste',id,'Responsável de teste',email,'123','SP' from plan_test_accounts;
create temp table plan_test_results (test text, passed boolean) on commit drop;
create temp table plan_test_stamp (stamp timestamptz) on commit drop;
grant select on plan_test_accounts to authenticated;
grant select, insert on plan_test_results, plan_test_stamp to authenticated, anon;
select set_config('request.jwt.claims',json_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true) from plan_test_accounts where email='plan-a@example.invalid';
set local role authenticated;
insert into plan_test_results select 'only own office is readable',count(*)=1 and bool_and(plan_code is null and plan_selected_at is null) from public.offices;
update public.offices set plan_code='essencial' where responsible_user_id=auth.uid();
insert into plan_test_results select 'owner saves plan with server timestamp',plan_code='essencial' and plan_selected_at is not null from public.offices;
insert into plan_test_stamp select plan_selected_at from public.offices;
update public.offices set plan_code='essencial' where responsible_user_id=auth.uid();
insert into plan_test_results select 'same choice retry preserves timestamp',plan_selected_at=(select stamp from plan_test_stamp) from public.offices;
update public.offices set plan_code='equipe' where responsible_user_id=auth.uid();
insert into plan_test_results select 'changing plan updates existing office',count(*)=1 and bool_and(plan_code='equipe' and plan_selected_at>(select stamp from plan_test_stamp)) from public.offices;
update public.offices set plan_code='personalizado' where responsible_user_id=auth.uid();
insert into plan_test_results select 'third allowed choice can be saved',plan_code='personalizado' from public.offices;
with changed as (update public.offices set plan_code='equipe' where responsible_user_id=(select id from plan_test_accounts where email='plan-b@example.invalid') returning id)
insert into plan_test_results select 'other office cannot be updated',count(*)=0 from changed;
do $test$ begin
  begin
    update public.offices set plan_code='inventado'; raise exception 'TEST FAILED: invalid plan';
  exception when check_violation then insert into plan_test_results values ('unknown plan rejected',true); end;
  begin
    update public.offices set plan_code=null; raise exception 'TEST FAILED: erased choice';
  exception when insufficient_privilege then insert into plan_test_results values ('clearing saved choice rejected',true); end;
  begin
    update public.offices set plan_selected_at='2000-01-01'; raise exception 'TEST FAILED: forged time';
  exception when insufficient_privilege then insert into plan_test_results values ('client timestamp rejected',true); end;
  begin
    update public.offices set name='Changed'; raise exception 'TEST FAILED: changed registration';
  exception when insufficient_privilege then insert into plan_test_results values ('registration remains read only',true); end;
  begin
    update public.offices set responsible_user_id=(select id from plan_test_accounts where email='plan-b@example.invalid'); raise exception 'TEST FAILED: reassigned owner';
  exception when insufficient_privilege then insert into plan_test_results values ('owner reassignment rejected',true); end;
  begin
    insert into public.offices(name,responsible_name,responsible_email,oab_number,oab_state,plan_code) values('Test','Test','test@example.invalid','123','SP','essencial'); raise exception 'TEST FAILED: insert plan bypass';
  exception when insufficient_privilege then insert into plan_test_results values ('plan cannot bypass separate save through registration',true); end;
end $test$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',id,'role','authenticated','is_anonymous',true)::text,true) from plan_test_accounts where email='plan-a@example.invalid';
set local role authenticated;
with changed as (update public.offices set plan_code='equipe' returning id)
insert into plan_test_results select 'anonymous auth cannot update',count(*)=0 from changed;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $test$ begin
  begin
    update public.offices set plan_code='equipe'; raise exception 'TEST FAILED: unauthenticated update';
  exception when insufficient_privilege then insert into plan_test_results values ('unauthenticated update rejected',true); end;
end $test$;
reset role;
insert into plan_test_results select 'other office remains untouched',plan_code is null and plan_selected_at is null from public.offices where responsible_user_id=(select id from plan_test_accounts where email='plan-b@example.invalid');
do $test$ begin
  if (select count(*) from plan_test_results)<>15 or exists(select 1 from plan_test_results where passed is not true) then raise exception 'Plan authorization tests failed'; end if;
end $test$;
select * from plan_test_results order by test;
rollback;
