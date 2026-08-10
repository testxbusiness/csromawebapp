-- Ripristina il grant dell'helper usato dalle policy account-based.
-- La migration è idempotente: su ambienti già corretti non cambia il comportamento.

begin;

grant usage on schema private to authenticated, service_role;
grant execute on function private.has_account_role(text) to authenticated, service_role;

commit;
