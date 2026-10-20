create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 2 and 160),
  responsible_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  responsible_name text not null check (responsible_name = btrim(responsible_name) and char_length(responsible_name) between 2 and 120),
  responsible_email text not null default (auth.jwt()->>'email') check (char_length(responsible_email) between 3 and 254 and responsible_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text check (phone is null or (char_length(phone) <= 24 and phone ~ '^\+?[0-9[:space:]().-]+$' and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 10 and 15)),
  oab_number text not null check (oab_number = btrim(oab_number) and char_length(oab_number) between 1 and 20 and oab_number ~ '[0-9]' and oab_number ~ '^[[:alnum:]. /-]+$'),
  oab_state text not null check (oab_state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  created_at timestamptz not null default now(),
  constraint offices_one_per_responsible unique (responsible_user_id)
);
comment on table public.offices is 'Office registration, one per responsible Auth account. Does not activate a subscription or grant access to other accounts or documents.';
comment on column public.offices.responsible_user_id is 'Immutable responsible account, checked against auth.uid(). Never from user metadata.';
comment on column public.offices.responsible_email is 'Self-declared professional contact. Not used for account ownership or authorization.';
comment on column public.offices.oab_number is 'Self-declared professional registration; no external verification.';
alter table public.offices enable row level security;
revoke all on public.offices from public, anon, authenticated;
grant select on public.offices to authenticated;
grant insert (name, responsible_user_id, responsible_name, responsible_email, phone, oab_number, oab_state) on public.offices to authenticated;
create policy offices_read_own on public.offices for select to authenticated
using (responsible_user_id = (select auth.uid()) and coalesce(((select auth.jwt())->>'is_anonymous'), 'false') = 'false');
create policy offices_create_own on public.offices for insert to authenticated
with check (
  responsible_user_id = (select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous'), 'false') = 'false'
);
grant all on public.offices to service_role;
