-- Cleanup for the alternate legacy policy names present in the restored local
-- database. The operations are idempotent and preserve the new policies.
drop policy if exists "Coaches delete team documents" on public.documents;
drop policy if exists "Coaches insert team documents" on public.documents;
drop policy if exists "Coaches update team documents" on public.documents;
