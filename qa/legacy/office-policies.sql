begin;
create temp table office_test_accounts (id uuid primary key, email text) on commit drop;
insert into office_test_accounts values (gen_random_uuid(),'office-a@example.invalid'),(gen_random_uuid(),'office-b@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select id,email,now(),false from office_test_accounts;
create temp table office_test_results (test text, passed boolean) on commit drop;
grant select on office_test_accounts to authenticated;
grant insert, select on office_test_results to authenticated, anon;
insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
select 'Escritório B',id,'Responsável B',email,'123B','SP' from office_test_accounts where email='office-b@example.invalid';
select set_config('request.jwt.claims',json_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true) from office_test_accounts where email='office-a@example.invalid';
set local role authenticated;
insert into public.offices(name,responsible_name,responsible_email,phone,oab_number,oab_state)
values ('Escritório A','Responsável A','contato@example.invalid','(84) 99999-9999','456A','RN');
insert into office_test_results select 'own row readable and other account hidden',count(*)=1 and bool_and(responsible_user_id=auth.uid()) from public.offices;
insert into office_test_results select 'contact email does not change ownership',responsible_email='contato@example.invalid' and responsible_user_id=auth.uid() from public.offices;
do $test$ begin
  begin
    insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
    select 'Forbidden',id,'Wrong responsible',email,'99','SP' from office_test_accounts where email='office-b@example.invalid';
    raise exception 'TEST FAILED: forged owner accepted';
  exception when insufficient_privilege then insert into office_test_results values ('forged responsible rejected',true); end;
  begin
    update public.offices set responsible_user_id=(select id from office_test_accounts where email='office-b@example.invalid');
    raise exception 'TEST FAILED: owner reassignment accepted';
  exception when insufficient_privilege then insert into office_test_results values ('owner reassignment rejected',true); end;
  begin
    delete from public.offices; raise exception 'TEST FAILED: delete accepted';
  exception when insufficient_privilege then insert into office_test_results values ('client delete rejected',true); end;
  begin
    insert into public.offices(name,responsible_name,responsible_email,oab_number,oab_state) values('Duplicado','Responsável A','a@example.invalid','456','RN');
    raise exception 'TEST FAILED: duplicate accepted';
  exception when unique_violation then insert into office_test_results values ('duplicate rejected',true); end;
  begin
    insert into public.offices(name,responsible_name,responsible_email,oab_number,oab_state) values('Inválido','Responsável A','a@example.invalid','456','XX');
    raise exception 'TEST FAILED: invalid state accepted';
  exception when check_violation then insert into office_test_results values ('invalid state rejected',true); end;
  begin
    insert into public.offices(name,responsible_name,responsible_email,phone,oab_number,oab_state) values('Inválido','Responsável A','a@example.invalid','123','456','RN');
    raise exception 'TEST FAILED: invalid phone accepted';
  exception when check_violation then insert into office_test_results values ('invalid phone rejected',true); end;
end $test$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',true)::text,true) from office_test_accounts where email='office-a@example.invalid';
set local role authenticated;
insert into office_test_results select 'anonymous auth user cannot read',count(*)=0 from public.offices;
do $test$ begin
  begin
    insert into public.offices(name,responsible_name,responsible_email,oab_number,oab_state) values('Anônimo','Responsável','a@example.invalid','456','RN');
    raise exception 'TEST FAILED: anonymous insert accepted';
  exception when insufficient_privilege then insert into office_test_results values ('anonymous auth user cannot create',true); end;
end $test$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $test$ begin
  begin
    perform 1 from public.offices; raise exception 'TEST FAILED: public read accepted';
  exception when insufficient_privilege then insert into office_test_results values ('unauthenticated read rejected',true); end;
  begin
    insert into public.offices(name,responsible_name,responsible_email,oab_number,oab_state) values('Público','Responsável','a@example.invalid','456','RN');
    raise exception 'TEST FAILED: public insert accepted';
  exception when insufficient_privilege then insert into office_test_results values ('unauthenticated create rejected',true); end;
end $test$;
reset role;
select * from office_test_results order by test;
rollback;
