-- InterVous v2
--
-- What this adds:
--   * a "phase" column on jobs (draft, applied, screening, interviewing, offer, rejected,
--     no_reply, withdrawn, skipped) plus the extra application fields (salary, channel, dates...).
--     The old status / stage / application_date columns are kept in step by a trigger,
--     so the current web UI keeps working unchanged.
--   * new tables: job_events (the timeline), job_documents (CV PDF, LaTeX, JD text),
--     job_answers, job_requirements (fit items), proof_points + job_proof_points, contacts,
--     user_settings. Every new table is visible only to its owner (row-level security).
--   * a read-only view job_overview and one write function iv_upsert_application(jsonb)
--     used by the intervous CLI.
--   * a private storage bucket "intervous-docs" for the CV files, and live updates (Realtime)
--     on jobs, job_events and job_documents.
--
-- How to run: Supabase Dashboard > SQL Editor > New query, paste the whole file, Run.
--   * It runs as ONE transaction: if anything fails, nothing is changed.
--   * It is safe to re-run: every step checks what already exists.
--   * It never deletes rows or columns and never loosens the existing jobs policies.
--     The only change to an existing column: if jobs.application_date is NOT NULL, that is
--     relaxed, because an application that was never sent has no date.
--   * The last result shows a short status table. If "storage_policies" is not 4/4, your
--     project did not let SQL create policies on storage.objects ("must be owner"); create the
--     4 policies by hand as described in section 9 below. Everything else is already applied.
--
-- Tested on Supabase Postgres 17 with jobs.id int4 or int8, application_date text, date or
-- timestamptz, NOT NULL legacy columns and pre-existing triggers on jobs (supabase/tests/,
-- run with scripts/test-sql.sh).

begin;

-- ---------------------------------------------------------------------------
-- 0. Guards: stop early, with a clear message, on a database this file was not written for
-- ---------------------------------------------------------------------------
do $$
declare v_id_type text;
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'InterVous v2 needs Postgres 15 or later (found %).', current_setting('server_version');
  end if;
  if to_regclass('public.jobs') is null or to_regclass('public.companies') is null then
    raise exception 'public.jobs and public.companies must exist before this migration.';
  end if;
  select format_type(a.atttypid, a.atttypmod) into v_id_type
    from pg_attribute a where a.attrelid = 'public.jobs'::regclass and a.attname = 'id' and not a.attisdropped;
  if v_id_type is null or v_id_type not in ('smallint', 'integer', 'bigint') then
    raise exception 'public.jobs.id must be an integer column (found %). Stop and tell the agent.', coalesce(v_id_type, 'none');
  end if;
  -- refuse to run on top of the abandoned draft migration (20261017_application_dossier.sql),
  -- which created a job_events table with a different shape
  if to_regclass('public.job_events') is not null and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'job_events' and column_name = 'direction') then
    raise exception 'public.job_events exists with the old draft shape. Stop and tell the agent; do not drop anything yourself.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. jobs: new columns (nullable or defaulted)
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists phase              text,
  add column if not exists slug               text,
  add column if not exists company_id         uuid references public.companies(id) on delete set null,
  add column if not exists team               text,
  add column if not exists work_mode          text,
  add column if not exists country_code       text,
  add column if not exists channel            text,
  add column if not exists channel_detail     text,
  add column if not exists role_family        text,
  add column if not exists seniority          text,
  add column if not exists years_required     smallint,
  add column if not exists visa_needed        boolean,
  add column if not exists salary_text        text,
  add column if not exists salary_min         numeric,
  add column if not exists salary_max         numeric,
  add column if not exists salary_currency    text,
  add column if not exists salary_period      text,
  add column if not exists applied_on         date,
  add column if not exists cv_built_on        date,
  add column if not exists closes_on          date,
  add column if not exists posting_live       boolean,
  add column if not exists posting_checked_at timestamptz,
  add column if not exists next_action        text,
  add column if not exists next_action_due    date,
  add column if not exists cv_variant         text,
  add column if not exists notes              text,
  add column if not exists status_evidence    text,
  add column if not exists uncertain          text[] not null default '{}',
  add column if not exists source             text not null default 'web',
  add column if not exists last_activity_at   timestamptz,
  add column if not exists created_at         timestamptz,
  add column if not exists updated_at         timestamptz;
-- defaults set separately so pre-existing rows keep NULL (unknown) instead of "now";
-- a column that already has a default (e.g. a live created_at) keeps it
do $$
declare c text;
begin
  foreach c in array array['created_at', 'updated_at'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'jobs' and column_name = c and column_default is null) then
      execute format('alter table public.jobs alter column %I set default now()', c);
    end if;
  end loop;
  -- a draft has no application date, and the trigger below mirrors applied_on (NULL for drafts)
  -- into application_date, so that legacy column must accept NULL
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'jobs' and column_name = 'application_date'
                and is_nullable = 'NO') then
    alter table public.jobs alter column application_date drop not null;
    raise notice 'InterVous: jobs.application_date was NOT NULL; it now accepts NULL (drafts have no date).';
  end if;
