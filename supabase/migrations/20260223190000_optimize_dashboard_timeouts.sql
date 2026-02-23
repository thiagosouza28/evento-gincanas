-- Dashboard query optimization for user-scoped reads
-- Helps PostgREST requests with filters/order like:
--   inscritos:  where user_id = ? order by numero
--   equipes:    where user_id = ? order by nome
--   gincanas:   where user_id = ? order by created_at desc
--   sorteios:   where user_id = ?
--   pontuacoes: where user_id = ? [and gincana_id = ?]

create index if not exists inscritos_user_numero_idx
  on public.inscritos (user_id, numero);

create index if not exists equipes_user_nome_idx
  on public.equipes (user_id, nome);

create index if not exists gincanas_user_created_at_idx
  on public.gincanas (user_id, created_at desc);

create index if not exists sorteios_user_equipe_idx
  on public.sorteios (user_id, equipe_id);

create index if not exists pontuacoes_user_gincana_equipe_idx
  on public.pontuacoes (user_id, gincana_id, equipe_id);
