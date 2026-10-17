-- Security test of the v2 migration (run after test.sql). Each block expects a specific
-- outcome and raises otherwise, failing scripts/test-sql.sh.
-- With -v storage_owner=0 (postgres could not create storage policies) the storage part
-- checks the fallback instead: the bucket exists and no intervous-docs policy was created.
\set ON_ERROR_STOP 1
\if :{?storage_owner}
\else
  \set storage_owner 1
\endif

-- 1. owner: storage folder rules, adopting a row that already has another slug
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', 'f54bff0b-9aa2-4e54-b93b-b81bfb671f70', true);
\if :storage_owner
insert into storage.objects(bucket_id, name) values ('intervous-docs','f54bff0b-9aa2-4e54-b93b-b81bfb671f70/x/cv_pdf/a.pdf');
do $$ begin
  insert into storage.objects(bucket_id, name) values ('intervous-docs','00000000-0000-0000-0000-000000000002/x/cv_pdf/a.pdf');
  raise exception 'storage accepted a write into another user''s folder';
exception when insufficient_privilege then null; end $$;
do $$ begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'owner should see exactly 1 storage object'; end if;
end $$;
\endif
do $$ begin
  perform public.iv_upsert_application('{"slug":"other-slug","job_id":133}');
  raise exception 'adopting a row that already has a different slug was allowed';
exception when unique_violation then null; end $$;
commit;

-- 2. a second user sees nothing and cannot write into the owner's jobs
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select 'other user sees' who, (select count(*) from jobs) jobs, (select count(*) from job_events) ev, (select count(*) from job_documents) docs,
       (select count(*) from proof_points) pp, (select count(*) from storage.objects) objs, (select count(*) from job_overview) ov;
do $$ begin
  if (select count(*) from jobs) + (select count(*) from job_events) + (select count(*) from job_documents)
     + (select count(*) from job_answers) + (select count(*) from job_requirements) + (select count(*) from proof_points)
     + (select count(*) from job_proof_points) + (select count(*) from contacts) + (select count(*) from user_settings)
     + (select count(*) from storage.objects) + (select count(*) from job_overview) <> 0 then
    raise exception 'second user can see rows of the first user';
  end if;
end $$;
do $$ begin
  insert into job_events(job_id, kind) values (121, 'note');
  raise exception 'second user inserted an event on someone else''s job';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into job_answers(job_id, question) values (121, 'q');
  raise exception 'second user inserted an answer on someone else''s job';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.iv_upsert_application('{"slug":"x-y","job_id":121}');
  raise exception 'second user adopted someone else''s job';
exception when no_data_found then null; end $$;
do $$ begin
  update jobs set phase = 'offer' where id = 121;
  if found then raise exception 'second user updated someone else''s job'; end if;
end $$;
-- the second user can still use the RPC for their own rows
do $$ declare r jsonb; begin
  r := public.iv_upsert_application('{"slug":"b-own-row","company":"OpenAI","role":"Tester"}');
  if not (r->>'created')::boolean then raise exception 'second user could not create their own application'; end if;
end $$;
rollback;

-- 3. anon cannot call the RPC; settings default from auth.uid()
begin; set local role anon;
do $$ begin
  perform public.iv_upsert_application('{"slug":"abc"}');
  raise exception 'anon executed iv_upsert_application';
exception when insufficient_privilege then null; end $$;
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', 'f54bff0b-9aa2-4e54-b93b-b81bfb671f70', true);
insert into user_settings default values;
do $$ begin
  if (select follow_up_after_days from user_settings) <> 14 then raise exception 'user_settings defaults wrong'; end if;
end $$;
rollback;

-- 4. storage policies: present when postgres may create them, otherwise skipped with a warning
\if :storage_owner
do $$ begin
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'intervous-docs own %') <> 4 then raise exception 'expected 4 storage policies'; end if;
end $$;
\else
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
               and policyname like 'intervous-docs own %') then raise exception 'storage policies unexpectedly present'; end if;
  if not exists (select 1 from storage.buckets where id = 'intervous-docs' and not public) then
    raise exception 'bucket must be created even when the policies cannot be';
  end if;
end $$;
\endif
do $$ begin raise notice 'test2.sql: security checks passed'; end $$;
