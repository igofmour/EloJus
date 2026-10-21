-- v25: file-based deliveries. Apply once after v24; no customer rows are deleted.
alter table public.case_attachments add constraint case_attachments_case_id_id_key unique(case_id,id);
alter table public.office_cases
  add column delivery_source text not null default 'editor' check(delivery_source in ('editor','file')),
  add column primary_attachment_id uuid,
  add constraint office_cases_primary_file_fk foreign key(id,primary_attachment_id) references public.case_attachments(case_id,id),
  add check((delivery_source='editor' and primary_attachment_id is null) or (delivery_source='file' and primary_attachment_id is not null));
create index office_cases_primary_attachment_idx on public.office_cases(primary_attachment_id);
alter table public.case_versions
  add column delivery_source text not null default 'editor' check(delivery_source in ('editor','file')),
  add column attachment_id uuid,
  add constraint case_versions_file_fk foreign key(case_id,attachment_id) references public.case_attachments(case_id,id),
  add check((delivery_source='editor' and attachment_id is null) or (delivery_source='file' and attachment_id is not null));
create index case_versions_attachment_idx on public.case_versions(attachment_id);
alter table public.case_review_rounds
  add column delivery_source text not null default 'editor' check(delivery_source in ('editor','file')),
  add column attachment_id uuid,
  add constraint case_review_rounds_file_fk foreign key(case_id,attachment_id) references public.case_attachments(case_id,id),
  add check((delivery_source='editor' and attachment_id is null) or (delivery_source='file' and attachment_id is not null));
create index case_review_rounds_attachment_idx on public.case_review_rounds(attachment_id);
alter table public.case_comments add column reference_attachment_id uuid,
  add constraint case_comments_reference_file_fk foreign key(case_id,reference_attachment_id) references public.case_attachments(case_id,id);
create index case_comments_reference_file_idx on public.case_comments(reference_attachment_id);

-- Capture the source once at insertion, including when a client retries a comment.
create function private.capture_comment_source() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.parent_id is not null then
   select reference_attachment_id into new.reference_attachment_id from public.case_comments where id=new.parent_id and case_id=new.case_id;
 else
   select primary_attachment_id into new.reference_attachment_id from public.office_cases where id=new.case_id;
 end if;
 return new;
end;$$;
revoke all on function private.capture_comment_source() from public,anon,authenticated;
create trigger case_comment_source before insert on public.case_comments for each row execute function private.capture_comment_source();

