-- Add events, districts, churches, lots, registrations, participants, payments, whatsapp sessions

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_inicio date,
  data_fim date,
  local text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distritos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  distrito_id uuid,
  cidade text,
  contato text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  nome text not null,
  valor numeric(10,2) not null,
  inicio date not null,
  fim date not null,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  whatsapp text,
  total numeric(10,2) not null default 0,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null,
  evento_id uuid not null,
  nome text not null,
  cpf text not null,
  nascimento date,
  genero text,
  distrito_id uuid,
  igreja_id uuid,
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null,
  provider text not null,
  provider_payment_id text not null,
  status text not null default 'PENDING',
  copiaecola text,
  qrcode text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  state text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.igrejas
  add constraint igrejas_distrito_id_fkey foreign key (distrito_id) references public.distritos(id) on delete set null;

alter table public.lotes
  add constraint lotes_evento_id_fkey foreign key (evento_id) references public.eventos(id) on delete cascade;

alter table public.inscricoes
  add constraint inscricoes_evento_id_fkey foreign key (evento_id) references public.eventos(id) on delete cascade;

alter table public.participantes
  add constraint participantes_inscricao_id_fkey foreign key (inscricao_id) references public.inscricoes(id) on delete cascade;

alter table public.participantes
  add constraint participantes_evento_id_fkey foreign key (evento_id) references public.eventos(id) on delete cascade;

alter table public.participantes
  add constraint participantes_distrito_id_fkey foreign key (distrito_id) references public.distritos(id) on delete set null;

alter table public.participantes
  add constraint participantes_igreja_id_fkey foreign key (igreja_id) references public.igrejas(id) on delete set null;

alter table public.pagamentos
  add constraint pagamentos_inscricao_id_fkey foreign key (inscricao_id) references public.inscricoes(id) on delete cascade;

create unique index if not exists participantes_evento_cpf_unique on public.participantes(evento_id, cpf);
create unique index if not exists pagamentos_provider_payment_unique on public.pagamentos(provider_payment_id);
create unique index if not exists whatsapp_sessions_phone_unique on public.whatsapp_sessions(phone);

create index if not exists eventos_status_idx on public.eventos(status);
create index if not exists lotes_evento_id_idx on public.lotes(evento_id);
create index if not exists lotes_status_idx on public.lotes(status);
create index if not exists inscricoes_evento_id_idx on public.inscricoes(evento_id);
create index if not exists inscricoes_status_idx on public.inscricoes(status);
create index if not exists participantes_cpf_idx on public.participantes(cpf);
create index if not exists pagamentos_status_idx on public.pagamentos(status);

-- Status constraints
alter table public.eventos
  add constraint eventos_status_check check (status in ('ativo', 'inativo'));

alter table public.lotes
  add constraint lotes_status_check check (status in ('ativo', 'inativo'));

alter table public.inscricoes
  add constraint inscricoes_status_check check (status in ('PENDING', 'PAID', 'CANCELLED'));

alter table public.pagamentos
  add constraint pagamentos_status_check check (status in ('PENDING', 'PAID', 'CANCELLED'));

-- RLS
alter table public.eventos enable row level security;
alter table public.distritos enable row level security;
alter table public.igrejas enable row level security;
alter table public.lotes enable row level security;
alter table public.inscricoes enable row level security;
alter table public.participantes enable row level security;
alter table public.pagamentos enable row level security;
alter table public.whatsapp_sessions enable row level security;

create policy "Eventos select" on public.eventos for select using (auth.role() = 'authenticated');
create policy "Eventos insert" on public.eventos for insert with check (auth.role() = 'authenticated');
create policy "Eventos update" on public.eventos for update using (auth.role() = 'authenticated');
create policy "Eventos delete" on public.eventos for delete using (auth.role() = 'authenticated');

create policy "Distritos select" on public.distritos for select using (auth.role() = 'authenticated');
create policy "Distritos insert" on public.distritos for insert with check (auth.role() = 'authenticated');
create policy "Distritos update" on public.distritos for update using (auth.role() = 'authenticated');
create policy "Distritos delete" on public.distritos for delete using (auth.role() = 'authenticated');

create policy "Igrejas select" on public.igrejas for select using (auth.role() = 'authenticated');
create policy "Igrejas insert" on public.igrejas for insert with check (auth.role() = 'authenticated');
create policy "Igrejas update" on public.igrejas for update using (auth.role() = 'authenticated');
create policy "Igrejas delete" on public.igrejas for delete using (auth.role() = 'authenticated');

create policy "Lotes select" on public.lotes for select using (auth.role() = 'authenticated');
create policy "Lotes insert" on public.lotes for insert with check (auth.role() = 'authenticated');
create policy "Lotes update" on public.lotes for update using (auth.role() = 'authenticated');
create policy "Lotes delete" on public.lotes for delete using (auth.role() = 'authenticated');

create policy "Inscricoes select" on public.inscricoes for select using (auth.role() = 'authenticated');
create policy "Inscricoes insert" on public.inscricoes for insert with check (auth.role() = 'authenticated');
create policy "Inscricoes update" on public.inscricoes for update using (auth.role() = 'authenticated');
create policy "Inscricoes delete" on public.inscricoes for delete using (auth.role() = 'authenticated');

create policy "Participantes select" on public.participantes for select using (auth.role() = 'authenticated');
create policy "Participantes insert" on public.participantes for insert with check (auth.role() = 'authenticated');
create policy "Participantes update" on public.participantes for update using (auth.role() = 'authenticated');
create policy "Participantes delete" on public.participantes for delete using (auth.role() = 'authenticated');

create policy "Pagamentos select" on public.pagamentos for select using (auth.role() = 'authenticated');
create policy "Pagamentos insert" on public.pagamentos for insert with check (auth.role() = 'authenticated');
create policy "Pagamentos update" on public.pagamentos for update using (auth.role() = 'authenticated');
create policy "Pagamentos delete" on public.pagamentos for delete using (auth.role() = 'authenticated');

create policy "Whatsapp sessions select" on public.whatsapp_sessions for select using (auth.role() = 'authenticated');
create policy "Whatsapp sessions insert" on public.whatsapp_sessions for insert with check (auth.role() = 'authenticated');
create policy "Whatsapp sessions update" on public.whatsapp_sessions for update using (auth.role() = 'authenticated');
create policy "Whatsapp sessions delete" on public.whatsapp_sessions for delete using (auth.role() = 'authenticated');

create trigger update_eventos_updated_at
  before update on public.eventos
  for each row
  execute function public.update_updated_at_column();

create trigger update_distritos_updated_at
  before update on public.distritos
  for each row
  execute function public.update_updated_at_column();

create trigger update_igrejas_updated_at
  before update on public.igrejas
  for each row
  execute function public.update_updated_at_column();

create trigger update_lotes_updated_at
  before update on public.lotes
  for each row
  execute function public.update_updated_at_column();

create trigger update_inscricoes_updated_at
  before update on public.inscricoes
  for each row
  execute function public.update_updated_at_column();

create trigger update_participantes_updated_at
  before update on public.participantes
  for each row
  execute function public.update_updated_at_column();

create trigger update_pagamentos_updated_at
  before update on public.pagamentos
  for each row
  execute function public.update_updated_at_column();

create trigger update_whatsapp_sessions_updated_at
  before update on public.whatsapp_sessions
  for each row
  execute function public.update_updated_at_column();
