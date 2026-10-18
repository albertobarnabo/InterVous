update storage.buckets set public = true where id = 'user_avatars';
select id, public from storage.buckets where id = 'user_avatars';
