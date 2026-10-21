-- Private, immutable case documents. Run after case-workflow.sql.
create table public.case_attachments (
  id uuid primary key,
  office_id uuid not null,
  case_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 180 and display_name !~ '[/\\[:cntrl:]]'),
  mime_type text not null,
  byte_size bigint not null check(byte_size between 1 and 20971520),
  object_path text not null unique,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  foreign key(office_id,case_id) references public.office_cases(office_id,id) on delete cascade
);
create index case_attachments_case_idx on public.case_attachments(case_id,created_at);
create index case_attachments_office_case_idx on public.case_attachments(office_id,case_id);
create index case_attachments_uploader_idx on public.case_attachments(uploaded_by);
alter table public.case_attachments enable row level security;
revoke all on public.case_attachments from public,anon,authenticated;
grant select on public.case_attachments to authenticated;
grant all on public.case_attachments to service_role;
create policy attachments_read on public.case_attachments for select to authenticated
  using ((select private.case_access(case_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('case-documents','case-documents',false,20971520,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain','image/png','image/jpeg'
]);

create function private.attachment_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.case_attachments a join public.office_cases c on c.id=a.case_id
    where a.object_path=p_path and private.case_access(c.id)
    and (not p_write or (a.uploaded_by=(select auth.uid()) and a.uploaded_at is null
      and c.status<>'approved' and (private.office_role(c.office_id) in ('admin','reviewer') or c.status in ('working','changes')))));
$$;
revoke all on function private.attachment_access(text,boolean) from public,anon;
grant execute on function private.attachment_access(text,boolean) to authenticated;
create policy case_documents_read on storage.objects for select to authenticated
  using(bucket_id='case-documents' and (select private.attachment_access(name,false)));
create policy case_documents_insert on storage.objects for insert to authenticated
  with check(bucket_id='case-documents' and (select private.attachment_access(name,true)));
-- No UPDATE/upsert or DELETE: an attached original cannot be silently replaced.

create function private.attachment_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); c public.office_cases%rowtype; a public.case_attachments%rowtype;
  oid uuid:=(p_data->>'office_id')::uuid; cid uuid:=(p_data->>'case_id')::uuid;
  aid uuid:=(p_data->>'id')::uuid; ext text; mime text; fname text; bytes bigint; obj storage.objects%rowtype;
begin
  perform 1 from public.offices where id=oid for update;
  select * into c from public.office_cases where id=cid and office_id=oid for update;
  if c.id is null or uid is null or not private.case_access(cid) then raise exception 'access_denied' using errcode='42501'; end if;
  if c.status='approved' then raise exception 'case_approved'; end if;
  if private.office_role(oid)='collaborator' and c.status not in ('working','changes') then raise exception 'read_only'; end if;
  if aid is null then raise exception 'invalid_attachment'; end if;
  select * into a from public.case_attachments where id=aid for update;
  if a.id is not null and (a.case_id<>cid or a.uploaded_by<>uid) then raise exception 'access_denied' using errcode='42501'; end if;
  if p_action='prepare' then
    fname:=btrim(p_data->>'name'); bytes:=(p_data->>'size')::bigint; ext:=lower(substring(fname from '[.]([^.]+)$'));
    mime:=case ext when 'pdf' then 'application/pdf' when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      when 'txt' then 'text/plain' when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' end;
    if mime is null or fname is null or char_length(fname) not between 1 and 180 or fname ~ '[/\\[:cntrl:]]'
      or bytes is null or bytes not between 1 and 20971520 then raise exception 'invalid_attachment'; end if;
    if a.id is not null then
      if a.display_name<>fname or a.byte_size<>bytes then raise exception 'invalid_attachment'; end if;
      return to_jsonb(a);
    end if;
    if (select count(*)>=10 or coalesce(sum(byte_size),0)+bytes>104857600 from public.case_attachments where case_id=cid) then raise exception 'attachment_limit'; end if;
    insert into public.case_attachments(id,office_id,case_id,display_name,mime_type,byte_size,object_path,uploaded_by)
      values(aid,oid,cid,fname,mime,bytes,oid::text||'/'||cid::text||'/'||aid::text||'.'||ext,uid) returning * into a;
  elsif p_action='complete' then
    if a.id is null then raise exception 'invalid_attachment'; end if;
    if a.uploaded_at is not null then return to_jsonb(a); end if;
    select * into obj from storage.objects where bucket_id='case-documents' and name=a.object_path;
    if obj.id is null then raise exception 'attachment_pending'; end if;
    if obj.owner_id is distinct from uid::text or (obj.metadata->>'size')::bigint is distinct from a.byte_size
      or split_part(obj.metadata->>'mimetype',';',1) is distinct from a.mime_type then raise exception 'invalid_attachment'; end if;
    update public.case_attachments set uploaded_at=now() where id=aid returning * into a;
    insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,cid,uid,'Documento anexado: '||a.display_name);
  elsif p_action='cancel' then
    if a.id is null then return '{}'::jsonb; end if;
    if a.uploaded_at is not null or exists(select 1 from storage.objects where bucket_id='case-documents' and name=a.object_path) then raise exception 'attachment_exists'; end if;
    delete from public.case_attachments where id=aid;
    return '{}'::jsonb;
  else raise exception 'unknown_action'; end if;
  return to_jsonb(a);
end; $$;
revoke all on function private.attachment_command(text,jsonb) from public,anon;
grant execute on function private.attachment_command(text,jsonb) to authenticated;
create function public.attachment_command(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.attachment_command(p_action,p_data);$$;
revoke all on function public.attachment_command(text,jsonb) from public,anon;
grant execute on function public.attachment_command(text,jsonb) to authenticated;

-- Published last, so clients only enable the complete workflow.
create function public.workspace_capabilities() returns jsonb
language sql stable security invoker set search_path='' as $$select '{"version":23}'::jsonb;$$;
revoke all on function public.workspace_capabilities() from public,anon;
grant execute on function public.workspace_capabilities() to authenticated;
