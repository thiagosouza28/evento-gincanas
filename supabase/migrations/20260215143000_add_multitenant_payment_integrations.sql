-- Multi-tenant payment integrations and ownership for events/payments

create table if not exists public.payment_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text,
  public_key text,
  client_id text,
  client_secret text,
  webhook_secret text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_integrations_user_id_idx
  on public.payment_integrations(user_id);

create index if not exists payment_integrations_provider_idx
  on public.payment_integrations(provider);

create unique index if not exists payment_integrations_user_active_unique
  on public.payment_integrations(user_id)
  where is_active;

create or replace function public.ensure_single_active_payment_integration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    update public.payment_integrations
      set is_active = false
    where user_id = new.user_id
      and id <> new.id
      and is_active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_integrations_single_active
  on public.payment_integrations;

create trigger trg_payment_integrations_single_active
  before insert or update of is_active
  on public.payment_integrations
  for each row
  execute function public.ensure_single_active_payment_integration();

drop trigger if exists update_payment_integrations_updated_at
  on public.payment_integrations;

create trigger update_payment_integrations_updated_at
  before update on public.payment_integrations
  for each row
  execute function public.update_updated_at_column();

alter table public.payment_integrations enable row level security;

drop policy if exists "Payment integrations select own"
  on public.payment_integrations;
drop policy if exists "Payment integrations insert own"
  on public.payment_integrations;
drop policy if exists "Payment integrations update own"
  on public.payment_integrations;
drop policy if exists "Payment integrations delete own"
  on public.payment_integrations;

create policy "Payment integrations select own"
  on public.payment_integrations
  for select
  using (auth.uid() = user_id);

create policy "Payment integrations insert own"
  on public.payment_integrations
  for insert
  with check (auth.uid() = user_id);

create policy "Payment integrations update own"
  on public.payment_integrations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Payment integrations delete own"
  on public.payment_integrations
  for delete
  using (auth.uid() = user_id);

alter table public.eventos
  add column if not exists owner_id uuid;

with fallback_profile_user as (
  select p.user_id
  from public.profiles p
  where p.user_id is not null
  order by p.created_at asc
  limit 1
)
update public.eventos e
set owner_id = fp.user_id
from fallback_profile_user fp
where e.owner_id is null;

with fallback_auth_user as (
  select u.id
  from auth.users u
  order by u.created_at asc
  limit 1
)
update public.eventos e
set owner_id = fu.id
from fallback_auth_user fu
where e.owner_id is null;

do $$
begin
  if exists (select 1 from public.eventos where owner_id is null) then
    raise exception
      'Nao foi possivel definir owner_id para todos os eventos existentes.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_owner_id_fkey'
  ) then
    alter table public.eventos
      add constraint eventos_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete restrict;
  end if;
end
$$;

alter table public.eventos
  alter column owner_id set not null;

create index if not exists eventos_owner_id_idx
  on public.eventos(owner_id);

create or replace function public.set_event_owner_on_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;

  if new.owner_id is null then
    raise exception 'owner_id is required';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_event_owner_on_insert
  on public.eventos;

create trigger trg_set_event_owner_on_insert
  before insert on public.eventos
  for each row
  execute function public.set_event_owner_on_insert();

alter table public.pagamentos
  add column if not exists user_id uuid;

alter table public.pagamentos
  add column if not exists integration_id uuid;

update public.pagamentos p
set user_id = e.owner_id
from public.inscricoes i
join public.eventos e on e.id = i.evento_id
where p.inscricao_id = i.id
  and p.user_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pagamentos_user_id_fkey'
  ) then
    alter table public.pagamentos
      add constraint pagamentos_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pagamentos_integration_id_fkey'
  ) then
    alter table public.pagamentos
      add constraint pagamentos_integration_id_fkey
      foreign key (integration_id) references public.payment_integrations(id) on delete set null;
  end if;
end
$$;

drop index if exists pagamentos_provider_payment_unique;

create unique index if not exists pagamentos_provider_payment_unique
  on public.pagamentos(provider, provider_payment_id);

create index if not exists pagamentos_user_id_idx
  on public.pagamentos(user_id);

create index if not exists pagamentos_integration_id_idx
  on public.pagamentos(integration_id);
