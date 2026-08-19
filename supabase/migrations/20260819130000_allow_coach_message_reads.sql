-- Fase 5: i coach assegnati a una squadra sono destinatari account-based
-- dei messaggi inviati a quella squadra e devono poter registrare la lettura.

begin;

create or replace function private.can_access_message_for_subject(
  p_message_id uuid,
  p_subject_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select
    (
      p_subject_profile_id = (select private.current_profile_id())
      or (select private.can_receive_related_messages(p_subject_profile_id))
    )
    and exists (
      select 1
      from public.message_recipients mr
      where mr.message_id = p_message_id
        and (
          mr.profile_id = p_subject_profile_id
          or (
            mr.team_id is not null
            and (
              exists (
                select 1
                from public.team_members tm
                where tm.team_id = mr.team_id
                  and tm.profile_id = p_subject_profile_id
              )
              or exists (
                select 1
                from public.team_coaches tc
                where tc.team_id = mr.team_id
                  and tc.coach_id = p_subject_profile_id
              )
            )
          )
        )
    )
$$;

revoke all on function private.can_access_message_for_subject(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.can_access_message_for_subject(uuid, uuid)
  to authenticated, service_role;

commit;