create or replace function private.workspace_command_v23(p_action text,p_data jsonb) returns jsonb
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
    select office_id into oid from public.office_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
    perform 1 from public.offices where id=oid for update;
    select * into inv from public.office_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
    if inv.id is null or inv.email<>lower(usr.email) or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'invite_invalid'; end if;
    if inv.accepted_at is not null then
      if p_action='accept_invite' and inv.accepted_by=uid and private.office_role(inv.office_id) is not null then return jsonb_build_object('office_id',inv.office_id); end if;
      raise exception 'invite_invalid';
    end if;
    if p_action='preview_invite' then return (select jsonb_build_object('name',name,'role',inv.role,'expires_at',inv.expires_at,'email',inv.email,'display_name',inv.display_name,'professional_type',inv.professional_type,'oab_number',inv.oab_number,'oab_state',inv.oab_state) from public.offices where id=inv.office_id); end if;
    if exists(select 1 from public.office_members where office_id=inv.office_id and user_id=uid and removed_at is null) then raise exception 'already_member'; end if;
    insert into public.office_members(office_id,user_id,role,display_name,email,professional_type,oab_number,oab_state)
      values(inv.office_id,uid,inv.role,coalesce(inv.display_name,left(coalesce(nullif(btrim(usr.raw_user_meta_data->>'full_name'),''),usr.email),120)),lower(usr.email),inv.professional_type,inv.oab_number,inv.oab_state)
      on conflict(office_id,user_id) do update set role=excluded.role,removed_at=null,display_name=excluded.display_name,email=excluded.email,joined_at=now(),professional_type=excluded.professional_type,oab_number=excluded.oab_number,oab_state=excluded.oab_state;
    update public.office_invitations set accepted_at=now(),accepted_by=uid where id=inv.id;
    insert into public.office_activity(office_id,actor_id,action) values(inv.office_id,uid,'Convite aceito; integrante entrou no escritório.');
    return jsonb_build_object('office_id',inv.office_id);
  end if;

  oid:=(p_data->>'office_id')::uuid; role_name:=private.office_role(oid);
  -- Serialize membership/assignment changes and prevent revocation racing a case write.
  perform 1 from public.offices where id=oid for update;
  role_name:=private.office_role(oid);
  if role_name is null then raise exception 'access_denied' using errcode='42501'; end if;
  if p_action in ('invite','register_member','renew_invite','revoke_invite','member_role','update_member','remove_member') then
    if role_name<>'admin' then raise exception 'access_denied' using errcode='42501'; end if;
    if p_action in ('invite','register_member','renew_invite') then
      if p_action='renew_invite' then
        select * into inv from public.office_invitations where id=(p_data->>'id')::uuid and office_id=oid for update;
        if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null then raise exception 'invite_invalid'; end if;
        p_data:=jsonb_build_object('email',inv.email,'role',inv.role,'display_name',inv.display_name,'professional_type',inv.professional_type,'oab_number',inv.oab_number,'oab_state',inv.oab_state);
      elsif p_action='register_member' then
        if not private.valid_team_profile(p_data) or p_data->>'professional_type' not in ('lawyer','intern') then raise exception 'invalid_team_profile'; end if;
        if exists(select 1 from public.office_invitations where office_id=oid and email=lower(btrim(p_data->>'email')) and accepted_at is null and revoked_at is null) then raise exception 'invite_pending'; end if;
      end if;
      if coalesce(p_data->>'role','') not in ('reviewer','collaborator') then raise exception 'invalid_role'; end if;
      if exists(select 1 from public.office_members where office_id=oid and lower(email)=lower(btrim(p_data->>'email')) and removed_at is null) then raise exception 'already_member'; end if;
      if (select count(*) from public.office_invitations where office_id=oid and created_at>now()-interval '1 hour')>=30 then raise exception 'invite_limit'; end if;
      update public.office_invitations set revoked_at=now() where office_id=oid and email=lower(btrim(p_data->>'email')) and accepted_at is null and revoked_at is null;
      token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
      insert into public.office_invitations(office_id,email,role,token_hash,created_by,display_name,professional_type,oab_number,oab_state)
        values(oid,lower(btrim(p_data->>'email')),p_data->>'role',encode(sha256(convert_to(token,'UTF8')),'hex'),uid,case when p_action='invite' then null else btrim(p_data->>'display_name') end,case when p_action='invite' then 'other' else p_data->>'professional_type' end,case when p_action<>'invite' and p_data->>'professional_type'='lawyer' then btrim(p_data->>'oab_number') end,case when p_action<>'invite' and p_data->>'professional_type'='lawyer' then p_data->>'oab_state' end) returning * into inv;
      result:=jsonb_build_object('id',inv.id,'token',token,'expires_at',inv.expires_at);
      label:=case when p_action='renew_invite' then 'Link de convite renovado; link anterior revogado.' when p_action='register_member' then 'Cadastro de integrante criado; aguardando aceite.' else 'Convite de integrante criado.' end;
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
      elsif p_action='update_member' then
        if not private.valid_team_profile(p_data) then raise exception 'invalid_team_profile'; end if;
        update public.office_members set display_name=btrim(p_data->>'display_name'),professional_type=p_data->>'professional_type',role=p_data->>'role',
          oab_number=case when p_data->>'professional_type'='lawyer' then btrim(p_data->>'oab_number') end,
          oab_state=case when p_data->>'professional_type'='lawyer' then p_data->>'oab_state' end
          where office_id=oid and user_id=target;
        label:='Cadastro e permissão de integrante atualizados.';
      else
        if coalesce(p_data->>'role','') not in ('reviewer','collaborator') then raise exception 'invalid_role'; end if;
        if p_data->>'role'='reviewer' and exists(select 1 from public.office_members where office_id=oid and user_id=target and professional_type='intern') then raise exception 'intern_restricted'; end if;
        update public.office_members set role=p_data->>'role' where office_id=oid and user_id=target;
        label:='Permissão de integrante atualizada.';
      end if;
      result:='{}';
    end if;
    insert into public.office_activity(office_id,actor_id,action) values(oid,uid,label);
    return result;
  end if;

  if p_action='create_case' then
    target:=coalesce((p_data->>'assignee_id')::uuid,uid);
    if role_name='collaborator' and target<>uid then raise exception 'access_denied' using errcode='42501'; end if;
    if not exists(select 1 from public.office_members where office_id=oid and user_id=target and removed_at is null) then raise exception 'member_missing'; end if;
    cid:=(p_data->>'id')::uuid;
    select * into c from public.office_cases where id=cid;
    if c.id is not null then
      if c.office_id=oid and c.created_by=uid and private.case_access(c.id) then return to_jsonb(c); end if;
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
    cid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
    if exists(select 1 from public.case_comments where id=cid) then
      if exists(select 1 from public.case_comments where id=cid and case_id=c.id and author_id=uid and body=btrim(p_data->>'body') and quote=coalesce(p_data->>'quote','')) then return to_jsonb(c); end if;
      raise exception 'access_denied' using errcode='42501';
    end if;
    insert into public.case_comments(id,case_id,author_id,body,quote,document_revision,blocking)
      values(cid,c.id,uid,btrim(p_data->>'body'),coalesce(p_data->>'quote',''),c.revision,role_name in ('admin','reviewer') and coalesce((p_data->>'blocking')::boolean,false));
    label:='Comentário adicionado.';
  elsif p_action='resolve_comment' then
    if role_name not in ('admin','reviewer') then raise exception 'access_denied' using errcode='42501'; end if;
    update public.case_comments set resolved_at=case when coalesce((p_data->>'resolved')::boolean,false) then now() end,resolved_by=case when coalesce((p_data->>'resolved')::boolean,false) then uid end where id=(p_data->>'id')::uuid and case_id=c.id;
    if not found then raise exception 'comment_missing'; end if;
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
    if p_action in ('submit','approve') then
      if c.delivery_source='file' then
        if not exists(select 1 from public.case_attachments a where a.id=c.primary_attachment_id and a.case_id=c.id and a.uploaded_at is not null
          and a.mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')) then raise exception 'primary_file_required';end if;
      elsif not exists(select 1 from jsonb_array_elements(c.document->'ops') op where btrim(regexp_replace(op->>'insert','\s','','g'))<>'') then raise exception 'empty_document';end if;
    end if;
    label:=case p_action when 'submit' then 'Minuta enviada para revisão.' when 'approve' then 'Minuta aprovada internamente.' when 'return' then 'Ajustes solicitados.' else 'Versão de trabalho registrada.' end;
    if p_action<>'return' then insert into public.case_versions(case_id,document,revision,label,created_by,delivery_source,attachment_id) values(c.id,c.document,c.revision,label,uid,c.delivery_source,c.primary_attachment_id); end if;
    update public.office_cases set status=case p_action when 'submit' then 'review' when 'approve' then 'approved' when 'return' then 'changes' else status end where id=c.id;
  else raise exception 'unknown_action'; end if;
  insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,c.id,uid,label);
  update public.office_cases set revision=revision+case when p_action in ('comment','resolve_comment','version') then 0 else 1 end,updated_by=uid,updated_at=now() where id=c.id returning * into c;
  return to_jsonb(c);
