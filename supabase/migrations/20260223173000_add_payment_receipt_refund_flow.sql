alter table public.profiles
  add column if not exists role text not null default 'ADMIN';

update public.profiles
set role = 'ADMIN'
where role is null
   or btrim(role) = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('ADMIN', 'USER'));
  end if;
end
$$;

alter table public.inscricoes
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

update public.inscricoes
set confirmed_at = coalesce(confirmed_at, updated_at)
where status in ('PAID', 'CONFIRMED')
  and confirmed_at is null;

update public.inscricoes
set cancelled_at = coalesce(cancelled_at, updated_at)
where status = 'CANCELLED'
  and cancelled_at is null;

alter table public.pagamentos
  add column if not exists transaction_id text,
  add column if not exists payment_method text not null default 'pix',
  add column if not exists confirmed_at timestamptz,
  add column if not exists comprovante_path text,
  add column if not exists comprovante_url text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refunded_by uuid,
  add column if not exists provider_refund_id text,
  add column if not exists raw_status jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pagamentos_refunded_by_fkey'
  ) then
    alter table public.pagamentos
      add constraint pagamentos_refunded_by_fkey
      foreign key (refunded_by) references auth.users(id) on delete set null;
  end if;
end
$$;

update public.pagamentos
set transaction_id = provider_payment_id
where transaction_id is null;

update public.pagamentos
set payment_method = 'pix'
where payment_method is null
   or btrim(payment_method) = '';

update public.pagamentos
set confirmed_at = coalesce(confirmed_at, paid_at)
where status = 'PAID'
  and confirmed_at is null;

update public.pagamentos
set refunded_at = coalesce(refunded_at, updated_at)
where status = 'REFUNDED'
  and refunded_at is null;

alter table public.inscricoes
  drop constraint if exists inscricoes_status_check;

alter table public.inscricoes
  add constraint inscricoes_status_check
  check (status in ('PENDING', 'PAID', 'CONFIRMED', 'CANCELLED'));

alter table public.pagamentos
  drop constraint if exists pagamentos_status_check;

alter table public.pagamentos
  add constraint pagamentos_status_check
  check (status in ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pagamentos_payment_method_check'
  ) then
    alter table public.pagamentos
      add constraint pagamentos_payment_method_check
      check (payment_method in ('pix', 'manual'));
  end if;
end
$$;

create table if not exists public.payment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  inscricao_id uuid not null references public.inscricoes(id) on delete cascade,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_logs_pagamento_id_idx
  on public.payment_audit_logs(pagamento_id);

create index if not exists payment_audit_logs_inscricao_id_idx
  on public.payment_audit_logs(inscricao_id);

create index if not exists payment_audit_logs_action_idx
  on public.payment_audit_logs(action);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payment_audit_logs_action_check'
  ) then
    alter table public.payment_audit_logs
      add constraint payment_audit_logs_action_check
      check (action in ('PAYMENT_CONFIRMED', 'RECEIPT_GENERATED', 'PAYMENT_REFUNDED'));
  end if;
end
$$;

alter table public.payment_audit_logs enable row level security;

drop policy if exists "Payment audit logs select" on public.payment_audit_logs;
drop policy if exists "Payment audit logs insert" on public.payment_audit_logs;
drop policy if exists "Payment audit logs update" on public.payment_audit_logs;
drop policy if exists "Payment audit logs delete" on public.payment_audit_logs;

create policy "Payment audit logs select"
  on public.payment_audit_logs
  for select
  using (auth.role() = 'authenticated');

create policy "Payment audit logs insert"
  on public.payment_audit_logs
  for insert
  with check (auth.role() = 'authenticated');

create policy "Payment audit logs update"
  on public.payment_audit_logs
  for update
  using (auth.role() = 'authenticated');

create policy "Payment audit logs delete"
  on public.payment_audit_logs
  for delete
  using (auth.role() = 'authenticated');
