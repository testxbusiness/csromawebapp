begin;

alter table public.event_attendances
  add column if not exists responded_by_auth_user_id uuid
    references auth.users (id) on delete set null,
  add column if not exists response_source text;

alter table public.rsvp
  add column if not exists responded_by_auth_user_id uuid
    references auth.users (id) on delete set null,
  add column if not exists response_source text;

alter table public.fee_installments
  add column if not exists paid_by_auth_user_id uuid
    references auth.users (id) on delete set null,
  add column if not exists payment_source text;

alter table public.event_attendances
  drop constraint if exists event_attendances_response_source_check;
alter table public.event_attendances
  add constraint event_attendances_response_source_check
  check (response_source is null or response_source in ('self', 'parent', 'coach', 'admin', 'system'));

alter table public.rsvp
  drop constraint if exists rsvp_response_source_check;
alter table public.rsvp
  add constraint rsvp_response_source_check
  check (response_source is null or response_source in ('self', 'parent', 'coach', 'admin', 'system'));

alter table public.fee_installments
  drop constraint if exists fee_installments_payment_source_check;
alter table public.fee_installments
  add constraint fee_installments_payment_source_check
  check (payment_source is null or payment_source in ('self', 'parent', 'coach', 'admin', 'system'));

create index if not exists event_attendances_responded_by_auth_user_id_idx
  on public.event_attendances (responded_by_auth_user_id)
  where responded_by_auth_user_id is not null;

create index if not exists rsvp_responded_by_auth_user_id_idx
  on public.rsvp (responded_by_auth_user_id)
  where responded_by_auth_user_id is not null;

create index if not exists fee_installments_paid_by_auth_user_id_idx
  on public.fee_installments (paid_by_auth_user_id)
  where paid_by_auth_user_id is not null;

comment on column public.event_attendances.responded_by_auth_user_id is
  'Account Auth che ha registrato la risposta; distinto dal soggetto profile_id.';
comment on column public.event_attendances.response_source is
  'Origine della risposta: self, parent, coach, admin o system.';
comment on column public.rsvp.responded_by_auth_user_id is
  'Account Auth che ha registrato la risposta; distinto dal soggetto profile_id.';
comment on column public.rsvp.response_source is
  'Origine della risposta: self, parent, coach, admin o system.';
comment on column public.fee_installments.paid_by_auth_user_id is
  'Account Auth che ha registrato il pagamento della rata.';
comment on column public.fee_installments.payment_source is
  'Origine della registrazione pagamento: self, parent, coach, admin o system.';

commit;
