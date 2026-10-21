-- Disposable fixtures only; verifies the real schema without changing customer choices.
begin;
create temp table billing_people(k text primary key,id uuid default gen_random_uuid(),office_id uuid) on commit drop;
insert into billing_people(k) values ('owner'),('other');
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
select id,id::text||'@example.invalid',now(),false from billing_people;
do $$ declare p record; new_office uuid; begin
  for p in select * from billing_people loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',p.id,'is_anonymous',false)::text,true);
    insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
      values('Billing QA Office',p.id,'QA Owner',p.id::text||'@example.invalid','12345','PB') returning id into new_office;
    update billing_people set office_id=new_office where id=p.id;
  end loop;
end $$;
create temp table billing_results(label text, passed boolean) on commit drop;
create temp table billing_stamp(value timestamptz) on commit drop;
grant select on billing_people to authenticated;
grant select,insert on billing_results,billing_stamp to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'is_anonymous',false)::text,true) from billing_people where k='owner';
set local role authenticated;
update public.offices set plan_code='equipe_anual' where responsible_user_id=auth.uid();
insert into billing_results select 'annual persists with server timestamp',count(*)=1 and bool_and(plan_code='equipe_anual' and plan_selected_at is not null) from public.offices;
insert into billing_stamp select plan_selected_at from public.offices;
update public.offices set plan_code='equipe_anual' where responsible_user_id=auth.uid();
insert into billing_results select 'identical retry preserves timestamp',plan_selected_at=(select value from billing_stamp) from public.offices;
update public.offices set plan_code='equipe_mensal' where responsible_user_id=auth.uid();
insert into billing_results select 'monthly replaces annual explicitly',plan_code='equipe_mensal' and plan_selected_at>(select value from billing_stamp) from public.offices;
with changed as (update public.offices set plan_code='equipe_anual' where id=(select office_id from billing_people where k='other') returning id)
insert into billing_results select 'other office is protected',count(*)=0 from changed;
do $$ begin
  begin update public.offices set plan_code='inventado'; raise exception 'invalid plan accepted';
  exception when check_violation then insert into billing_results values('invalid code rejected',true); end;
  begin update public.offices set plan_selected_at=now(); raise exception 'timestamp writable';
  exception when insufficient_privilege then insert into billing_results values('timestamp protected',true); end;
  begin update public.offices set responsible_user_id=(select id from billing_people where k='other'); raise exception 'owner writable';
  exception when insufficient_privilege then insert into billing_results values('owner protected',true); end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'is_anonymous',true)::text,true) from billing_people where k='owner';
set local role authenticated;
with changed as (update public.offices set plan_code='equipe_anual' returning id)
insert into billing_results select 'anonymous session cannot change plan',count(*)=0 from changed;
reset role;
do $$ begin
  if (select count(*) from billing_results)<>8 or exists(select 1 from billing_results where passed is not true) then raise exception 'Billing verification failed'; end if;
end $$;
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label order by label)) as result from billing_results;
rollback;
