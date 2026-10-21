-- Cover composite references added by v25; no content or permissions are changed.
create index office_cases_primary_file_ref_idx on public.office_cases(id,primary_attachment_id);
create index case_versions_file_ref_idx on public.case_versions(case_id,attachment_id);
create index case_review_rounds_file_ref_idx on public.case_review_rounds(case_id,attachment_id);
create index case_comments_file_ref_idx on public.case_comments(case_id,reference_attachment_id);
drop index public.office_cases_primary_attachment_idx;
drop index public.case_versions_attachment_idx;
drop index public.case_review_rounds_attachment_idx;
drop index public.case_comments_reference_file_idx;
