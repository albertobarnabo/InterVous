-- Lets a signed-in user upload, replace and delete images in their own folder of the public
-- user_avatars bucket (<user_id>/...). Used by the profile picture and by company logos
-- (<user_id>/company-logos/<company_id>.<ext>). Reading stays public, as before.
--
-- Before this, the bucket had no write policy at all, so every upload failed with
-- "new row violates row-level security policy".
--
-- Run once in Supabase > SQL Editor. One transaction, safe to re-run.

begin;

drop policy if exists "user_avatars: own folder insert" on storage.objects;
drop policy if exists "user_avatars: own folder update" on storage.objects;
drop policy if exists "user_avatars: own folder delete" on storage.objects;

create policy "user_avatars: own folder insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'user_avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "user_avatars: own folder update" on storage.objects
    for update to authenticated
    using (bucket_id = 'user_avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'user_avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "user_avatars: own folder delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'user_avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- upsert also needs to read the existing object
drop policy if exists "user_avatars: own folder select" on storage.objects;
create policy "user_avatars: own folder select" on storage.objects
    for select to authenticated
    using (bucket_id = 'user_avatars' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

select count(*)::text || '/4' as user_avatars_policies
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname like 'user_avatars: own folder %';
