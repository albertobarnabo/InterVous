-- Functional test of the v2 migration: import adoption, web edits surviving a re-push,
-- events moving the phase, the old UI, and the read model. Every check is an assertion:
-- any mismatch raises and fails scripts/test-sql.sh. Works for every setup.sql variant
-- (dates are compared via left(application_date::text, 10), so text/date/timestamptz all pass).
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f54bff0b-9aa2-4e54-b93b-b81bfb671f70', true);
select set_config('request.jwt.claims', '{"sub":"f54bff0b-9aa2-4e54-b93b-b81bfb671f70","role":"authenticated"}', true);

create temp table _expect(ok boolean, what text) on commit drop;
create or replace function pg_temp.check(ok boolean, what text) returns void language sql as $$
  insert into _expect values (coalesce(ok, false), what) $$;
create or replace function pg_temp.d(v anyelement) returns text language sql as $$ select left(v::text, 10) $$;

-- 0. backfill of the pre-existing rows
select pg_temp.check(phase = 'rejected' and uncertain = '{phase}' and applied_on = '2025-10-19', 'legacy Inactive row 91 -> rejected, phase uncertain')
  from jobs where id = 91;
select pg_temp.check(phase = 'applied' and applied_on = '2026-04-21', 'legacy Active row 121 -> applied') from jobs where id = 121;
select pg_temp.check(phase = 'interviewing', 'Video Interview row 128 -> interviewing') from jobs where id = 128;

-- A. import: adopt by explicit job_id (empty URL rows), draft fix
select public.iv_upsert_application($j${"slug":"ai-futures-senior-ai-product-engineer-frankfurt","job_id":133,"source":"import",
 "company":"Unnamed Frankfurt wealth & asset manager (via AI Futures)","company_create":false,"role":"Senior AI Product Engineer",
 "phase":"draft","applied_on":null,"cv_built_on":"2026-09-15","uncertain":["phase"],"channel":"recruiter",
 "requirements":[{"requirement":"Terraform","verdict":"gap","topic":"terraform","gap_state":"no_longer_true"},
                 {"requirement":"Senior (5+ yrs)","verdict":"gap","topic":"years_experience"}],
 "events":[{"kind":"cv_built","on":"2026-09-15","title":"CV built for Kyle"}]}$j$::jsonb) as r \gset a_
select pg_temp.check((:'a_r'::jsonb->>'adopted')::boolean and (:'a_r'::jsonb->>'id')::int = 133, 'AI Futures adopted by job_id');
select public.iv_upsert_application($j${"slug":"ecb-tin-ssm-governance-operations","job_id":134,"source":"import","company":"european central bank",
 "role":"Internal move: SSM Governance","phase":"applied","applied_on":null,"uncertain":["phase","applied_on"]}$j$::jsonb);
-- B. import: adopt by URL with query string, draft fix
select public.iv_upsert_application($j${"slug":"mistral-applied-ai-fde-london","url":"https://jobs.lever.co/mistral/fde","source":"import",
 "company":"Mistral AI","role":"Applied AI, FDE","phase":"draft","applied_on":null,"cv_built_on":"2026-10-11",
 "answers":[{"question":"Why Mistral?","answer":null,"source_path":"chat 2026-10-11"}],
 "proof_points":[{"key":"ecb-eba-parser","name":"EBA regulation parser","metric_status":"needs_care","facts":{"exact_match":"73.8%"},"detail":"300+ cases, 93%"}]}$j$::jsonb);
select public.iv_upsert_application($j${"slug":"openai-codex-core-agent","url":"https://jobs.ashbyhq.com/openai/577e/","source":"import","company":"OpenAI",
 "role":"Applied AI Engineer, Codex Core Agent","phase":"applied","applied_on":"2026-08-30",
 "events":[{"kind":"cv_built","on":"2026-08-30"},{"kind":"applied","on":"2026-08-30"}]}$j$::jsonb);
select public.iv_upsert_application($j${"slug":"apple-developer-publications","job_id":128,"source":"import","company":"Apple","role":"Applied ML Engineer",
 "phase":"interviewing","applied_on":"2026-08-30","events":[{"kind":"applied","on":"2026-08-30"},{"kind":"interview_scheduled","on":"2026-09-03","title":"Round 1 (Webex)"}]}$j$::jsonb);
