-- Le policy legacy dei mittenti messaggi interrogavano messages/message_recipients
-- durante la lettura di profiles. Le policy account-based del dominio messaggi
-- fanno il percorso inverso e la combinazione produce ricorsione RLS infinita.
drop policy if exists profiles_select_message_senders on public.profiles;
drop policy if exists profiles_select_message_senders_coaches on public.profiles;
