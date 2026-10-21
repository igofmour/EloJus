-- v24 integration checks. Disposable identities and office; always ROLLBACK.
-- Does not insert/update/delete storage.objects or touch existing office records.
begin;
create temp table qa_people(k text primary key,id uuid default gen_random_uuid(),email text) on commit drop;
insert into qa_people(k,email) values
 ('admin','review-admin@example.invalid'),('reviewer','review-lawyer@example.invalid'),
 ('intern','review-intern@example.invalid'),('other','review-other@example.invalid'),('outside','review-outside@example.invalid');
insert into auth.users(id,email,email_confirmed_at,is_anonymous) select id,email,now(),false from qa_people;
create temp table qa_data(k text primary key,data jsonb) on commit drop;
create temp table qa_results(test text,passed boolean) on commit drop;
grant select on qa_people to authenticated,anon;
grant all on qa_data,qa_results to authenticated,anon;
create function pg_temp.as_user(k text) returns void language sql as $$
 select set_config('request.jwt.claims',jsonb_build_object('sub',id,'email',email,'role','authenticated','is_anonymous',false)::text,true)
 from qa_people where qa_people.k=as_user.k;
$$;
create function pg_temp.check_result(label text,ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label;end if;
 insert into qa_results values(label,true);end;$$;
create function pg_temp.cmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.workspace_command(action,jsonb_build_object('office_id',(select data->>'id' from qa_data where k='office'))||extra);
$$;
create function pg_temp.piece() returns jsonb language sql as $$
 select jsonb_build_object('case_id',id,'revision',revision) from public.office_cases
 where id=(select (data->>'id')::uuid from qa_data where k='piece');
$$;
create function pg_temp.denied(label text,action text,extra jsonb,expected text) returns void language plpgsql as $$
begin begin perform pg_temp.cmd(action,extra);
 exception when others then
 if sqlerrm=expected or sqlstate=expected then perform pg_temp.check_result(label,true);return;else raise;end if;
 end;raise exception 'FAILED allowed: %',label;end;$$;
create function pg_temp.filecmd(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.attachment_command(action,jsonb_build_object(
 'office_id',(select data->>'id' from qa_data where k='office'),
 'case_id',(select data->>'id' from qa_data where k='piece'),
 'id',(select data->>'id' from qa_data where k='file'))||extra);
$$;
select pg_temp.as_user('admin');
with o as(insert into public.offices(name,responsible_user_id,responsible_name,responsible_email,oab_number,oab_state)
 select 'QA v24 descartável',id,'QA Admin',email,'1234','SP' from qa_people where k='admin' returning *)
insert into qa_data select 'office',to_jsonb(o) from o;
insert into public.office_members(office_id,user_id,role,display_name,email,professional_type,oab_number,oab_state)
select (select (data->>'id')::uuid from qa_data where k='office'),id,
 case when k='reviewer' then 'reviewer' else 'collaborator' end,k,email,
 case when k='reviewer' then 'lawyer' else 'intern' end,
 case when k='reviewer' then '5678' end,case when k='reviewer' then 'SP' end
from qa_people where k in ('reviewer','intern','other');
set local role authenticated;
select pg_temp.as_user('intern');
insert into qa_data select 'piece',pg_temp.cmd('create_case',jsonb_build_object(
 'id',gen_random_uuid(),'title','Peça QA v24','client_name','Fictício',
 'reviewer_id',(select id from qa_people where k='admin'),'matter_name','Caso QA v24'));
select pg_temp.check_result('estagiário cria peça atribuída a si',(select assignee_id=auth.uid() and created_by=auth.uid() from public.office_cases));
select pg_temp.check_result('revisor e caso relacionado persistem',(select reviewer_id=(select id from qa_people where k='admin') and matter_id is not null from public.office_cases));
select pg_temp.check_result('repetir criação não duplica peça',pg_temp.cmd('create_case',jsonb_build_object('id',(select data->>'id' from qa_data where k='piece')))->>'id'=(select data->>'id' from qa_data where k='piece'));
insert into qa_data select 'second',pg_temp.cmd('create_case',jsonb_build_object(
 'id',gen_random_uuid(),'title','Segunda peça QA','client_name','Fictício',
 'reviewer_id',(select id from qa_people where k='admin'),'matter_id',(select data->>'matter_id' from qa_data where k='piece')));
select pg_temp.check_result('duas peças compartilham o caso',(select count(*)=2 from public.office_cases where matter_id=(select (data->>'matter_id')::uuid from qa_data where k='piece')));
select pg_temp.as_user('other');
select pg_temp.check_result('outro estagiário não vê peças ou caso',(select count(*)=0 from public.office_cases) and (select count(*)=0 from public.office_matters));
select pg_temp.denied('não pode vincular caso inacessível','create_case',jsonb_build_object('id',gen_random_uuid(),'title','Negado','client_name','QA','matter_id',(select data->>'matter_id' from qa_data where k='piece')),'42501');
select pg_temp.denied('não pode comentar peça de colega','comment',jsonb_build_object('case_id',(select data->>'id' from qa_data where k='piece'),'body','Negado'),'42501');
select pg_temp.as_user('intern');
select pg_temp.denied('estagiário não eleva prioridade','create_case',jsonb_build_object('id',gen_random_uuid(),'title','Negado','client_name','QA','priority','high','priority_reason','Teste'),'invalid_priority');
select pg_temp.denied('estagiário não registra ajuste de revisor','comment',pg_temp.piece()||'{"kind":"adjustment","body":"Negado"}','invalid_comment_kind');
insert into qa_data values('question',jsonb_build_object('id',gen_random_uuid(),'kind','question','body','Qual documento usar?','blocks_work',true));
select pg_temp.cmd('comment',pg_temp.piece()||(select data from qa_data where k='question'));
select pg_temp.cmd('comment',pg_temp.piece()||(select data from qa_data where k='question'));
select pg_temp.check_result('comentário idempotente e independente da revisão',(select count(*)=1 from public.case_comments) and (select revision=1 from public.office_cases where id=(select (data->>'id')::uuid from qa_data where k='piece')));
insert into qa_data values('file',jsonb_build_object('id',gen_random_uuid()));
update qa_data set data=pg_temp.filecmd('prepare','{"name":"Apoio fictício.txt","size":73}') where k='file';
select pg_temp.check_result('reserva de anexo é privada e vinculada',(select uploaded_at is null and uploaded_by=auth.uid() and case_id=(select (data->>'id')::uuid from qa_data where k='piece') from public.case_attachments));
select pg_temp.check_result('autor pode enviar objeto reservado',private.attachment_access((select data->>'object_path' from qa_data where k='file'),true));
select pg_temp.check_result('reserva repetida usa o mesmo identificador',pg_temp.filecmd('prepare','{"name":"Apoio fictício.txt","size":73}')->>'id'=(select data->>'id' from qa_data where k='file'));
do $$begin begin perform pg_temp.filecmd('complete');raise exception 'FAILED missing file';
 exception when others then if sqlerrm='attachment_pending' then perform pg_temp.check_result('conclusão exige arquivo recebido',true);else raise;end if;end;end;$$;
select pg_temp.as_user('other');
select pg_temp.check_result('outro estagiário não lê metadados do anexo',(select count(*)=0 from public.case_attachments));
select pg_temp.check_result('outro estagiário não lê nem envia arquivo',
 not private.attachment_access((select data->>'object_path' from qa_data where k='file'),false)
 and not private.attachment_access((select data->>'object_path' from qa_data where k='file'),true));
select pg_temp.as_user('admin');
select pg_temp.check_result('revisor pode ler mas não substituir reserva do autor',
 private.attachment_access((select data->>'object_path' from qa_data where k='file'),false)
 and not private.attachment_access((select data->>'object_path' from qa_data where k='file'),true));
select pg_temp.check_result('dúvida pendente e atualização aparecem na fila',
 (select questions=1 and blocked_questions=1 and unread from public.review_signals((select (data->>'id')::uuid from qa_data where k='office')) where case_id=(select (data->>'id')::uuid from qa_data where k='piece')));
select pg_temp.cmd('seen_review',pg_temp.piece());
select pg_temp.check_result('leitura limpa somente atualização da própria conta',
 (select not unread from public.review_signals((select (data->>'id')::uuid from qa_data where k='office')) where case_id=(select (data->>'id')::uuid from qa_data where k='piece')));
insert into qa_data values('reply',jsonb_build_object('id',gen_random_uuid(),'parent_id',(select data->>'id' from qa_data where k='question'),'body','Use o documento atualizado.','resolve',true));
select pg_temp.cmd('reply_comment',pg_temp.piece()||(select data from qa_data where k='reply'));
select pg_temp.cmd('reply_comment',pg_temp.piece()||(select data from qa_data where k='reply'));
select pg_temp.check_result('resposta idempotente permanece no assunto',(select count(*)=1 from public.case_comments where parent_id=(select (data->>'id')::uuid from qa_data where k='question')));
select pg_temp.check_result('resposta resolvida retira dúvida da fila',
 (select questions=0 from public.review_signals((select (data->>'id')::uuid from qa_data where k='office')) where case_id=(select (data->>'id')::uuid from qa_data where k='piece')));
insert into qa_data values('adjustment',jsonb_build_object('id',gen_random_uuid(),'kind','adjustment','body','Confira a conclusão.','blocking',true));
select pg_temp.cmd('comment',pg_temp.piece()||(select data from qa_data where k='adjustment'));
select pg_temp.as_user('intern');
select pg_temp.cmd('save_case',pg_temp.piece()||jsonb_build_object('document',jsonb_build_object('ops',jsonb_build_array(jsonb_build_object('insert',E'Minuta fictícia para revisar.\n')))));
select pg_temp.denied('envio exige resumo','submit',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid()),'delivery_summary_required');
insert into qa_data values('delivery',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid(),'summary','Primeira entrega fictícia.','attention','Conferir conclusão.'));
select pg_temp.cmd('submit',(select data from qa_data where k='delivery'));
select pg_temp.cmd('submit',(select data from qa_data where k='delivery'));
select pg_temp.check_result('envio repetido preserva uma rodada',(select count(*)=1 from public.case_review_rounds));
select pg_temp.check_result('rodada aponta para versão enviada',(select v.document->'ops'->0->>'insert'=E'Minuta fictícia para revisar.\n' from public.case_review_rounds r join public.case_versions v on v.id=r.version_id));
select pg_temp.denied('estagiário não edita durante revisão','save_case',pg_temp.piece()||'{"document":{"ops":[{"insert":"Negado\n"}]}}','read_only');
select pg_temp.check_result('estagiário não envia anexos durante revisão',not private.attachment_access((select data->>'object_path' from qa_data where k='file'),true));
select pg_temp.as_user('reviewer');
select pg_temp.denied('outro revisor não aprova decisão atribuída','approve',pg_temp.piece(),'42501');
select pg_temp.as_user('admin');
select pg_temp.denied('ajuste impeditivo bloqueia aprovação','approve',pg_temp.piece(),'pending_comments');
select pg_temp.cmd('return',pg_temp.piece());
select pg_temp.check_result('devolução registra retorno e resultado',(select first_response_at is not null and completed_at is not null and outcome='changes' from public.case_review_rounds));
select pg_temp.as_user('intern');
select pg_temp.cmd('save_case',pg_temp.piece()||'{"document":{"ops":[{"insert":"Minuta com conclusão corrigida.\n"}]}}');
select pg_temp.cmd('address_comment',pg_temp.piece()||jsonb_build_object('id',(select data->>'id' from qa_data where k='adjustment'),'addressed',true));
select pg_temp.check_result('atendido não significa resolvido',(select addressed_at is not null and resolved_at is null from public.case_comments where id=(select (data->>'id')::uuid from qa_data where k='adjustment')));
select pg_temp.cmd('submit',pg_temp.piece()||jsonb_build_object('delivery_id',gen_random_uuid(),'summary','Conclusão corrigida conforme orientação.'));
select pg_temp.as_user('admin');
select pg_temp.denied('atendimento ainda exige conferência','approve',pg_temp.piece(),'pending_comments');
select pg_temp.cmd('resolve_comment',pg_temp.piece()||jsonb_build_object('id',(select data->>'id' from qa_data where k='adjustment'),'resolved',true));
select pg_temp.cmd('approve',pg_temp.piece());
select pg_temp.check_result('aprovação final deixa peça em leitura',(select status='approved' from public.office_cases where id=(select (data->>'id')::uuid from qa_data where k='piece')));
select pg_temp.check_result('duas rodadas preservadas com resultados distintos',(select count(*)=2 and count(distinct version_id)=2 and count(distinct outcome)=2 from public.case_review_rounds));
select pg_temp.denied('peça aprovada não recebe edição','save_case',pg_temp.piece()||'{"document":{"ops":[{"insert":"Negado\n"}]}}','case_approved');
select pg_temp.check_result('aprovação bloqueia envio de anexo',not private.attachment_access((select data->>'object_path' from qa_data where k='file'),true));
select pg_temp.cmd('record_pilot',pg_temp.piece()||'{"mode":"elojus","drafting_minutes":30,"review_minutes":10,"external_contacts":1,"quality_score":4,"notes":"Dados fictícios, transação desfeita."}');
select pg_temp.check_result('indicadores manuais persistem no teste',(select review_minutes=10 from public.case_pilot_entries));
select pg_temp.as_user('intern');
select pg_temp.check_result('observações gerenciais não aparecem ao estagiário',(select count(*)=0 from public.case_pilot_entries));
select pg_temp.denied('estagiário não altera indicadores','record_pilot',pg_temp.piece(),'42501');
do $$begin begin perform private.workspace_command_v23('submit','{}');raise exception 'FAILED bypass';
 exception when insufficient_privilege then perform pg_temp.check_result('núcleo antigo não permite contornar revisão',true);end;end;$$;
