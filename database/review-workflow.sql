-- v24 reference: apply ONCE after case-workflow.sql and case-attachments.sql.
-- Local validation first. No remote deployment is performed by this file.
create table public.office_matters(
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id),
  name text not null check(char_length(btrim(name)) between 2 and 180),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(office_id,id)
);
alter table public.office_cases
  add column matter_id uuid,
  add column reviewer_id uuid,
  add column review_due_date date,
  add column priority text not null default 'normal' check(priority in ('normal','high')),
  add column priority_reason text not null default '' check(char_length(priority_reason)<=600),
  add column review_requested_at timestamptz,
  add column review_activity_at timestamptz not null default now(),
  add column review_activity_by uuid references auth.users(id),
  add foreign key(office_id,matter_id) references public.office_matters(office_id,id),
  add foreign key(office_id,reviewer_id) references public.office_members(office_id,user_id),
  add check(reviewer_id is null or reviewer_id<>assignee_id),
  add check(priority='normal' or char_length(btrim(priority_reason))>=3);
create index office_cases_reviewer_queue_idx on public.office_cases(office_id,reviewer_id,review_due_date,review_requested_at) where status<>'approved';
create index office_cases_matter_idx on public.office_cases(office_id,matter_id);
create index office_matters_creator_idx on public.office_matters(created_by);
create index office_cases_review_actor_idx on public.office_cases(review_activity_by);

alter table public.case_comments
  add column kind text not null default 'note' check(kind in ('question','adjustment','note')),
  add column parent_id uuid references public.case_comments(id),
  add column blocks_work boolean not null default false,
  add column addressed_at timestamptz,
  add column addressed_by uuid references auth.users(id);
create index case_comments_parent_idx on public.case_comments(parent_id);
create index case_comments_addressed_by_idx on public.case_comments(addressed_by);
create index case_comments_pending_idx on public.case_comments(case_id,kind) where resolved_at is null and parent_id is null;

create table public.case_review_rounds(
  id uuid primary key,
  case_id uuid not null references public.office_cases(id),
  round_number integer not null,
  summary text not null check(char_length(btrim(summary)) between 2 and 2000),
  attention text not null default '' check(char_length(attention)<=2000),
  submitted_by uuid not null references auth.users(id),
  reviewer_id uuid not null references auth.users(id),
  version_id uuid not null references public.case_versions(id),
  submitted_at timestamptz not null default now(),
  first_response_at timestamptz,
  completed_at timestamptz,
  outcome text check(outcome in ('changes','approved')),
  unique(case_id,round_number)
);
create index case_review_rounds_submitter_idx on public.case_review_rounds(submitted_by);
create index case_review_rounds_reviewer_idx on public.case_review_rounds(reviewer_id);
create index case_review_rounds_version_idx on public.case_review_rounds(version_id);
create table public.case_review_reads(
  case_id uuid not null references public.office_cases(id),
  user_id uuid not null references auth.users(id),
  seen_at timestamptz not null,
  primary key(case_id,user_id)
);
create index case_review_reads_user_idx on public.case_review_reads(user_id);
create table public.case_pilot_entries(
  case_id uuid primary key references public.office_cases(id),
  recorded_by uuid not null references auth.users(id),
  mode text not null check(mode in ('baseline','elojus')),
  drafting_minutes integer not null check(drafting_minutes between 0 and 100000),
  review_minutes integer not null check(review_minutes between 0 and 100000),
  external_contacts integer not null check(external_contacts between 0 and 10000),
  quality_score integer not null check(quality_score between 1 and 5),
  notes text not null default '' check(char_length(notes)<=1000),
  updated_at timestamptz not null default now()
);
create index case_pilot_entries_recorder_idx on public.case_pilot_entries(recorded_by);

create function private.matter_access(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.office_matters m where m.id=p_id and
   (private.office_role(m.office_id) in ('admin','reviewer') or exists(
     select 1 from public.office_cases c where c.matter_id=m.id and private.case_access(c.id))));
