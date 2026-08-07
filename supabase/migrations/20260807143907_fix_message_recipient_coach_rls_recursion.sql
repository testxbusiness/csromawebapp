-- Evita il ciclo messages -> message_recipients -> messages durante la lettura
-- dei destinatari da parte dei coach. La funzione bypassa RLS solo per il check
-- puntuale di ownership, mantenendo l'autorizzazione del chiamante nella policy.
create or replace function private.is_message_owner(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.messages m
    where m.id = p_message_id
      and m.created_by = (select private.current_profile_id())
  )
$$;

revoke all on function private.is_message_owner(uuid) from public;
grant execute on function private.is_message_owner(uuid) to authenticated, service_role;

drop policy if exists message_recipients_coach_delete on public.message_recipients;
create policy message_recipients_coach_delete
  on public.message_recipients for delete to authenticated
  using (
    (select private.has_account_role('coach'))
    and (select private.is_message_owner(message_id))
  );

drop policy if exists message_recipients_coach_modify on public.message_recipients;
create policy message_recipients_coach_modify
  on public.message_recipients for insert to authenticated
  with check (
    (select private.has_account_role('coach'))
    and (select private.is_message_owner(message_id))
    and (team_id is null or team_id in (select private.team_ids_for_coach()))
  );

drop policy if exists message_recipients_coach_select on public.message_recipients;
create policy message_recipients_coach_select
  on public.message_recipients for select to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      profile_id = (select private.current_profile_id())
      or team_id in (select private.team_ids_for_coach())
      or (select private.is_message_owner(message_id))
    )
  );

drop policy if exists message_recipients_coach_update on public.message_recipients;
create policy message_recipients_coach_update
  on public.message_recipients for update to authenticated
  using (
    (select private.has_account_role('coach'))
    and (select private.is_message_owner(message_id))
  )
  with check (
    (select private.has_account_role('coach'))
    and (select private.is_message_owner(message_id))
    and (team_id is null or team_id in (select private.team_ids_for_coach()))
  );
