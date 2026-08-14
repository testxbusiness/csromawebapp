-- Ripristina l'EXECUTE per l'helper usato dalle policy dei destinatari coach.
-- La migration Fase 4 revoca globalmente i grant sulle funzioni private;
-- questa correzione non modifica dati o condizioni RLS.

begin;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_message_owner(uuid) to authenticated, service_role;

commit;
