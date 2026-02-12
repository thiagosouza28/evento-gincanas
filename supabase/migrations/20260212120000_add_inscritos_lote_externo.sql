-- Store lot data from external system (MySQL sync)

alter table public.inscritos
  add column if not exists lote_externo_id text,
  add column if not exists lote_externo_nome text;

create index if not exists inscritos_lote_externo_id_idx on public.inscritos(lote_externo_id);
