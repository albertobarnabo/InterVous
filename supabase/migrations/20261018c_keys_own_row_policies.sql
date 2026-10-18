-- Lets a signed-in user read, create, update and delete their own row in public.keys.
-- Settings saves keys with an upsert (insert ... on conflict update), which needs insert,
-- update and select policies; without them saving fails with
-- "new row violates row-level security policy for table "keys"".
--
-- Run once in Supabase > SQL Editor. One transaction, safe to re-run.

begin;

alter table public.keys enable row level security;

drop policy if exists "keys: own row select" on public.keys;
drop policy if exists "keys: own row insert" on public.keys;
drop policy if exists "keys: own row update" on public.keys;
drop policy if exists "keys: own row delete" on public.keys;

create policy "keys: own row select" on public.keys
    for select to authenticated
    using (user_id = auth.uid());

create policy "keys: own row insert" on public.keys
    for insert to authenticated
    with check (user_id = auth.uid());

create policy "keys: own row update" on public.keys
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "keys: own row delete" on public.keys
    for delete to authenticated
    using (user_id = auth.uid());

commit;

select count(*)::text || '/4' as keys_policies
  from pg_policies
 where schemaname = 'public' and tablename = 'keys' and policyname like 'keys: own row %';