-- C. import: new skipped row
select public.iv_upsert_application($j${"slug":"ecb-14896-assistant-reserve-list","source":"import","company":"European Central Bank","role":"Assistant reserve list","phase":"skipped","cv_built_on":"2026-09-08"}$j$::jsonb);
select id, slug, phase, status, stage, application_date, applied_on, uncertain, source, company_id is not null linked from jobs order by id;

select pg_temp.check(phase = 'draft' and status = 'Not Applied' and stage = '-' and application_date is null and applied_on is null
                     and uncertain = '{phase}' and company_id is null and source = 'import' and channel = 'recruiter',
                     'AI Futures: draft, Not Applied, -, no date, company_create:false left company_id null')
  from jobs where id = 133;
select pg_temp.check(phase = 'applied' and application_date is null and applied_on is null and uncertain = '{phase,applied_on}'
                     and company_name = 'European Central Bank' and company_id is not null,
                     'ECB TIN: applied, NULL date, uncertain {phase,applied_on}, company matched case-insensitively')
  from jobs where id = 134;
select pg_temp.check(slug = 'mistral-applied-ai-fde-london' and phase = 'draft' and application_date is null,
                     'Mistral FDE adopted by URL despite ?query on the stored URL') from jobs where id = 140;
select pg_temp.check(slug = 'openai-codex-core-agent' and phase = 'applied' and pg_temp.d(application_date) = '2026-08-30',
                     'OpenAI adopted by URL despite a trailing slash; legacy date mirrors applied_on') from jobs where id = 127;
select pg_temp.check(id > 200 and phase = 'skipped' and status = 'Not Applied' and company_id is not null,
                     'new skipped ECB row created and linked') from jobs where slug = 'ecb-14896-assistant-reserve-list';
select pg_temp.check(count(*) = 1, 'no duplicate ECB company') from companies where lower(name) = 'european central bank';
select pg_temp.check(count(*) = 0, 'no company created for AI Futures') from companies where name ilike '%AI Futures%';
select pg_temp.check(count(*) = 0, 'import produced zero phase_change events') from job_events where kind = 'phase_change';
select pg_temp.check(count(*) = 1 and bool_and(p.metric_status = 'needs_care') and bool_and(jp.detail = '300+ cases, 93%'),
                     'proof point created and linked with per-application wording')
  from proof_points p join job_proof_points jp on jp.proof_point_id = p.id where jp.job_id = 140;

-- D. web edits gap_state + answer, then CLI re-push without them: survive
update job_requirements set gap_state='worded_around' where topic='years_experience';
update job_answers set answer='Typed in the browser' where question='Why Mistral?';
select public.iv_upsert_application($j${"slug":"ai-futures-senior-ai-product-engineer-frankfurt","requirements":[{"requirement":"Terraform","verdict":"gap","topic":"terraform"},{"requirement":"senior (5+ yrs)","verdict":"gap","topic":"years_experience"},{"requirement":"Kafka","verdict":"gap","topic":"kafka"}]}$j$::jsonb);
select public.iv_upsert_application($j${"slug":"mistral-applied-ai-fde-london","answers":[{"question":"Why Mistral?","char_limit":1000}]}$j$::jsonb);
select requirement, gap_state from job_requirements order by position;
select question, answer, char_limit from job_answers;
select pg_temp.check(string_agg(requirement || '=' || gap_state, ',' order by position)
                     = 'Terraform=no_longer_true,senior (5+ yrs)=worded_around,Kafka=open',
                     'gap states survive a re-push (matched case-insensitively), new gap is open')
  from job_requirements where job_id = 133;
select pg_temp.check(answer = 'Typed in the browser' and char_limit = 1000, 'web-edited answer survives a re-push')
  from job_answers where job_id = 140;
select pg_temp.check(role = 'Senior AI Product Engineer' and phase = 'draft', 're-push without role/phase keeps them') from jobs where id = 133;

