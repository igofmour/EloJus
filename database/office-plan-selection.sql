-- Apply after office-registration.sql. Reference SQL for the remote migration
-- save_office_plan_selection; do not reapply to an already migrated database.
alter table public.offices
  add column plan_code text check (plan_code in ('essencial', 'equipe', 'personalizado')),
  add column plan_selected_at timestamptz,
  add constraint offices_plan_selection_complete check (
    (plan_code is null and plan_selected_at is null)
    or (plan_code is not null and plan_selected_at is not null)
  );

comment on column public.offices.plan_code is 'Provisional plan preference only. Does not activate a subscription, payment, entitlements or membership.';
comment on column public.offices.plan_selected_at is 'Server timestamp of the latest change to the plan preference. Identical retries preserve it.';

create function public.stamp_office_plan_selection()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.plan_code is distinct from old.plan_code then
    new.plan_selected_at := case when new.plan_code is null then null else clock_timestamp() end;
  else
    new.plan_selected_at := old.plan_selected_at;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_office_plan_selection() from public, anon, authenticated;
create trigger stamp_office_plan_selection before update of plan_code on public.offices
for each row execute function public.stamp_office_plan_selection();

-- The remaining registration fields and timestamp stay read-only to the client.
grant update (plan_code) on public.offices to authenticated;
create policy offices_choose_own_plan on public.offices for update to authenticated
using (
  responsible_user_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous'), 'false') = 'false'
)
with check (
  responsible_user_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous'), 'false') = 'false'
  and plan_code is not null
);
