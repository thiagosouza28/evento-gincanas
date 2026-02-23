-- Additional indexes to reduce timeout on frequently filtered/sorted queries.

create index if not exists idx_sorteios_user_data_hora_desc
  on public.sorteios (user_id, data_hora desc);

create index if not exists idx_pontuacoes_user_data_hora_desc
  on public.pontuacoes (user_id, data_hora desc);

create index if not exists idx_profiles_user_id
  on public.profiles (user_id);

create index if not exists idx_eventos_owner_status_inicio_created
  on public.eventos (owner_id, status, data_inicio desc, created_at desc);

create index if not exists idx_lotes_evento_inicio_desc
  on public.lotes (evento_id, inicio desc);

create index if not exists idx_inscritos_user_numero_original
  on public.inscritos (user_id, numero_original);
