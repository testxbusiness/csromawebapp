-- Fase 2E, slice 2: documents use profile IDs for subjects and account
-- context for authorization. Auth IDs remain actor/recipient IDs only.

-- Documents: admins have global access; athletes read their own subject
-- documents; coaches manage documents addressed to their assigned teams.
drop policy if exists "Admin only access to documents" on public.documents;
drop policy if exists "Admins can manage all documents" on public.documents;
drop policy if exists "Users can view their own documents" on public.documents;
drop policy if exists "Coaches can delete team documents" on public.documents;
drop policy if exists "Coaches can insert team documents" on public.documents;
drop policy if exists "Coaches can update team documents" on public.documents;

create policy documents_admin_all
  on public.documents
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

create policy documents_subject_select
  on public.documents
  for select
  to authenticated
  using (
    profile_id = (select private.current_profile_id())
    or target_user_id = (select private.current_profile_id())
  );

create policy documents_coach_select
  on public.documents
  for select
  to authenticated
  using (
    target_team_id is not null
    and (select private.is_coach_of_team(target_team_id))
  );

create policy documents_coach_insert
  on public.documents
  for insert
  to authenticated
  with check (
    target_team_id is not null
    and (select private.is_coach_of_team(target_team_id))
  );

create policy documents_coach_update
  on public.documents
  for update
  to authenticated
  using (
    target_team_id is not null
    and (select private.is_coach_of_team(target_team_id))
  )
  with check (
    target_team_id is not null
    and (select private.is_coach_of_team(target_team_id))
  );

create policy documents_coach_delete
  on public.documents
  for delete
  to authenticated
  using (
    target_team_id is not null
    and (select private.is_coach_of_team(target_team_id))
  );

-- Document recipients: user_id is the Auth recipient/actor identifier and
-- therefore intentionally remains compared with auth.uid().
drop policy if exists "Admin only access to document_recipients" on public.document_recipients;
drop policy if exists document_recipients_admin_all on public.document_recipients;
drop policy if exists document_recipients_coach_manage on public.document_recipients;

create policy document_recipients_admin_all
  on public.document_recipients
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

create policy document_recipients_coach_manage
  on public.document_recipients
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.documents d
      where d.id = document_recipients.document_id
        and d.target_team_id is not null
        and (select private.is_coach_of_team(d.target_team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.documents d
      where d.id = document_recipients.document_id
        and d.target_team_id is not null
        and (select private.is_coach_of_team(d.target_team_id))
    )
  );

-- Templates are account-scoped; created_by remains the owning profile ID.
drop policy if exists "Admins can delete document templates" on public.document_templates;
drop policy if exists "Admins can insert document templates" on public.document_templates;
drop policy if exists "Admins can update document templates" on public.document_templates;
drop policy if exists "Authenticated users can view document templates" on public.document_templates;

create policy document_templates_admin_all
  on public.document_templates
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check (
    (select private.has_account_role('admin'))
    and created_by = (select private.current_profile_id())
  );

create policy document_templates_authenticated_select
  on public.document_templates
  for select
  to authenticated
  using ((select private.current_profile_id()) is not null);

-- Storage policy mirrors the database boundary for generated PDFs.
drop policy if exists "documents admin upload generated" on storage.objects;
drop policy if exists "documents admin read generated" on storage.objects;
drop policy if exists "documents admin update generated" on storage.objects;
drop policy if exists "documents admin delete generated" on storage.objects;

create policy "documents admin upload generated"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (select private.has_account_role('admin'))
    and (storage.foldername(name))[1] = 'generated'
  );

create policy "documents admin read generated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_account_role('admin'))
    and (storage.foldername(name))[1] = 'generated'
  );

create policy "documents admin update generated"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_account_role('admin'))
    and (storage.foldername(name))[1] = 'generated'
  )
  with check (
    bucket_id = 'documents'
    and (select private.has_account_role('admin'))
    and (storage.foldername(name))[1] = 'generated'
  );

create policy "documents admin delete generated"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (select private.has_account_role('admin'))
    and (storage.foldername(name))[1] = 'generated'
  );