select pg_temp.as_user('admin');
select pg_temp.denied('não atribui revisão ao próprio autor','create_case',jsonb_build_object('id',gen_random_uuid(),'title','Negado','client_name','QA','reviewer_id',auth.uid()),'invalid_reviewer');
-- Reassign the remaining open piece before revoking membership.
select pg_temp.cmd('assign',pg_temp.piece()||jsonb_build_object('case_id',(select data->>'id' from qa_data where k='second'),'revision',1,'title','Segunda peça QA','client_name','Fictício','assignee_id',(select id from qa_people where k='other')));
select pg_temp.cmd('remove_member',jsonb_build_object('user_id',(select id from qa_people where k='intern')));
select pg_temp.as_user('intern');
select pg_temp.check_result('revogação retira acesso a peças, casos, rodadas e anexos',
 (select count(*)=0 from public.office_cases) and (select count(*)=0 from public.office_matters)
 and (select count(*)=0 from public.case_review_rounds) and (select count(*)=0 from public.case_attachments));
select pg_temp.check_result('revogação retira acesso aos arquivos',not private.attachment_access((select data->>'object_path' from qa_data where k='file'),false));
select pg_temp.as_user('outside');
select pg_temp.check_result('outro escritório não recebe sinais',(select count(*)=0 from public.review_signals((select (data->>'id')::uuid from qa_data where k='office'))));
select pg_temp.check_result('outro usuário não lê objetos privados existentes',(select count(*)=0 from storage.objects where bucket_id='case-documents'));
reset role;
set local role anon;
do $$begin begin perform * from public.case_review_rounds;raise exception 'FAILED anon';
 exception when insufficient_privilege then perform pg_temp.check_result('anônimo não lê rodadas',true);end;end;$$;
reset role;
select jsonb_build_object('passed',(select count(*) from qa_results),'checks',(select jsonb_agg(test) from qa_results),'fixtures','rolled back','storage_objects_modified',false) as result;
rollback;
