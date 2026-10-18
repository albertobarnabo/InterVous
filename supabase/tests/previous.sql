-- Used by the "upgrade" variant of scripts/test-sql.sh: puts back what an earlier release of the
-- v2 migration left in the database, on top of the current release, so the next run of the current
-- migration must replace it. Only the objects that changed between releases are listed here.
-- When a later fix changes another object, add its previous definition below.
--
-- Release of 2026-10-17: iv_events_after_insert let ANY later-dated phase-bearing event keep the
-- phase, including an interview scheduled for next week (it blocked a rejection recorded today).
\set ON_ERROR_STOP 1
create or replace function public.iv_events_after_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('intervous.bulk', true), '') = 'on' then return null; end if;
  update public.jobs j set
    phase = case
              when new.to_phase is not null and not exists (
                     select 1 from public.job_events e
                      where e.job_id = new.job_id and e.id <> new.id
                        and e.to_phase is not null and e.occurred_on > new.occurred_on)
              then new.to_phase else j.phase end,
    applied_on = case when new.kind = 'applied' then coalesce(j.applied_on, new.occurred_on) else j.applied_on end,
    last_activity_at = greatest(coalesce(j.last_activity_at, '-infinity'::timestamptz),
                                least(now(), coalesce(new.occurred_at, new.occurred_on::timestamptz)))
  where j.id = new.job_id;
  return null;
end $$;