end; $$;

revoke all on function private.workspace_command_v23(text,jsonb) from public,anon,authenticated;

-- V24 remains private. The public RPC retains authentication and permission checks.
alter function private.workspace_command(text,jsonb) rename to workspace_command_v24;
revoke all on function private.workspace_command_v24(text,jsonb) from public,anon,authenticated;
create function private.workspace_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; cid uuid; c public.office_cases%rowtype;
  a public.case_attachments%rowtype; source text; aid uuid; actor_role text; result jsonb;
begin
 if p_action<>'set_delivery_source' then
   result:=private.workspace_command_v24(p_action,p_data);
   if p_action='submit' then
     -- Copy the immutable version, never the current case: an old request may be retried after a later round.
     update public.case_review_rounds r set delivery_source=v.delivery_source,attachment_id=v.attachment_id
       from public.case_versions v where r.id=(p_data->>'delivery_id')::uuid and v.id=r.version_id;
   end if;
   return result;
 end if;
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false))
   or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception 'session_missing' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'invalid_input';end if;
 oid:=(p_data->>'office_id')::uuid;cid:=(p_data->>'case_id')::uuid;
 perform 1 from public.offices where id=oid for update;
 actor_role:=private.office_role(oid);
 select * into c from public.office_cases where id=cid and office_id=oid for update;
 if c.id is null or actor_role is null or not private.case_access(cid) then raise exception 'access_denied' using errcode='42501';end if;
 if c.status not in ('working','changes') then raise exception 'read_only';end if;
 source:=p_data->>'delivery_source';aid:=nullif(p_data->>'attachment_id','')::uuid;
 if source is null or source not in ('editor','file') then raise exception 'invalid_delivery_source';end if;
 if source='editor' then aid:=null;
 else
   select * into a from public.case_attachments where id=aid and case_id=cid and office_id=oid;
   if a.id is null or a.uploaded_at is null or a.mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
     then raise exception 'primary_file_required';end if;
 end if;
 if c.delivery_source=source and c.primary_attachment_id is not distinct from aid then return to_jsonb(c);end if;
 if (p_data->>'revision')::integer is distinct from c.revision then raise exception 'version_conflict';end if;
 update public.office_cases set delivery_source=source,primary_attachment_id=aid,revision=revision+1,updated_by=uid,updated_at=now(),
   review_activity_at=now(),review_activity_by=uid where id=cid returning * into c;
 insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,cid,uid,
   case when source='file' then 'Peça principal definida: '||a.display_name else 'Peça principal: texto do editor.' end);
 return to_jsonb(c);
end;$$;
revoke all on function private.workspace_command(text,jsonb) from public,anon;
grant execute on function private.workspace_command(text,jsonb) to authenticated;
create or replace function public.workspace_command(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.workspace_command(p_action,p_data);$$;
create or replace function public.workspace_capabilities() returns jsonb
language sql stable security invoker set search_path='' as $$select '{"version":25}'::jsonb;$$;
