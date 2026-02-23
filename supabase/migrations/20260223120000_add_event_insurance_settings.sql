alter table public.eventos
  add column if not exists seguro_valor numeric(10,2) not null default 15,
  add column if not exists seguro_obrigatorio boolean not null default false;

update public.eventos
set seguro_valor = 15
where seguro_valor is null
   or seguro_valor < 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_seguro_valor_check'
  ) then
    alter table public.eventos
      add constraint eventos_seguro_valor_check
      check (seguro_valor >= 0);
  end if;
end $$;