end $$;

alter table public.jobs drop constraint if exists jobs_phase_check;
alter table public.jobs add  constraint jobs_phase_check check (phase is null or phase in
  ('draft','applied','screening','interviewing','offer','rejected','no_reply','withdrawn','skipped'));
alter table public.jobs drop constraint if exists jobs_work_mode_check;
alter table public.jobs add  constraint jobs_work_mode_check check (work_mode is null or work_mode in ('onsite','hybrid','remote'));
alter table public.jobs drop constraint if exists jobs_channel_check;
alter table public.jobs add  constraint jobs_channel_check check (channel is null or channel in
  ('ats','portal','referral','recruiter','linkedin','email','other'));
alter table public.jobs drop constraint if exists jobs_salary_period_check;
alter table public.jobs add  constraint jobs_salary_period_check check (salary_period is null or salary_period in ('year','month','day','hour'));
alter table public.jobs drop constraint if exists jobs_source_check;
alter table public.jobs add  constraint jobs_source_check check (source in ('web','cli','import'));
alter table public.jobs drop constraint if exists jobs_slug_check;
alter table public.jobs add  constraint jobs_slug_check check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,80}$');

create unique index if not exists jobs_user_slug_key on public.jobs (user_id, slug);
create index if not exists jobs_user_phase_idx on public.jobs (user_id, phase);
create index if not exists jobs_company_id_idx on public.jobs (company_id);

