-- Core tables for the gincana app

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inscritos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  numero integer not null,
  nome text not null,
  data_nascimento date,
  idade integer,
  igreja text,
  distrito text,
  foto_url text,
  status_pagamento text,
  is_manual boolean default false,
  numero_original text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  lider text not null,
  vice text not null,
  cor integer not null,
  cor_pulseira text,
  imagem_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gincanas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  categoria text not null,
  ativa boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sorteios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  numero_inscrito integer not null,
  equipe_id uuid not null,
  gincana_id uuid not null,
  data_hora timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.pontuacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  equipe_id uuid not null,
  gincana_id uuid not null,
  pontos integer not null default 0,
  observacao text,
  data_hora timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.sorteios
  add constraint sorteios_equipe_id_fkey foreign key (equipe_id) references public.equipes(id) on delete cascade;

alter table public.sorteios
  add constraint sorteios_gincana_id_fkey foreign key (gincana_id) references public.gincanas(id) on delete cascade;

alter table public.pontuacoes
  add constraint pontuacoes_equipe_id_fkey foreign key (equipe_id) references public.equipes(id) on delete cascade;

alter table public.pontuacoes
  add constraint pontuacoes_gincana_id_fkey foreign key (gincana_id) references public.gincanas(id) on delete cascade;

create index inscritos_user_id_idx on public.inscritos(user_id);
create index equipes_user_id_idx on public.equipes(user_id);
create index gincanas_user_id_idx on public.gincanas(user_id);
create index sorteios_user_id_idx on public.sorteios(user_id);
create index sorteios_gincana_id_idx on public.sorteios(gincana_id);
create index sorteios_equipe_id_idx on public.sorteios(equipe_id);
create index pontuacoes_user_id_idx on public.pontuacoes(user_id);
create index pontuacoes_gincana_id_idx on public.pontuacoes(gincana_id);
create index pontuacoes_equipe_id_idx on public.pontuacoes(equipe_id);
create index profiles_user_id_idx on public.profiles(user_id);

alter table public.profiles enable row level security;
alter table public.inscritos enable row level security;
alter table public.equipes enable row level security;
alter table public.gincanas enable row level security;
alter table public.sorteios enable row level security;
alter table public.pontuacoes enable row level security;

create policy "Profiles select own" on public.profiles for select using (auth.uid() = user_id);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = user_id);
create policy "Profiles delete own" on public.profiles for delete using (auth.uid() = user_id);

create policy "Inscritos select own" on public.inscritos for select using (auth.uid() = user_id);
create policy "Inscritos insert own" on public.inscritos for insert with check (auth.uid() = user_id);
create policy "Inscritos update own" on public.inscritos for update using (auth.uid() = user_id);
create policy "Inscritos delete own" on public.inscritos for delete using (auth.uid() = user_id);

create policy "Equipes select own" on public.equipes for select using (auth.uid() = user_id);
create policy "Equipes insert own" on public.equipes for insert with check (auth.uid() = user_id);
create policy "Equipes update own" on public.equipes for update using (auth.uid() = user_id);
create policy "Equipes delete own" on public.equipes for delete using (auth.uid() = user_id);

create policy "Gincanas select own" on public.gincanas for select using (auth.uid() = user_id);
create policy "Gincanas insert own" on public.gincanas for insert with check (auth.uid() = user_id);
create policy "Gincanas update own" on public.gincanas for update using (auth.uid() = user_id);
create policy "Gincanas delete own" on public.gincanas for delete using (auth.uid() = user_id);

create policy "Sorteios select own" on public.sorteios for select using (auth.uid() = user_id);
create policy "Sorteios insert own" on public.sorteios for insert with check (auth.uid() = user_id);
create policy "Sorteios update own" on public.sorteios for update using (auth.uid() = user_id);
create policy "Sorteios delete own" on public.sorteios for delete using (auth.uid() = user_id);

create policy "Pontuacoes select own" on public.pontuacoes for select using (auth.uid() = user_id);
create policy "Pontuacoes insert own" on public.pontuacoes for insert with check (auth.uid() = user_id);
create policy "Pontuacoes update own" on public.pontuacoes for update using (auth.uid() = user_id);
create policy "Pontuacoes delete own" on public.pontuacoes for delete using (auth.uid() = user_id);

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

create trigger update_inscritos_updated_at
  before update on public.inscritos
  for each row
  execute function public.update_updated_at_column();

create trigger update_equipes_updated_at
  before update on public.equipes
  for each row
  execute function public.update_updated_at_column();

create trigger update_gincanas_updated_at
  before update on public.gincanas
  for each row
  execute function public.update_updated_at_column();
