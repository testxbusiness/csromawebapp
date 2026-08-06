-- Local-only Storage policies for the private message-attachments bucket.
-- The application authorizes admin/coach in the route; these policies provide
-- the corresponding database-level boundary for the browser session.

begin;

drop policy if exists "message attachments authenticated upload" on storage.objects;
create policy "message attachments authenticated upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'coach')
  and (storage.foldername(name))[1] in ('messages', 'draft')
  and (storage.foldername(name))[2] = ((select auth.uid())::text)
);

drop policy if exists "message attachments owner cleanup" on storage.objects;
create policy "message attachments owner cleanup"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'coach')
  and (storage.foldername(name))[1] in ('messages', 'draft')
  and (storage.foldername(name))[2] = ((select auth.uid())::text)
);

commit;
