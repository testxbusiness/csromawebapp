-- Fase 2C/2E: i messaggi coach sono limitati al profilo proprietario
-- e alle squadre assegnate tramite team_coaches.

drop policy if exists "Coaches can manage messages for their teams" on public.messages;
drop policy if exists "Coaches can view their messages" on public.messages;
drop policy if exists messages_coach_delete on public.messages;
drop policy if exists messages_coach_insert on public.messages;
drop policy if exists messages_coach_select on public.messages;
drop policy if exists messages_coach_update on public.messages;

create policy messages_coach_delete
  on public.messages
  for delete
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  );

create policy messages_coach_insert
  on public.messages
  for insert
  to authenticated
  with check (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  );

create policy messages_coach_select
  on public.messages
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      created_by = (select private.current_profile_id())
      or exists (
        select 1
        from public.message_recipients mr
        where mr.message_id = messages.id
          and (
            mr.profile_id = (select private.current_profile_id())
            or mr.team_id in (select private.team_ids_for_coach())
          )
      )
    )
  );

create policy messages_coach_update
  on public.messages
  for update
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  )
  with check (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  );

drop policy if exists "Coaches can delete message recipients" on public.message_recipients;
drop policy if exists "Coaches can insert message recipients" on public.message_recipients;
drop policy if exists "Coaches can update message recipients" on public.message_recipients;
drop policy if exists message_recipients_coach_delete on public.message_recipients;
drop policy if exists message_recipients_coach_modify on public.message_recipients;
drop policy if exists message_recipients_coach_select on public.message_recipients;
drop policy if exists message_recipients_coach_update on public.message_recipients;

create policy message_recipients_coach_delete
  on public.message_recipients
  for delete
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and exists (
      select 1
      from public.messages m
      where m.id = message_recipients.message_id
        and m.created_by = (select private.current_profile_id())
    )
  );

create policy message_recipients_coach_modify
  on public.message_recipients
  for insert
  to authenticated
  with check (
    (select private.has_account_role('coach'))
    and exists (
      select 1
      from public.messages m
      where m.id = message_recipients.message_id
        and m.created_by = (select private.current_profile_id())
    )
    and (
      team_id is null
      or team_id in (select private.team_ids_for_coach())
    )
  );

create policy message_recipients_coach_select
  on public.message_recipients
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      profile_id = (select private.current_profile_id())
      or team_id in (select private.team_ids_for_coach())
      or exists (
        select 1
        from public.messages m
        where m.id = message_recipients.message_id
          and m.created_by = (select private.current_profile_id())
      )
    )
  );

create policy message_recipients_coach_update
  on public.message_recipients
  for update
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and exists (
      select 1
      from public.messages m
      where m.id = message_recipients.message_id
        and m.created_by = (select private.current_profile_id())
    )
  )
  with check (
    (select private.has_account_role('coach'))
    and exists (
      select 1
      from public.messages m
      where m.id = message_recipients.message_id
        and m.created_by = (select private.current_profile_id())
    )
    and (
      team_id is null
      or team_id in (select private.team_ids_for_coach())
    )
  );
