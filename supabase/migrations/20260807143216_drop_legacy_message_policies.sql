-- Il dominio messaggi è ora autorizzato dalle policy account-based. Le policy
-- storiche usavano auth.uid()/profiles.role e alcune attraversavano
-- messages <-> message_recipients, causando ricorsione RLS.
drop policy if exists "Admins can manage all messages" on public.messages;
drop policy if exists "Admins can manage message recipients" on public.message_recipients;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can view messages sent to them" on public.messages;
drop policy if exists "Users can view their message recipients" on public.message_recipients;
drop policy if exists message_recipients_user_update_read on public.message_recipients;