-- E. CLI day-to-day: new draft, then events move phase
select public.iv_upsert_application($j${"slug":"nvidia-applied-ai-munich","company":"NVIDIA","role":"Senior SWE, Applied AI","phase":"draft","cv_built_on":"2026-10-17",
 "documents":[{"kind":"cv_pdf","storage_path":"f54bff0b-9aa2-4e54-b93b-b81bfb671f70/nvidia-applied-ai-munich/cv_pdf/abc-cv.pdf","sha256":"abc","mime_type":"application/pdf"},
              {"kind":"jd_snapshot","content":"# JD","source_url":"https://x"}]}$j$::jsonb) as r \gset e_
select pg_temp.check((:'e_r'::jsonb->>'created')::boolean and (:'e_r'::jsonb->>'company_created')::boolean, 'NVIDIA job and company created');
-- documents are de-duplicated by (job, kind, sha256)
select public.iv_upsert_application($j${"slug":"nvidia-applied-ai-munich","documents":[{"kind":"cv_pdf","storage_path":"f54bff0b-9aa2-4e54-b93b-b81bfb671f70/nvidia-applied-ai-munich/cv_pdf/abc-cv.pdf","sha256":"abc","label":"v1"}]}$j$::jsonb);
select pg_temp.check(count(*) = 2, 'documents de-duplicated on re-push') from job_documents d join jobs j on j.id = d.job_id where j.slug = 'nvidia-applied-ai-munich';
insert into job_events(job_id, kind, occurred_on, source) select id,'applied','2026-10-18','cli' from jobs where slug='nvidia-applied-ai-munich';
insert into job_events(job_id, kind, occurred_on) select id,'reply','2026-10-22' from jobs where slug='nvidia-applied-ai-munich';
insert into job_events(job_id, kind, occurred_on) select id,'auto_ack','2026-10-18' from jobs where slug='nvidia-applied-ai-munich';
-- move via phase_change event (CLI "move"): no duplicate auto event
insert into job_events(job_id, kind, to_phase, occurred_on, source) select id,'phase_change','no_reply','2026-10-17','cli' from jobs where slug='openai-codex-core-agent';
-- F. legacy UI writes (kanban drag, edit form resaving same values, date edit, plain insert)
update jobs set stage='Final Round' where id=121;
update jobs set company_name=company_name, role=role, location='Paris', application_date=application_date, status=status, stage=stage, url=url where id=128;
update jobs set application_date='2025-10-20' where id=91;
insert into jobs(user_id, company_name, role, location, application_date, status, stage, url)
values ('f54bff0b-9aa2-4e54-b93b-b81bfb671f70', 'Old UI Co', 'Engineer', 'Berlin', '2026-10-01', 'Active', 'Screening', 'https://old.example/1');
select id, slug, phase, status, stage, application_date, applied_on, last_activity_at::date from jobs where id in (121,128) or slug in ('nvidia-applied-ai-munich','openai-codex-core-agent') order by id;
select j.slug, e.kind, e.direction, e.from_phase, e.to_phase, e.occurred_on, e.source from job_events e join jobs j on j.id=e.job_id where j.id in (121,127) or j.slug like 'nvidia%' order by e.id;
select slug, phase, first_response_on, last_event_on, open_gaps, unsaved_answers, has_cv, has_jd from job_overview where slug is not null order by id;

select pg_temp.check(phase = 'screening' and applied_on = '2026-10-18' and pg_temp.d(application_date) = '2026-10-18'
                     and status = 'Active' and last_activity_at <= now(),
                     'NVIDIA: applied then reply -> screening; last_activity_at never in the future')
  from jobs where slug = 'nvidia-applied-ai-munich';
select pg_temp.check(string_agg(e.kind || ':' || e.direction || ':' || coalesce(e.from_phase, '') || '>' || coalesce(e.to_phase, ''), ',' order by e.id)
                     = 'applied:out:draft>applied,reply:in:applied>screening,auto_ack:in:>',
                     'NVIDIA events: directions and phase moves inferred')
  from job_events e join jobs j on j.id = e.job_id where j.slug = 'nvidia-applied-ai-munich';
select pg_temp.check(phase = 'no_reply' and status = 'Inactive', 'OpenAI moved to no_reply by a phase_change event') from jobs where id = 127;
select pg_temp.check(count(*) = 1 and bool_and(source = 'cli'), 'CLI phase_change produced no duplicate auto event')
  from job_events where job_id = 127 and kind = 'phase_change';
