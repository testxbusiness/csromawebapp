-- Local-only policies for generated PDFs in the private documents bucket.
-- The application already requires admin authorization; Storage enforces the
-- same boundary for the browser session and limits objects to generated/.

begin;

drop policy if exists "documents admin upload generated" on storage.objects;
create policy "documents admin upload generated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin read generated" on storage.objects;
create policy "documents admin read generated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin update generated" on storage.objects;
create policy "documents admin update generated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
)
with check (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin delete generated" on storage.objects;
create policy "documents admin delete generated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

commit;
