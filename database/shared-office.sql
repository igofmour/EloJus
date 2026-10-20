-- Reference for remote migration shared_office_v21. No billing is activated.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.office_members (
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('admin','reviewer','collaborator')),
  display_name text not null check (char_length(display_name) between 1 and 120),
  email text not null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (office_id,user_id)
);
create index office_members_user_idx on public.office_members(user_id,office_id) where removed_at is null;

create table public.office_invitations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  email text not null check (email=lower(btrim(email)) and char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  role text not null check (role in ('reviewer','collaborator')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz
);
create unique index office_invitations_pending_idx on public.office_invitations(office_id,email) where accepted_at is null and revoked_at is null;
create index office_invitations_creator_idx on public.office_invitations(created_by);
create index office_invitations_acceptor_idx on public.office_invitations(accepted_by);

create table public.office_cases (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  number bigint generated always as identity,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  client_name text not null check (char_length(btrim(client_name)) between 2 and 180),
  area text not null default 'Geral' check (char_length(area) between 1 and 80),
  instructions text not null default '' check (char_length(instructions)<=10000),
  due_date date,
  assignee_id uuid not null,
  created_by uuid not null references auth.users(id),
  status text not null default 'working' check (status in ('working','review','changes','approved')),
  document jsonb not null default '{"ops":[{"insert":"\n"}]}',
  revision integer not null default 1,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (office_id,assignee_id) references public.office_members(office_id,user_id),
  unique (office_id,id)
);
create index office_cases_list_idx on public.office_cases(office_id,updated_at desc);
create index office_cases_assignee_idx on public.office_cases(office_id,assignee_id);
create index office_cases_created_idx on public.office_cases(created_by);
create index office_cases_updated_idx on public.office_cases(updated_by);

create table public.case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.office_cases(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  quote text not null default '' check (char_length(quote)<=1000),
  document_revision integer not null,
  blocking boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index case_comments_case_idx on public.case_comments(case_id,created_at);
create index case_comments_author_idx on public.case_comments(author_id);
create index case_comments_resolver_idx on public.case_comments(resolved_by);
create table public.case_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.office_cases(id) on delete cascade,
  document jsonb not null,
  revision integer not null,
  label text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index case_versions_case_idx on public.case_versions(case_id,created_at desc);
create index case_versions_creator_idx on public.case_versions(created_by);
create table public.office_activity (
  id bigint generated always as identity primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  case_id uuid references public.office_cases(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  created_at timestamptz not null default now()
);
create index office_activity_office_idx on public.office_activity(office_id,created_at desc);
create index office_activity_case_idx on public.office_activity(case_id,created_at desc);
create index office_activity_actor_idx on public.office_activity(actor_id);

-- Authorization reads current membership and verified Auth records, never user metadata.
create function private.office_role(p_office uuid) returns text
language sql stable security definer set search_path='' as $$
  select m.role from public.office_members m join auth.users u on u.id=m.user_id
  where m.office_id=p_office and m.user_id=(select auth.uid()) and m.removed_at is null
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and coalesce(((select auth.jwt())->>'is_anonymous'),'false')='false';
$$;
create function private.case_access(p_case uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.office_cases c where c.id=p_case
    and (private.office_role(c.office_id) in ('admin','reviewer')
      or (private.office_role(c.office_id)='collaborator' and c.assignee_id=(select auth.uid()))));
$$;
revoke all on function private.office_role(uuid),private.case_access(uuid) from public,anon;
grant execute on function private.office_role(uuid),private.case_access(uuid) to authenticated;

create function private.seed_office_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.responsible_user_id<>auth.uid() or not exists (
    select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false)
  ) then raise exception 'session_missing' using errcode='42501'; end if;
  insert into public.office_members(office_id,user_id,role,display_name,email)
    select new.id,u.id,'admin',new.responsible_name,lower(u.email) from auth.users u where u.id=new.responsible_user_id;
  return new;
end; $$;
revoke all on function private.seed_office_owner() from public,anon,authenticated;
create trigger seed_office_owner after insert on public.offices for each row execute function private.seed_office_owner();
insert into public.office_members(office_id,user_id,role,display_name,email)
  select o.id,o.responsible_user_id,'admin',o.responsible_name,lower(u.email)
  from public.offices o join auth.users u on u.id=o.responsible_user_id;

alter table public.office_members enable row level security;
alter table public.office_invitations enable row level security;
alter table public.office_cases enable row level security;
alter table public.case_comments enable row level security;
alter table public.case_versions enable row level security;
alter table public.office_activity enable row level security;
revoke all on public.office_members,public.office_invitations,public.office_cases,public.case_comments,public.case_versions,public.office_activity from public,anon,authenticated;
grant select on public.office_members,public.office_cases,public.case_comments,public.case_versions,public.office_activity to authenticated;
grant select(id,office_id,email,role,created_by,created_at,expires_at,accepted_at,accepted_by,revoked_at) on public.office_invitations to authenticated;
grant all on public.office_members,public.office_invitations,public.office_cases,public.case_comments,public.case_versions,public.office_activity to service_role;
create policy offices_read_member on public.offices for select to authenticated using ((select private.office_role(id)) is not null);
create policy members_read on public.office_members for select to authenticated using ((select private.office_role(office_id)) is not null);
create policy invitations_read on public.office_invitations for select to authenticated using ((select private.office_role(office_id))='admin');
create policy cases_read on public.office_cases for select to authenticated using ((select private.case_access(id)));
create policy comments_read on public.case_comments for select to authenticated using ((select private.case_access(case_id)));
create policy versions_read on public.case_versions for select to authenticated using ((select private.case_access(case_id)));
create policy activity_read on public.office_activity for select to authenticated using (
  (case_id is not null and (select private.case_access(case_id))) or (case_id is null and (select private.office_role(office_id))='admin')
);

-- Strictly text-only Quill delta: no HTML, embedded objects, images or URLs.
create function private.valid_case_document(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare op jsonb; a record;
begin
  if d is null or jsonb_typeof(d)<>'object' or jsonb_typeof(d->'ops') is distinct from 'array' or octet_length(d::text)>1000000 then return false; end if;
  if jsonb_array_length(d->'ops') not between 1 and 10000 then return false; end if;
  for op in select value from jsonb_array_elements(d->'ops') loop
    if jsonb_typeof(op)<>'object' or jsonb_typeof(op->'insert') is distinct from 'string' or op-'insert'-'attributes'<>'{}'::jsonb then return false; end if;
    if op ? 'attributes' then
      if jsonb_typeof(op->'attributes')<>'object' then return false; end if;
      for a in select * from jsonb_each(op->'attributes') loop
        if a.key in ('bold','italic','underline','strike','blockquote') then
          if a.value not in ('true'::jsonb,'false'::jsonb) then return false; end if;
        elsif a.key='size' then
          if a.value#>>'{}' not in ('9pt','10pt','11pt','12pt','14pt','16pt','18pt','20pt','24pt') then return false; end if;
        elsif a.key='header' then
          if a.value not in ('1'::jsonb,'2'::jsonb) then return false; end if;
        elsif a.key='list' then
          if a.value#>>'{}' not in ('ordered','bullet') then return false; end if;
        elsif a.key='align' then
          if a.value#>>'{}' not in ('left','center','right','justify') then return false; end if;
        elsif a.key='indent' then
          if a.value::text !~ '^[0-8]$' then return false; end if;
        else return false; end if;
      end loop;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function private.valid_case_document(jsonb) from public,anon,authenticated;
alter table public.office_cases add constraint cases_safe_document check (private.valid_case_document(document));

-- All writes are transactional commands; clients cannot forge actors, versions or memberships.
create function private.workspace_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); usr auth.users%rowtype; oid uuid; role_name text; token text;
  inv public.office_invitations%rowtype; c public.office_cases%rowtype;
  target uuid; result jsonb; label text; cid uuid;
begin
  select * into usr from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if uid is null or usr.id is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception 'session_missing' using errcode='42501'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'invalid_input'; end if;

  if p_action in ('preview_invite','accept_invite') then
    token:=p_data->>'token';
    if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'invite_invalid'; end if;
    select * into inv from public.office_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
    if inv.id is null or inv.email<>lower(usr.email) or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'invite_invalid'; end if;
    if inv.accepted_at is not null then
      if p_action='accept_invite' and inv.accepted_by=uid and private.office_role(inv.office_id) is not null then return jsonb_build_object('office_id',inv.office_id); end if;
      raise exception 'invite_invalid';
    end if;
    if p_action='preview_invite' then return (select jsonb_build_object('name',name,'role',inv.role,'expires_at',inv.expires_at,'email',inv.email) from public.offices where id=inv.office_id); end if;
    if exists(select 1 from public.office_members where office_id=inv.office_id and user_id=uid and removed_at is null) then raise exception 'already_member'; end if;
    insert into public.office_members(office_id,user_id,role,display_name,email)
      values(inv.office_id,uid,inv.role,left(coalesce(nullif(btrim(usr.raw_user_meta_data->>'full_name'),''),usr.email),120),lower(usr.email))
      on conflict(office_id,user_id) do update set role=excluded.role,removed_at=null,display_name=excluded.display_name,email=excluded.email,joined_at=now();
    update public.office_invitations set accepted_at=now(),accepted_by=uid where id=inv.id;
    insert into public.office_activity(office_id,actor_id,action) values(inv.office_id,uid,'Convite aceito; integrante entrou no escritório.');
    return jsonb_build_object('office_id',inv.office_id);
  end if;

  oid:=(p_data->>'office_id')::uuid; role_name:=private.office_role(oid);
  -- Serialize membership/assignment changes and prevent revocation racing a case write.
  perform 1 from public.offices where id=oid for update;
  role_name:=private.office_role(oid);
  if role_name is null then raise exception 'access_denied' using errcode='42501'; end if;
  if p_action in ('invite','revoke_invite','member_role','remove_member') then
    if role_name<>'admin' then raise exception 'access_denied' using errcode='42501'; end if;
    if p_action='invite' then
      if coalesce(p_data->>'role','') not in ('reviewer','collaborator') then raise exception 'invalid_role'; end if;
      if exists(select 1 from public.office_members where office_id=oid and lower(email)=lower(btrim(p_data->>'email')) and removed_at is null) then raise exception 'already_member'; end if;
      if (select count(*) from public.office_invitations where office_id=oid and created_at>now()-interval '1 hour')>=30 then raise exception 'invite_limit'; end if;
      update public.office_invitations set revoked_at=now() where office_id=oid and email=lower(btrim(p_data->>'email')) and accepted_at is null and revoked_at is null;
      token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
      insert into public.office_invitations(office_id,email,role,token_hash,created_by)
        values(oid,lower(btrim(p_data->>'email')),p_data->>'role',encode(sha256(convert_to(token,'UTF8')),'hex'),uid) returning * into inv;
      result:=jsonb_build_object('token',token,'expires_at',inv.expires_at);
      label:='Convite de integrante criado.';
    elsif p_action='revoke_invite' then
      update public.office_invitations set revoked_at=now() where id=(p_data->>'id')::uuid and office_id=oid and accepted_at is null and revoked_at is null;
      result:='{}'; label:='Convite revogado.';
    else
      target:=(p_data->>'user_id')::uuid;
      if target=(select responsible_user_id from public.offices where id=oid) then raise exception 'owner_protected'; end if;
      if not exists(select 1 from public.office_members where office_id=oid and user_id=target and removed_at is null) then raise exception 'member_missing'; end if;
      if p_action='remove_member' then
        if exists(select 1 from public.office_cases where office_id=oid and assignee_id=target and status<>'approved') then raise exception 'reassign_first'; end if;
        update public.office_members set removed_at=now() where office_id=oid and user_id=target;
        label:='Acesso de integrante removido.';
      else
        if coalesce(p_data->>'role','') not in ('reviewer','collaborator') then raise exception 'invalid_role'; end if;
        update public.office_members set role=p_data->>'role' where office_id=oid and user_id=target;
        label:='Permissão de integrante atualizada.';
      end if;
      result:='{}';
    end if;
    insert into public.office_activity(office_id,actor_id,action) values(oid,uid,label);
    return result;
  end if;

  if p_action='create_case' then
    if role_name not in ('admin','reviewer') then raise exception 'access_denied' using errcode='42501'; end if;
    target:=(p_data->>'assignee_id')::uuid;
    if not exists(select 1 from public.office_members where office_id=oid and user_id=target and removed_at is null) then raise exception 'member_missing'; end if;
    cid:=(p_data->>'id')::uuid;
    select * into c from public.office_cases where id=cid;
    if c.id is not null then
      if c.office_id=oid and c.created_by=uid then return to_jsonb(c); end if;
      raise exception 'access_denied' using errcode='42501';
    end if;
    insert into public.office_cases(id,office_id,title,client_name,area,instructions,due_date,assignee_id,created_by,updated_by)
      values(cid,oid,btrim(p_data->>'title'),btrim(p_data->>'client_name'),coalesce(nullif(btrim(p_data->>'area'),''),'Geral'),coalesce(p_data->>'instructions',''),nullif(p_data->>'due_date','')::date,target,uid,uid) returning * into c;
    insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,c.id,uid,'Caso criado.');
    return to_jsonb(c);
  end if;

  select * into c from public.office_cases where id=(p_data->>'case_id')::uuid and office_id=oid for update;
  if c.id is null or not private.case_access(c.id) then raise exception 'access_denied' using errcode='42501'; end if;
  if c.status='approved' then raise exception 'case_approved'; end if;
  if p_action in ('save_case','assign','submit','approve','return','version') and (p_data->>'revision')::integer is distinct from c.revision then raise exception 'version_conflict'; end if;
  if p_action='save_case' then
    if role_name='collaborator' and c.status not in ('working','changes') then raise exception 'read_only'; end if;
    if not private.valid_case_document(p_data->'document') then raise exception 'invalid_document'; end if;
    if c.document=p_data->'document' then return to_jsonb(c); end if;
    update public.office_cases set document=p_data->'document',revision=revision+1,updated_by=uid,updated_at=now() where id=c.id returning * into c;
    return to_jsonb(c);
  elsif p_action='assign' then
    if role_name not in ('admin','reviewer') then raise exception 'access_denied' using errcode='42501'; end if;
    target:=(p_data->>'assignee_id')::uuid;
    if not exists(select 1 from public.office_members where office_id=oid and user_id=target and removed_at is null) then raise exception 'member_missing'; end if;
    update public.office_cases set assignee_id=target,title=btrim(p_data->>'title'),client_name=btrim(p_data->>'client_name'),area=coalesce(nullif(btrim(p_data->>'area'),''),'Geral'),instructions=coalesce(p_data->>'instructions',''),due_date=nullif(p_data->>'due_date','')::date where id=c.id;
    label:='Contexto e responsabilidade atualizados.';
  elsif p_action='comment' then
    insert into public.case_comments(case_id,author_id,body,quote,document_revision,blocking)
      values(c.id,uid,btrim(p_data->>'body'),coalesce(p_data->>'quote',''),c.revision,role_name in ('admin','reviewer') and coalesce((p_data->>'blocking')::boolean,false));
    label:='Comentário adicionado.';
  elsif p_action='resolve_comment' then
    if role_name not in ('admin','reviewer') then raise exception 'access_denied' using errcode='42501'; end if;
    update public.case_comments set resolved_at=case when coalesce((p_data->>'resolved')::boolean,false) then now() end,resolved_by=case when coalesce((p_data->>'resolved')::boolean,false) then uid end where id=(p_data->>'id')::uuid and case_id=c.id;
    label:='Situação de comentário atualizada.';
  elsif p_action in ('submit','approve','return','version') then
    if p_action in ('submit','version') and role_name='collaborator' and c.status not in ('working','changes') then raise exception 'read_only'; end if;
    if p_action='submit' and c.status not in ('working','changes') then raise exception 'invalid_transition'; end if;
    if p_action in ('approve','return') then
      if role_name not in ('admin','reviewer') or c.status<>'review' then raise exception 'access_denied' using errcode='42501'; end if;
      if p_action='approve' and c.assignee_id=uid then raise exception 'self_approval'; end if;
      if p_action='approve' and exists(select 1 from public.case_comments where case_id=c.id and blocking and resolved_at is null) then raise exception 'pending_comments'; end if;
      if p_action='return' and not exists(select 1 from public.case_comments where case_id=c.id and resolved_at is null) then raise exception 'comment_required'; end if;
    end if;
    if p_action in ('submit','approve') and not exists(select 1 from jsonb_array_elements(c.document->'ops') op where btrim(regexp_replace(op->>'insert','\s','','g'))<>'') then raise exception 'empty_document'; end if;
    label:=case p_action when 'submit' then 'Minuta enviada para revisão.' when 'approve' then 'Minuta aprovada internamente.' when 'return' then 'Ajustes solicitados.' else 'Versão de trabalho registrada.' end;
    if p_action<>'return' then insert into public.case_versions(case_id,document,revision,label,created_by) values(c.id,c.document,c.revision,label,uid); end if;
    update public.office_cases set status=case p_action when 'submit' then 'review' when 'approve' then 'approved' when 'return' then 'changes' else status end where id=c.id;
  else raise exception 'unknown_action'; end if;
  insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,c.id,uid,label);
  update public.office_cases set revision=revision+1,updated_by=uid,updated_at=now() where id=c.id returning * into c;
  return to_jsonb(c);
end; $$;
revoke all on function private.workspace_command(text,jsonb) from public,anon;
grant execute on function private.workspace_command(text,jsonb) to authenticated;
create function public.workspace_command(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.workspace_command(p_action,p_data); $$;
revoke all on function public.workspace_command(text,jsonb) from public,anon;
grant execute on function public.workspace_command(text,jsonb) to authenticated;
comment on table public.office_cases is 'Shared office cases. RLS on reads; transactional commands validate all writes and optimistic revisions.';