select pg_temp.check(phase = 'interviewing' and stage = 'Final Round' and status = 'Active', 'Kanban drag to Final Round -> interviewing')
  from jobs where id = 121;
select pg_temp.check(count(*) = 1 and bool_and(source = 'auto' and from_phase = 'applied' and to_phase = 'interviewing'),
                     'Kanban drag logged exactly one automatic phase_change')
  from job_events where job_id = 121 and kind = 'phase_change';
select pg_temp.check(phase = 'interviewing' and location = 'Paris', 'edit form resave left the phase alone') from jobs where id = 128;
select pg_temp.check(count(*) = 0, 'edit form resave logged no phase_change') from job_events where job_id = 128 and kind = 'phase_change';
select pg_temp.check(applied_on = '2025-10-20' and pg_temp.d(application_date) = '2025-10-20', 'old UI date edit moves applied_on')
  from jobs where id = 91;
select pg_temp.check(phase = 'applied' and applied_on = '2026-10-01' and source = 'web' and created_at is not null,
                     'old UI insert derives phase and applied_on')
  from jobs where company_name = 'Old UI Co';
select pg_temp.check(first_response_on = '2026-10-22' and has_cv and has_jd and open_gaps = 0,
                     'overview: auto_ack is not a response; has_cv/has_jd')
  from job_overview where slug = 'nvidia-applied-ai-munich';
select pg_temp.check(open_gaps = 2, 'overview: no_longer_true gaps are not open')
  from job_overview where slug = 'ai-futures-senior-ai-product-engineer-frankfurt';
select pg_temp.check(answer_count = 1 and unsaved_answers = 0, 'overview: answer counts') from job_overview where slug = 'mistral-applied-ai-fde-london';

-- G. bad input is refused
do $$ begin
  perform public.iv_upsert_application('{"slug":"Bad Slug"}');
  raise exception 'bad slug accepted';
exception when sqlstate '22023' then null; end $$;
do $$ begin
  perform public.iv_upsert_application('{"slug":"no-company-yet"}');
  raise exception 'new application without company/role accepted';
exception when sqlstate '22023' then null; end $$;
do $$ begin
  update public.jobs set phase = 'ghosted' where id = 121;
  raise exception 'invalid phase accepted';
exception when check_violation then null; end $$;

select what as failed_check from _expect where not ok;
do $$
declare n int; bad text;
begin
  select count(*) filter (where not ok), string_agg(what, E'\n  ') filter (where not ok) into n, bad from _expect;
  if n > 0 then raise exception E'% check(s) failed:\n  %', n, bad; end if;
  raise notice 'test.sql: % checks passed', (select count(*) from _expect);
end $$;
commit;

-- H. schema shape after two runs (as the migration owner, outside the user session)
do $$
declare n int;
begin
  select count(*) into n from pg_constraint
   where conrelid = 'public.jobs'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute where attrelid = 'public.jobs'::regclass and attname = 'company_id')];
  if n <> 1 then raise exception 'expected 1 foreign key on jobs.company_id after two runs, found %', n; end if;
  select count(*) into n from pg_trigger where tgrelid = 'public.jobs'::regclass and tgname like 'iv\_%';
  if n <> 2 then raise exception 'expected 2 iv_ triggers on jobs, found %', n; end if;
  if (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'jobs' and column_name = 'application_date') <> 'YES' then
    raise exception 'jobs.application_date must accept NULL after the migration';
  end if;
  if not (select public from storage.buckets where id = 'user_avatars') then
    raise exception 'existing bucket user_avatars was changed';
  end if;
  if (select public from storage.buckets where id = 'intervous-docs') is distinct from false then
    raise exception 'intervous-docs bucket missing or public';
  end if;
  if has_function_privilege('anon', 'public.iv_upsert_application(jsonb)', 'execute') then
    raise exception 'anon can execute iv_upsert_application';
  end if;
  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('jobs','job_events','job_documents');
  if n <> 3 then raise exception 'expected 3 realtime tables, found %', n; end if;
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
               and relname in ('job_events','job_documents','job_answers','job_requirements','proof_points',
                               'job_proof_points','contacts','user_settings') and not relrowsecurity) then
    raise exception 'a new table has RLS disabled';
  end if;
  raise notice 'test.sql: schema checks passed';
end $$;