$$;
revoke all on function private.matter_access(uuid) from public,anon;
grant execute on function private.matter_access(uuid) to authenticated;
alter table public.office_matters enable row level security;
alter table public.case_review_rounds enable row level security;
alter table public.case_review_reads enable row level security;
alter table public.case_pilot_entries enable row level security;
revoke all on public.office_matters,public.case_review_rounds,public.case_review_reads,public.case_pilot_entries from public,anon,authenticated;
grant select on public.office_matters,public.case_review_rounds,public.case_review_reads,public.case_pilot_entries to authenticated;
grant all on public.office_matters,public.case_review_rounds,public.case_review_reads,public.case_pilot_entries to service_role;
create policy matters_read on public.office_matters for select to authenticated using((select private.matter_access(id)));
create policy rounds_read on public.case_review_rounds for select to authenticated using((select private.case_access(case_id)));
create policy reads_own on public.case_review_reads for select to authenticated using(user_id=(select auth.uid()) and (select private.case_access(case_id)));
create policy pilot_read on public.case_pilot_entries for select to authenticated using(
  exists(select 1 from public.office_cases c where c.id=case_id and private.office_role(c.office_id) in ('admin','reviewer')));

-- Retain the already-tested v23 core privately; clients cannot bypass v24 checks.
alter function private.workspace_command(text,jsonb) rename to workspace_command_v23;
revoke all on function private.workspace_command_v23(text,jsonb) from public,anon,authenticated;
create function private.workspace_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); oid uuid; cid uuid; actor_role text; c public.office_cases%rowtype;
 result jsonb; reviewer uuid; target uuid; mid uuid; comment_id uuid; parent public.case_comments%rowtype;
 existing_comment public.case_comments%rowtype; r public.case_review_rounds%rowtype;
 comment_kind text; summary text; aid uuid; label text; changed boolean:=false; is_manager boolean;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false))
   or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception 'session_missing' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'invalid_input';end if;
 if p_action in ('preview_invite','accept_invite') then return private.workspace_command_v23(p_action,p_data);end if;
 oid:=(p_data->>'office_id')::uuid;
 perform 1 from public.offices where id=oid for update;
 actor_role:=private.office_role(oid);is_manager:=actor_role in ('admin','reviewer');
 if actor_role is null then raise exception 'access_denied' using errcode='42501';end if;
 if p_action in ('remove_member','member_role','update_member') then
   if actor_role<>'admin' then raise exception 'access_denied' using errcode='42501';end if;
   target:=(p_data->>'user_id')::uuid;
   if (p_action='remove_member' or p_data->>'role'='collaborator') and exists(
      select 1 from public.office_cases where office_id=oid and reviewer_id=target and status<>'approved')
      then raise exception 'reassign_reviewer';end if;
 end if;
 if p_action in ('invite','register_member','renew_invite','revoke_invite','member_role','update_member','remove_member') then
   return private.workspace_command_v23(p_action,p_data);
 end if;
 cid:=case when p_action='create_case' then (p_data->>'id')::uuid else (p_data->>'case_id')::uuid end;
 select * into c from public.office_cases where id=cid for update;
 if p_action='create_case' and c.id is not null then return private.workspace_command_v23(p_action,p_data);end if;
 if p_action<>'create_case' and (c.id is null or c.office_id<>oid or not private.case_access(cid)) then
   raise exception 'access_denied' using errcode='42501';end if;

 if p_action='seen_review' then
   insert into public.case_review_reads(case_id,user_id,seen_at)
   values(cid,uid,least(coalesce((p_data->>'seen_at')::timestamptz,c.review_activity_at),c.review_activity_at,now()))
   on conflict(case_id,user_id) do update set seen_at=greatest(public.case_review_reads.seen_at,excluded.seen_at);
   return to_jsonb(c);
 end if;
 if p_action='record_pilot' then
   if not is_manager then raise exception 'access_denied' using errcode='42501';end if;
   insert into public.case_pilot_entries(case_id,recorded_by,mode,drafting_minutes,review_minutes,external_contacts,quality_score,notes)
   values(cid,uid,p_data->>'mode',(p_data->>'drafting_minutes')::int,(p_data->>'review_minutes')::int,
     (p_data->>'external_contacts')::int,(p_data->>'quality_score')::int,coalesce(p_data->>'notes',''))
   on conflict(case_id) do update set recorded_by=uid,mode=excluded.mode,drafting_minutes=excluded.drafting_minutes,
     review_minutes=excluded.review_minutes,external_contacts=excluded.external_contacts,quality_score=excluded.quality_score,
     notes=excluded.notes,updated_at=now();
   return to_jsonb(c);
 end if;
 if p_action in ('create_case','assign') then
   target:=coalesce((p_data->>'assignee_id')::uuid,uid);
   if not is_manager and (p_action='assign' or target<>uid) then raise exception 'access_denied' using errcode='42501';end if;
   reviewer:=case when p_data?'reviewer_id' then nullif(p_data->>'reviewer_id','')::uuid else c.reviewer_id end;
   if reviewer is not null and (reviewer=target or not exists(select 1 from public.office_members where office_id=oid and user_id=reviewer and removed_at is null and role in ('admin','reviewer'))) then raise exception 'invalid_reviewer';end if;
   if coalesce(p_data->>'priority',c.priority,'normal') not in ('normal','high') then raise exception 'invalid_priority';end if;
   if coalesce(p_data->>'priority',c.priority)='high' and (not is_manager or char_length(btrim(coalesce(p_data->>'priority_reason',c.priority_reason,'')))<3) then raise exception 'invalid_priority';end if;
   mid:=case when p_data?'matter_id' then nullif(p_data->>'matter_id','')::uuid else c.matter_id end;
   if mid is not null and not exists(select 1 from public.office_matters where id=mid and office_id=oid and private.matter_access(id)) then raise exception 'access_denied' using errcode='42501';end if;
   if nullif(btrim(p_data->>'matter_name'),'') is not null then
     if mid is not null then raise exception 'invalid_input';end if;
     insert into public.office_matters(office_id,name,created_by) values(oid,btrim(p_data->>'matter_name'),uid) returning id into mid;
   end if;
   if p_action='assign' and c.reviewer_id=target then update public.office_cases set reviewer_id=null where id=cid;end if;
   result:=private.workspace_command_v23(p_action,p_data);
   update public.office_cases set reviewer_id=reviewer,matter_id=mid,
     review_due_date=case when p_data?'review_due_date' then nullif(p_data->>'review_due_date','')::date else review_due_date end,
     priority=coalesce(p_data->>'priority',priority),priority_reason=coalesce(p_data->>'priority_reason',priority_reason),
     review_activity_at=now(),review_activity_by=uid where id=cid returning * into c;
   return to_jsonb(c);
 end if;
 if c.status='approved' then raise exception 'case_approved';end if;
 if p_action='return' and uid=c.assignee_id then raise exception 'self_approval';end if;
 if p_action in ('approve','return','resolve_comment') and
   (not is_manager or (actor_role<>'admin' and c.reviewer_id is not null and c.reviewer_id<>uid))
   then raise exception 'not_designated_reviewer' using errcode='42501';end if;

 if p_action='submit' then
   aid:=(p_data->>'delivery_id')::uuid;summary:=btrim(p_data->>'summary');
   if aid is null or summary is null or char_length(summary) not between 2 and 2000 then raise exception 'delivery_summary_required';end if;
   select * into r from public.case_review_rounds where id=aid;
   if r.id is not null then
     if r.case_id=cid and r.submitted_by=uid and r.summary=summary and r.attention=coalesce(p_data->>'attention','') then return to_jsonb(c);end if;
     raise exception 'access_denied' using errcode='42501';
   end if;
   if c.reviewer_id is null or c.reviewer_id=c.assignee_id or not exists(select 1 from public.office_members where office_id=oid and user_id=c.reviewer_id and removed_at is null and role in ('admin','reviewer')) then raise exception 'reviewer_required';end if;
   result:=private.workspace_command_v23(p_action,p_data);
   insert into public.case_review_rounds(id,case_id,round_number,summary,attention,submitted_by,reviewer_id,version_id)
   values(aid,cid,(select count(*)+1 from public.case_review_rounds where case_id=cid),summary,coalesce(p_data->>'attention',''),uid,c.reviewer_id,
     (select v.id from public.case_versions v where v.case_id=cid and v.revision=c.revision and v.label='Minuta enviada para revisão.' order by v.created_at desc,v.id desc limit 1));
   update public.office_cases set review_requested_at=now() where id=cid;
   changed:=true;
 elsif p_action='comment' then
   comment_id:=coalesce((p_data->>'id')::uuid,gen_random_uuid());comment_kind:=coalesce(p_data->>'kind','note');
   if comment_kind not in ('question','adjustment','note') or (comment_kind='adjustment' and not is_manager) then raise exception 'invalid_comment_kind';end if;
   select * into existing_comment from public.case_comments where id=comment_id;
   if existing_comment.id is not null and
     (existing_comment.kind<>comment_kind or existing_comment.parent_id is not null or existing_comment.blocks_work<>(comment_kind='question' and coalesce((p_data->>'blocks_work')::boolean,false)))
     then raise exception 'access_denied' using errcode='42501';end if;
   result:=private.workspace_command_v23(p_action,p_data||jsonb_build_object('id',comment_id));
   update public.case_comments set kind=comment_kind,blocks_work=comment_kind='question' and coalesce((p_data->>'blocks_work')::boolean,false) where id=comment_id;
   changed:=existing_comment.id is null;
 elsif p_action='reply_comment' then
   select * into parent from public.case_comments where id=(p_data->>'parent_id')::uuid and case_id=cid and parent_id is null for update;
   if parent.id is null then raise exception 'comment_missing';end if;
   comment_id:=(p_data->>'id')::uuid;
   if comment_id is null then raise exception 'invalid_input';end if;
   select * into existing_comment from public.case_comments where id=comment_id;
   if existing_comment.id is not null then
     if existing_comment.case_id=cid and existing_comment.parent_id=parent.id and existing_comment.author_id=uid and existing_comment.body=btrim(p_data->>'body') then return to_jsonb(c);end if;
     raise exception 'access_denied' using errcode='42501';
   end if;
   insert into public.case_comments(id,case_id,author_id,body,quote,document_revision,parent_id)
   values(comment_id,cid,uid,btrim(p_data->>'body'),'',c.revision,parent.id);
   if coalesce((p_data->>'resolve')::boolean,false) then
     if not is_manager or (actor_role<>'admin' and c.reviewer_id is not null and c.reviewer_id<>uid) then raise exception 'not_designated_reviewer' using errcode='42501';end if;
     update public.case_comments set resolved_at=now(),resolved_by=uid where id=parent.id;
   end if;
   label:='Resposta adicionada à conversa.';changed:=true;
 elsif p_action='address_comment' then
   if uid<>c.assignee_id or c.status not in ('working','changes') then raise exception 'access_denied' using errcode='42501';end if;
   update public.case_comments set addressed_at=case when coalesce((p_data->>'addressed')::boolean,false) then now() end,
     addressed_by=case when coalesce((p_data->>'addressed')::boolean,false) then uid end
   where id=(p_data->>'id')::uuid and case_id=cid and parent_id is null and kind='adjustment' and resolved_at is null;
   if not found then raise exception 'comment_missing';end if;
   label:='Atendimento de ajuste indicado pelo autor.';changed:=true;
 else
   result:=private.workspace_command_v23(p_action,p_data);
   changed:=p_action in ('resolve_comment','return','approve','version');
 end if;
 if changed and is_manager and uid<>c.assignee_id and p_action in ('comment','reply_comment','resolve_comment','return','approve') then
   update public.case_review_rounds set first_response_at=coalesce(first_response_at,now()),
     completed_at=case when p_action in ('return','approve') then now() else completed_at end,
     outcome=case when p_action='return' then 'changes' when p_action='approve' then 'approved' else outcome end
   where case_id=cid and completed_at is null;
 end if;
 if label is not null then insert into public.office_activity(office_id,case_id,actor_id,action) values(oid,cid,uid,label);end if;
 if changed then update public.office_cases set review_activity_at=now(),review_activity_by=uid where id=cid;end if;
 select * into c from public.office_cases where id=cid;
 return to_jsonb(c);
