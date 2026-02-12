do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'participantes_cpf_format_check'
  ) then
    alter table public.participantes
      add constraint participantes_cpf_format_check
      check (cpf ~ '^[0-9]{11}$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'participantes_telefone_format_check'
  ) then
    alter table public.participantes
      add constraint participantes_telefone_format_check
      check (telefone is null or telefone ~ '^[0-9]{10,11}$');
  end if;
end $$;
