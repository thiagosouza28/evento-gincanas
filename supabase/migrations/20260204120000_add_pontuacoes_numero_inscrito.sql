-- Add optional participant reference to pontuacoes history

alter table public.pontuacoes
  add column if not exists numero_inscrito integer;

create index if not exists pontuacoes_numero_inscrito_idx
  on public.pontuacoes(user_id, numero_inscrito);