-- ---------------------------------------------------------------------------
-- 2. phase <-> legacy status/stage mapping (old UI keeps working)
-- ---------------------------------------------------------------------------
create or replace function public.iv_phase_from_legacy(p_status text, p_stage text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when lower(coalesce(p_status, '')) = 'not applied' then 'draft'
    when lower(coalesce(p_status, '')) in ('inactive', 'rejected', 'closed') then 'rejected'
    when lower(coalesce(p_stage, '')) in ('video interview', 'hr interview', 'technical interview', 'final round') then 'interviewing'
    when lower(coalesce(p_stage, '')) = 'coding assessment' then 'screening'
    else 'applied'
  end
$$;

create or replace function public.iv_legacy_status(p_phase text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_phase in ('draft', 'skipped') then 'Not Applied'
    when p_phase in ('applied', 'screening', 'interviewing', 'offer') then 'Active'
    else 'Inactive'
  end
$$;

create or replace function public.iv_legacy_stage(p_phase text, p_old_stage text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_phase
    when 'draft'        then '-'
    when 'skipped'      then '-'
    when 'applied'      then 'Screening'
    when 'screening'    then case when p_old_stage = 'Coding Assessment' then p_old_stage else 'Screening' end
    when 'interviewing' then case when p_old_stage in ('Video Interview','HR Interview','Technical Interview','Final Round')
                                  then p_old_stage else 'Video Interview' end
    when 'offer'        then 'Final Round'
    else coalesce(nullif(p_old_stage, '-'), 'Screening')   -- closed: keep the furthest stage reached
  end
$$;

-- legacy application_date -> date, whatever type the live column has (text, date, timestamp, timestamptz).
-- Postgres picks the overload from the column type, so no cast to text (and no DateStyle) is involved.
-- text: 'YYYY-MM-DD...' -> date; anything else, or an impossible date like 2026-02-30, -> NULL
-- (never an error, so one odd legacy value cannot abort the backfill)
create or replace function public.iv_parse_date(s text)
returns date language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if s ~ '^\d{4}-\d{2}-\d{2}' then return left(s, 10)::date; end if;
  return null;
exception when others then
  return null;
end $$;
create or replace function public.iv_parse_date(s date)
returns date language sql immutable set search_path = public, pg_temp as $$ select s $$;
create or replace function public.iv_parse_date(s timestamp)
returns date language sql immutable set search_path = public, pg_temp as $$ select s::date $$;
create or replace function public.iv_parse_date(s timestamptz)
returns date language sql stable set search_path = public, pg_temp as $$
  select (s at time zone 'Europe/Berlin')::date
$$;

-- one-time backfill of rows that predate this migration (re-runs touch nothing: phase is set)
update public.jobs
   set phase      = public.iv_phase_from_legacy(status, stage),
       uncertain  = case when lower(coalesce(status, '')) = 'inactive'
                         then array(select distinct unnest(uncertain || array['phase'])) else uncertain end,
       applied_on = coalesce(applied_on, public.iv_parse_date(application_date))
 where phase is null;

create or replace function public.iv_jobs_before_write()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare bulk boolean := coalesce(current_setting('intervous.bulk', true), '') = 'on';
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    if new.phase is null then
      new.phase := public.iv_phase_from_legacy(new.status, new.stage);
    else
      new.status := public.iv_legacy_status(new.phase);
      new.stage  := public.iv_legacy_stage(new.phase, new.stage);
    end if;
    if new.applied_on is null then
      new.applied_on := public.iv_parse_date(new.application_date);
    end if;
  else
    if new.phase is distinct from old.phase then
      new.status := public.iv_legacy_status(new.phase);
      new.stage  := public.iv_legacy_stage(new.phase, old.stage);
    elsif new.status is distinct from old.status or new.stage is distinct from old.stage then
      new.phase := public.iv_phase_from_legacy(new.status, new.stage);   -- old UI wrote status/stage
    end if;
    if new.application_date is distinct from old.application_date and new.applied_on is not distinct from old.applied_on then
      new.applied_on := public.iv_parse_date(new.application_date);  -- old UI edited the date
    end if;
  end if;
  if new.phase in ('applied','screening','interviewing','offer') and new.applied_on is null and not bulk then
    new.applied_on := current_date;          -- the importer may legitimately not know the date
  end if;
  -- applied_on is the source of truth; the legacy column mirrors it, including NULL.
  -- 'YYYY-MM-DD' text converts to a text, date, timestamp or timestamptz column alike.
  if tg_op = 'INSERT' or new.applied_on is distinct from old.applied_on then
    new.application_date := to_char(new.applied_on, 'YYYY-MM-DD');
  end if;
  return new;
end $$;

drop trigger if exists iv_jobs_before_write on public.jobs;
create trigger iv_jobs_before_write before insert or update on public.jobs
  for each row execute function public.iv_jobs_before_write();

-- ---------------------------------------------------------------------------
-- 3. per-user settings (thresholds used by Today and Insights)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  follow_up_after_days   int  not null default 14,
  no_reply_after_days    int  not null default 45,
  mature_after_days      int  not null default 21,
  draft_stale_after_days int  not null default 7,
  weekly_target          int  not null default 3,
  timezone               text not null default 'Europe/Berlin',
  campaign_start         date not null default '2026-08-01',
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. child tables
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id       bigint references public.jobs(id) on delete set null,
  company_id   uuid references public.companies(id) on delete set null,
  name         text not null,
  role         text,
  email        text,
  linkedin_url text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists contacts_job_idx on public.contacts (job_id);

create table if not exists public.job_events (
  id             bigint generated always as identity primary key,
  job_id         bigint not null references public.jobs(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind           text not null check (kind in
                   ('cv_built','applied','auto_ack','reply','assessment','interview_scheduled','interview_done',
                    'follow_up_sent','rejection','offer','withdrawn','skipped','posting_closed','phase_change','note')),
  direction      text check (direction in ('in','out','self')),
  occurred_on    date not null default current_date,
  occurred_at    timestamptz,
  date_uncertain boolean not null default false,
  from_phase     text,
  to_phase       text check (to_phase is null or to_phase in
                   ('draft','applied','screening','interviewing','offer','rejected','no_reply','withdrawn','skipped')),
  title          text,
  body           text,
  contact_id     uuid references public.contacts(id) on delete set null,
  source         text not null default 'web' check (source in ('web','cli','import','auto')),
  created_at     timestamptz not null default now()
);
create index if not exists job_events_job_idx on public.job_events (job_id, occurred_on);

create table if not exists public.job_documents (
  id           uuid primary key default gen_random_uuid(),
  job_id       bigint not null references public.jobs(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('cv_pdf','cv_source','jd_snapshot','cover_letter','other')),
  label        text,
  storage_path text,      -- object name in bucket intervous-docs: <uid>/<slug>/<kind>/<sha12>-<file>
  content      text,      -- inline text (JD snapshot as Markdown)
  mime_type    text,
  size_bytes   bigint,
  sha256       text not null,
  source_url   text,
  captured_at  timestamptz,
  submitted    boolean,   -- true: this exact file was sent; null: unknown
  created_at   timestamptz not null default now(),
  constraint job_documents_has_body check (storage_path is not null or content is not null)
);
create unique index if not exists job_documents_dedupe on public.job_documents (job_id, kind, sha256);

create table if not exists public.job_answers (
  id          uuid primary key default gen_random_uuid(),
  job_id      bigint not null references public.jobs(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position    int  not null default 0,
  question    text not null,
  answer      text,           -- NULL = given somewhere (portal, chat) but never saved
  char_limit  int,
  submitted   boolean,
  source_path text,           -- file path, or e.g. 'chat 2026-10-01'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists job_answers_job_idx on public.job_answers (job_id, position);

-- "fit items": what the JD asked and how this application answered it
create table if not exists public.job_requirements (
  id          uuid primary key default gen_random_uuid(),
  job_id      bigint not null references public.jobs(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position    int  not null default 0,
  requirement text not null,
  importance  text check (importance is null or importance in ('required','nice')),
  verdict     text not null check (verdict in ('met','partial','gap','caution')),
  evidence    text,                          -- for met/partial: what was shown; for caution: the correct fact
  topic       text,                          -- lowercase snake_case key, e.g. 'years_experience', 'kubernetes'
  gap_state   text check (gap_state is null or gap_state in ('open','worded_around','not_claimed','no_longer_true')),
  anchor_text text,                          -- exact phrase from the JD, for highlighting
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists job_requirements_job_idx on public.job_requirements (job_id, position);
create index if not exists job_requirements_topic_idx on public.job_requirements (user_id, topic);

create table if not exists public.proof_points (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name          text not null,
  summary       text,
  metric        text,
  facts         jsonb  not null default '{}'::jsonb,  -- canonical true numbers, e.g. {"exact_match":"73.8%"}
  aliases       text[] not null default '{}',
  metric_status text not null default 'verified' check (metric_status in ('verified','needs_care','unverified')),
  caveat        text,
  link          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.job_proof_points (
  job_id         bigint not null references public.jobs(id) on delete cascade,
  proof_point_id uuid   not null references public.proof_points(id) on delete cascade,
  user_id        uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  position       int    not null default 0,
  detail         text,  -- how it was worded in THIS application, e.g. "300+ cases, 93%"
  primary key (job_id, proof_point_id)
);

create or replace function public.iv_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists iv_touch on public.job_answers;
create trigger iv_touch before update on public.job_answers for each row execute function public.iv_touch_updated_at();
drop trigger if exists iv_touch on public.proof_points;
create trigger iv_touch before update on public.proof_points for each row execute function public.iv_touch_updated_at();
drop trigger if exists iv_touch on public.user_settings;
create trigger iv_touch before update on public.user_settings for each row execute function public.iv_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. timeline triggers: an event can move the phase; a direct phase edit logs an event
-- ---------------------------------------------------------------------------
create or replace function public.iv_implied_phase(p_kind text, p_current text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case p_kind
    when 'applied'             then case when p_current is null or p_current in ('draft','skipped') then 'applied' end
    when 'reply'               then case when p_current = 'applied' then 'screening' end
    when 'assessment'          then case when p_current in ('applied','screening') then 'screening' end
    when 'interview_scheduled' then case when p_current in ('applied','screening') then 'interviewing' end
    when 'rejection'           then 'rejected'
    when 'offer'               then 'offer'
    when 'withdrawn'           then 'withdrawn'
    when 'skipped'             then 'skipped'
  end
$$;

create or replace function public.iv_events_before_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare cur text;
begin
  select phase into cur from public.jobs where id = new.job_id;
  if new.to_phase is null and new.kind <> 'phase_change' then
    new.to_phase := public.iv_implied_phase(new.kind, cur);
  end if;
  if new.to_phase is not null and new.from_phase is null then
    new.from_phase := cur;
  end if;
  if new.direction is null then
    new.direction := case
      when new.kind in ('auto_ack','reply','assessment','interview_scheduled','rejection','offer') then 'in'
      when new.kind in ('applied','follow_up_sent','withdrawn') then 'out'
      else 'self' end;
  end if;
  return new;
end $$;

-- The phase follows the newest phase-bearing event that has already happened. A new event with a
-- to_phase moves the phase unless another phase-bearing event is dated after it AND has already
-- happened (its occurred_at has passed; without a time, its day has begun in the database time
-- zone, UTC on Supabase). A future-dated
-- event (an interview scheduled for next week) only means "scheduled": it never holds the phase,
-- so a rejection, withdrawal or offer recorded today, or backdated, still wins. A newer event that
-- has happened is real history and keeps the phase (backfilling an old rejection behind it is a no-op).
create or replace function public.iv_events_after_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('intervous.bulk', true), '') = 'on' then return null; end if;
  update public.jobs j set
    phase = case
              when new.to_phase is not null and not exists (
                     select 1 from public.job_events e
                      where e.job_id = new.job_id and e.id <> new.id
                        and e.to_phase is not null and e.occurred_on > new.occurred_on
                        and coalesce(e.occurred_at, e.occurred_on::timestamptz) <= now())
              then new.to_phase else j.phase end,
    applied_on = case when new.kind = 'applied' then coalesce(j.applied_on, new.occurred_on) else j.applied_on end,
    last_activity_at = greatest(coalesce(j.last_activity_at, '-infinity'::timestamptz),
                                least(now(), coalesce(new.occurred_at, new.occurred_on::timestamptz)))
  where j.id = new.job_id;
  return null;
end $$;

create or replace function public.iv_jobs_log_phase()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() = 1
     and coalesce(current_setting('intervous.bulk', true), '') <> 'on'
     and new.phase is distinct from old.phase then
    insert into public.job_events (job_id, user_id, kind, from_phase, to_phase, occurred_on, source)
    values (new.id, new.user_id, 'phase_change', old.phase, new.phase, current_date, 'auto');
  end if;
  return null;
end $$;

drop trigger if exists iv_events_before_insert on public.job_events;
create trigger iv_events_before_insert before insert on public.job_events
  for each row execute function public.iv_events_before_insert();
drop trigger if exists iv_events_after_insert on public.job_events;
create trigger iv_events_after_insert after insert on public.job_events
  for each row execute function public.iv_events_after_insert();
drop trigger if exists iv_jobs_log_phase on public.jobs;
create trigger iv_jobs_log_phase after update on public.jobs
  for each row execute function public.iv_jobs_log_phase();

-- ---------------------------------------------------------------------------
-- 6. row-level security: every new table is owner-only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- jobs: only add a policy if the live table has none (never loosen existing ones)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'jobs') then
    execute $p$create policy "jobs own rows" on public.jobs for all to authenticated
             using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$;
    execute 'alter table public.jobs enable row level security';
  elsif not (select relrowsecurity from pg_class where oid = 'public.jobs'::regclass) then
    raise notice 'public.jobs has policies but RLS is DISABLED. Review before enabling.';
  end if;

  foreach t in array array['user_settings','proof_points'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  foreach t in array array['job_events','job_documents','job_answers','job_requirements','job_proof_points'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                     using (user_id = (select auth.uid()))
                     with check (user_id = (select auth.uid()) and exists
                       (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid())))$p$, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  alter table public.contacts enable row level security;
  drop policy if exists "own rows" on public.contacts;
  create policy "own rows" on public.contacts for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (job_id is null or exists
      (select 1 from public.jobs j where j.id = job_id and j.user_id = (select auth.uid()))));
  grant select, insert, update, delete on public.contacts to authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- 7. read model for Today, Applications, Insights and the CLI (RLS applies: security_invoker)
-- ---------------------------------------------------------------------------
drop view if exists public.job_overview;
create view public.job_overview with (security_invoker = true) as
select j.id, j.slug, j.user_id, j.company_name, j.company_id, j.role, j.location, j.country_code, j.url, j.phase,
       j.stage, j.channel, j.role_family, j.visa_needed, j.years_required, j.applied_on, j.cv_built_on, j.closes_on,
       j.next_action, j.next_action_due, j.posting_live, j.uncertain, j.last_activity_at, j.created_at, j.updated_at,
       j.source,
       (select min(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.direction = 'in' and e.kind <> 'auto_ack')                   as first_response_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.direction = 'in' and e.kind <> 'auto_ack'
           and e.occurred_on <= current_date)                                                      as last_inbound_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.kind = 'follow_up_sent')                                      as last_follow_up_on,
       (select max(e.occurred_on) from public.job_events e
         where e.job_id = j.id and e.kind <> 'phase_change' and e.occurred_on <= current_date)      as last_event_on,
       (select min(coalesce(e.occurred_at, e.occurred_on::timestamptz)) from public.job_events e
         where e.job_id = j.id and e.kind = 'interview_scheduled'
           and coalesce(e.occurred_at, e.occurred_on::timestamptz) >= date_trunc('day', now()))    as next_interview_at,
       (select count(*) from public.job_requirements r
         where r.job_id = j.id and r.verdict = 'gap'
           and coalesce(r.gap_state, 'open') <> 'no_longer_true')                                  as open_gaps,
       (select count(*) from public.job_requirements r
         where r.job_id = j.id and r.verdict = 'caution')                                          as cautions,
       (select count(*) from public.job_answers a where a.job_id = j.id)                           as answer_count,
       (select count(*) from public.job_answers a where a.job_id = j.id and a.answer is null)      as unsaved_answers,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'cv_pdf')      as has_cv,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'cv_pdf'
                 and d.submitted is true)                                                           as has_sent_cv,
       exists (select 1 from public.job_documents d where d.job_id = j.id and d.kind = 'jd_snapshot') as has_jd
  from public.jobs j;
grant select on public.job_overview to authenticated;

-- ---------------------------------------------------------------------------
-- 8. one atomic write for the CLI and the importer
--    Missing key = keep the stored value. Present key = overwrite (null clears).
--    Present list (requirements/answers/proof_points/contacts) = replace that list,
--    but web edits survive: gap_state and answer text are carried over by matching text.
--    events/documents are append-only and de-duplicated.
-- ---------------------------------------------------------------------------
create or replace function public.iv_upsert_application(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_slug text := nullif(trim(p->>'slug'), '');
  v_company text := nullif(trim(p->>'company'), '');
  v_company_id uuid;
  v_company_canon text;
  v_company_created boolean := false;
  v_job public.jobs%rowtype;
  v_created boolean := false;
  v_adopted boolean := false;
  v_old jsonb;
  v_pp uuid;
  r record;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]{1,80}$' then
    raise exception 'slug is required: lowercase letters, digits and dashes' using errcode = '22023';
  end if;
  perform set_config('intervous.bulk', 'on', true);

  -- company: case-insensitive exact match; create unless company_create = false
  if v_company is not null then
    select id, name into v_company_id, v_company_canon from public.companies
     where lower(trim(name)) = lower(v_company) order by name, id limit 1;  -- live companies has no created_at
    if found then
      v_company := v_company_canon;            -- keep the stored spelling so the name join works
    elsif coalesce((p->>'company_create')::boolean, true) then
      insert into public.companies (name, website, created_by)
      values (v_company, nullif(p->>'company_website', ''), uid)
      returning id into v_company_id;
      v_company_created := true;
    end if;
  end if;

  -- find the job: by slug; else an explicit job_id to adopt; else a slug-less row with the same URL
  select * into v_job from public.jobs where user_id = uid and slug = v_slug;
  if not found and p ? 'job_id' then
    select * into v_job from public.jobs where user_id = uid and id = (p->>'job_id')::bigint;
    if not found then raise exception 'job % not found', p->>'job_id' using errcode = 'P0002'; end if;
    if v_job.slug is not null and v_job.slug <> v_slug then
      raise exception 'job % already has slug %', v_job.id, v_job.slug using errcode = '23505';
    end if;
    v_adopted := true;
  end if;
  if v_job.id is null and nullif(p->>'url', '') is not null then
    select * into v_job from public.jobs
     where user_id = uid and slug is null and coalesce(url, '') <> ''
       and rtrim(split_part(url, '?', 1), '/') = rtrim(split_part(p->>'url', '?', 1), '/')
     order by id limit 1;
    v_adopted := found;
  end if;

  if v_job.id is null then
    if v_company is null or nullif(p->>'role', '') is null then
      raise exception 'company and role are required for a new application' using errcode = '22023';
    end if;
    insert into public.jobs (user_id, slug, company_name, company_id, role, location, url, phase, source)
    values (uid, v_slug, v_company, v_company_id, p->>'role', coalesce(p->>'location', ''), coalesce(p->>'url', ''),
            coalesce(p->>'phase', 'draft'), coalesce(p->>'source', 'cli'))
    returning * into v_job;
    v_created := true;
  end if;

  update public.jobs j set
    slug               = v_slug,
    company_name       = coalesce(v_company, j.company_name),
    company_id         = coalesce(v_company_id, j.company_id),
    role               = coalesce(nullif(p->>'role', ''), j.role),
    location           = case when p ? 'location'        then coalesce(p->>'location', '')     else j.location end,
    url                = case when p ? 'url'             then coalesce(p->>'url', '')          else j.url end,
    phase              = coalesce(p->>'phase', j.phase),
    team               = case when p ? 'team'            then p->>'team'                       else j.team end,
    work_mode          = case when p ? 'work_mode'       then p->>'work_mode'                  else j.work_mode end,
    country_code       = case when p ? 'country_code'    then p->>'country_code'               else j.country_code end,
    channel            = case when p ? 'channel'         then p->>'channel'                    else j.channel end,
    channel_detail     = case when p ? 'channel_detail'  then p->>'channel_detail'             else j.channel_detail end,
    role_family        = case when p ? 'role_family'     then p->>'role_family'                else j.role_family end,
    seniority          = case when p ? 'seniority'       then p->>'seniority'                  else j.seniority end,
    years_required     = case when p ? 'years_required'  then (p->>'years_required')::smallint else j.years_required end,
    visa_needed        = case when p ? 'visa_needed'     then (p->>'visa_needed')::boolean     else j.visa_needed end,
    applied_on         = case when p ? 'applied_on'      then (p->>'applied_on')::date         else j.applied_on end,
    cv_built_on        = case when p ? 'cv_built_on'     then (p->>'cv_built_on')::date        else j.cv_built_on end,
    closes_on          = case when p ? 'closes_on'       then (p->>'closes_on')::date          else j.closes_on end,
    cv_variant         = case when p ? 'cv_variant'      then p->>'cv_variant'                 else j.cv_variant end,
    notes              = case when p ? 'notes'           then p->>'notes'                      else j.notes end,
    status_evidence    = case when p ? 'status_evidence' then p->>'status_evidence'            else j.status_evidence end,
    uncertain          = case when p ? 'uncertain' then coalesce(array(select jsonb_array_elements_text(p->'uncertain')), '{}')
                              else j.uncertain end,
    salary_text        = case when p ? 'salary' then p->'salary'->>'text'                      else j.salary_text end,
    salary_min         = case when p ? 'salary' then (p->'salary'->>'min')::numeric            else j.salary_min end,
    salary_max         = case when p ? 'salary' then (p->'salary'->>'max')::numeric            else j.salary_max end,
    salary_currency    = case when p ? 'salary' then p->'salary'->>'currency'                  else j.salary_currency end,
    salary_period      = case when p ? 'salary' then p->'salary'->>'period'                    else j.salary_period end,
    posting_live       = case when p ? 'posting' then (p->'posting'->>'live')::boolean         else j.posting_live end,
    posting_checked_at = case when p ? 'posting' then (p->'posting'->>'checked_at')::timestamptz else j.posting_checked_at end,
    next_action        = case when p ? 'next_action' then p->'next_action'->>'text'            else j.next_action end,
    next_action_due    = case when p ? 'next_action' then (p->'next_action'->>'due')::date     else j.next_action_due end,
    source             = case when v_created then j.source when p->>'source' = 'import' then 'import' else j.source end
  where j.id = v_job.id
  returning * into v_job;

  if p ? 'requirements' then
    select coalesce(jsonb_agg(jsonb_build_object('k', lower(requirement), 'g', gap_state)), '[]'::jsonb)
      into v_old from public.job_requirements where job_id = v_job.id;
    delete from public.job_requirements where job_id = v_job.id;
    insert into public.job_requirements (job_id, user_id, position, requirement, importance, verdict, evidence,
                                         topic, gap_state, anchor_text, note)
    select v_job.id, uid, (x.ord - 1)::int, x.e->>'requirement', x.e->>'importance', x.e->>'verdict', x.e->>'evidence',
           lower(nullif(x.e->>'topic', '')),
           case when x.e->>'verdict' in ('gap','partial') then coalesce(
                  x.e->>'gap_state',
                  (select o->>'g' from jsonb_array_elements(v_old) o where o->>'k' = lower(x.e->>'requirement') limit 1),
                  'open') end,
           x.e->>'anchor_text', x.e->>'note'
      from jsonb_array_elements(p->'requirements') with ordinality as x(e, ord);
  end if;

  if p ? 'answers' then
    select coalesce(jsonb_agg(jsonb_build_object('q', lower(question), 'a', answer, 's', submitted)), '[]'::jsonb)
      into v_old from public.job_answers where job_id = v_job.id;
    delete from public.job_answers where job_id = v_job.id;
    insert into public.job_answers (job_id, user_id, position, question, answer, char_limit, submitted, source_path)
    select v_job.id, uid, (x.ord - 1)::int, x.e->>'question',
           coalesce(x.e->>'answer', (select o->>'a' from jsonb_array_elements(v_old) o where o->>'q' = lower(x.e->>'question') limit 1)),
           (x.e->>'char_limit')::int,
           coalesce((x.e->>'submitted')::boolean,
                    (select (o->>'s')::boolean from jsonb_array_elements(v_old) o where o->>'q' = lower(x.e->>'question') limit 1)),
           x.e->>'source_path'
      from jsonb_array_elements(p->'answers') with ordinality as x(e, ord);
  end if;

  if p ? 'proof_points' then
    delete from public.job_proof_points where job_id = v_job.id;
    for r in select x.e, x.ord from jsonb_array_elements(p->'proof_points') with ordinality as x(e, ord) loop
      insert into public.proof_points (user_id, key, name, summary, metric, facts, metric_status, caveat, link)
      values (uid, r.e->>'key', coalesce(r.e->>'name', r.e->>'key'), r.e->>'summary', r.e->>'metric',
              coalesce(r.e->'facts', '{}'::jsonb), coalesce(r.e->>'metric_status', 'verified'), r.e->>'caveat', r.e->>'link')
      on conflict (user_id, key) do update set
        name          = case when r.e ? 'name' then excluded.name else proof_points.name end,
        summary       = coalesce(excluded.summary, proof_points.summary),
        metric        = coalesce(excluded.metric, proof_points.metric),
        facts         = proof_points.facts || excluded.facts,
        metric_status = case when r.e ? 'metric_status' then excluded.metric_status else proof_points.metric_status end,
        caveat        = coalesce(excluded.caveat, proof_points.caveat),
        link          = coalesce(excluded.link, proof_points.link)
      returning id into v_pp;
      insert into public.job_proof_points (job_id, proof_point_id, user_id, position, detail)
      values (v_job.id, v_pp, uid, (r.ord - 1)::int, r.e->>'detail') on conflict do nothing;
    end loop;
  end if;

  if p ? 'contacts' then
    delete from public.contacts where job_id = v_job.id;
    insert into public.contacts (user_id, job_id, company_id, name, role, email, linkedin_url, notes)
    select uid, v_job.id, v_job.company_id, e->>'name', e->>'role', e->>'email', e->>'linkedin_url', e->>'notes'
      from jsonb_array_elements(p->'contacts') e;
  end if;

  if p ? 'events' then
    insert into public.job_events (job_id, user_id, kind, occurred_on, occurred_at, date_uncertain, to_phase, title, body, source)
    select v_job.id, uid, e->>'kind', (e->>'on')::date, (e->>'at')::timestamptz,
           coalesce((e->>'date_uncertain')::boolean, false), e->>'to_phase', e->>'title', e->>'body',
           coalesce(p->>'source', 'cli')
      from jsonb_array_elements(p->'events') e
     where not exists (select 1 from public.job_events x
                        where x.job_id = v_job.id and x.kind = e->>'kind' and x.occurred_on = (e->>'on')::date
                          and coalesce(x.title, '') = coalesce(e->>'title', ''));
  end if;

  if p ? 'documents' then
    insert into public.job_documents (job_id, user_id, kind, label, storage_path, content, mime_type, size_bytes,
                                      sha256, source_url, captured_at, submitted)
    select v_job.id, uid, e->>'kind', e->>'label', e->>'storage_path', e->>'content', e->>'mime_type',
           (e->>'size_bytes')::bigint, coalesce(e->>'sha256', md5(coalesce(e->>'content', e->>'storage_path'))),
           e->>'source_url', (e->>'captured_at')::timestamptz, (e->>'submitted')::boolean
      from jsonb_array_elements(p->'documents') e
    on conflict (job_id, kind, sha256) do update set
      label = coalesce(excluded.label, job_documents.label),
      submitted = coalesce(excluded.submitted, job_documents.submitted);
  end if;

  -- last activity = newest event so far (bulk mode skipped the per-event trigger)
  update public.jobs j set last_activity_at = (
    select max(least(now(), coalesce(e.occurred_at, e.occurred_on::timestamptz)))
      from public.job_events e where e.job_id = j.id)
   where j.id = v_job.id
  returning * into v_job;

  perform set_config('intervous.bulk', 'off', true);
  return jsonb_build_object('id', v_job.id, 'slug', v_job.slug, 'created', v_created, 'adopted', v_adopted,
                            'phase', v_job.phase, 'company', v_job.company_name, 'company_id', v_job.company_id,
                            'company_created', v_company_created);
end $$;

revoke all on function public.iv_upsert_application(jsonb) from public, anon;
grant execute on function public.iv_upsert_application(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. private bucket for CV PDFs and LaTeX sources (JD snapshots are stored inline)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intervous-docs', 'intervous-docs', false, 10485760,
        array['application/pdf','text/markdown','text/plain','text/html','application/json','application/x-tex'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The 4 policies below let each user read and write only their own folder (<uid>/...).
-- On some Supabase projects SQL may not create policies on storage.objects ("must be owner of
-- table objects"). Then this block only prints a WARNING, the rest of the migration still
-- applies, and the status table at the end shows storage_policies below 4/4.
-- Dashboard fallback: Storage > Policies > intervous-docs > New policy > "For full customization",
-- create 4 policies for the role "authenticated" (SELECT, INSERT, UPDATE, DELETE) named
-- "intervous-docs own select|insert|update|delete", each with this expression
-- (for INSERT it goes in WITH CHECK, for UPDATE in both USING and WITH CHECK):
--   bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text
-- Re-running this file after that is safe.
do $$
begin
  drop policy if exists "intervous-docs own select" on storage.objects;
  drop policy if exists "intervous-docs own insert" on storage.objects;
  drop policy if exists "intervous-docs own update" on storage.objects;
  drop policy if exists "intervous-docs own delete" on storage.objects;
  create policy "intervous-docs own select" on storage.objects for select to authenticated
    using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "intervous-docs own insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "intervous-docs own update" on storage.objects for update to authenticated
    using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "intervous-docs own delete" on storage.objects for delete to authenticated
    using (bucket_id = 'intervous-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception when others then
  -- an exception block is a savepoint: only these policy statements are undone
  raise warning 'InterVous: storage policies NOT created (% %). Everything else is applied. Create the 4 policies in Dashboard > Storage > Policies (see the comment above this block in the migration).', sqlstate, sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 10. live updates: CLI writes show up in an open browser tab
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['jobs','job_events','job_documents'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
exception when others then
  -- not fatal: the app also refetches when the tab regains focus
  raise warning 'InterVous: Realtime not enabled (% %). Enable it in Dashboard > Database > Publications > supabase_realtime for jobs, job_events, job_documents.', sqlstate, sqlerrm;
end $$;

commit;
notify pgrst, 'reload schema';

-- status: the SQL editor shows this last result
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('job_events','job_documents','job_answers','job_requirements',
                         'proof_points','job_proof_points','contacts','user_settings'))::text || '/8' as new_tables,
  (select count(*) from public.jobs where phase is not null)::text || '/' || (select count(*) from public.jobs)::text
                                                                                         as jobs_with_phase,
  exists (select 1 from storage.buckets where id = 'intervous-docs')                     as bucket_ok,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'intervous-docs own %')::text || '/4'
                                                                                         as storage_policies,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('jobs','job_events','job_documents'))::text || '/3'              as realtime_tables;