end;$$;
revoke all on function private.workspace_command(text,jsonb) from public,anon;
grant execute on function private.workspace_command(text,jsonb) to authenticated;
create or replace function public.workspace_command(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.workspace_command(p_action,p_data); $$;

create function public.review_signals(p_office_id uuid) returns table(
 case_id uuid,questions bigint,blocked_questions bigint,adjustments bigint,addressed bigint,unread boolean
) language sql stable security invoker set search_path='' as $$
 select c.id,
   count(x.id) filter(where x.kind='question'),
   count(x.id) filter(where x.kind='question' and x.blocks_work),
   count(x.id) filter(where x.kind='adjustment'),
   count(x.id) filter(where x.kind='adjustment' and x.addressed_at is not null),
   coalesce(c.review_activity_by<>(select auth.uid()) and c.review_activity_at>coalesce(rd.seen_at,'-infinity'::timestamptz),false)
 from public.office_cases c
 left join public.case_comments x on x.case_id=c.id and x.parent_id is null and x.resolved_at is null
 left join public.case_review_reads rd on rd.case_id=c.id and rd.user_id=(select auth.uid())
 where c.office_id=p_office_id
 group by c.id,rd.seen_at;
$$;
revoke all on function public.review_signals(uuid) from public,anon;
grant execute on function public.review_signals(uuid) to authenticated;
create or replace function public.workspace_capabilities() returns jsonb
language sql stable security invoker set search_path='' as $$ select '{"version":24}'::jsonb; $$;
