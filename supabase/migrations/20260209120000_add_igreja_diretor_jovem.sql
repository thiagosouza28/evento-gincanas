alter table public.igrejas
  add column if not exists diretor_jovem_nome text,
  add column if not exists diretor_jovem_cpf text,
  add column if not exists diretor_jovem_telefone text,
  add column if not exists diretor_jovem_email text,
  add column if not exists diretor_jovem_cargo text not null default 'Diretor Jovem';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'igrejas_diretor_jovem_cargo_check'
  ) then
    alter table public.igrejas
      add constraint igrejas_diretor_jovem_cargo_check
      check (diretor_jovem_cargo = 'Diretor Jovem');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'igrejas_diretor_jovem_cpf_format_check'
  ) then
    alter table public.igrejas
      add constraint igrejas_diretor_jovem_cpf_format_check
      check (diretor_jovem_cpf is null or diretor_jovem_cpf ~ '^[0-9]{11}$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'igrejas_diretor_jovem_telefone_format_check'
  ) then
    alter table public.igrejas
      add constraint igrejas_diretor_jovem_telefone_format_check
      check (diretor_jovem_telefone is null or diretor_jovem_telefone ~ '^[0-9]{10,11}$');
  end if;
end $$;

create unique index if not exists igrejas_diretor_jovem_cpf_unique
  on public.igrejas (diretor_jovem_cpf)
  where diretor_jovem_cpf is not null;
