-- Fase 3 / pagamento a persona non necessariamente coach.

begin;

alter table public.payments
  add column if not exists payee_profile_id uuid
    references public.profiles (id) on delete set null;

alter table public.payments
  drop constraint if exists chk_payment_type;
alter table public.payments
  add constraint chk_payment_type
  check (
    (type = 'general_cost' and coach_id is null and payee_profile_id is null)
    or (type = 'coach_payment' and coach_id is not null and payee_profile_id is null)
    or (type = 'person_payment' and payee_profile_id is not null and coach_id is null)
  );

alter table public.payments
  drop constraint if exists payments_type_check;
alter table public.payments
  add constraint payments_type_check
  check (type in ('general_cost', 'coach_payment', 'person_payment'));

create index if not exists payments_payee_profile_id_idx
  on public.payments (payee_profile_id)
  where payee_profile_id is not null;

comment on column public.payments.payee_profile_id is
  'Persona destinataria di person_payment; distinto dal coach_id legacy.';

commit;
