-- Add lote_id to inscritos and sync it from participantes/inscricoes

alter table public.inscritos
  add column if not exists lote_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inscritos_lote_id_fkey'
  ) then
    alter table public.inscritos
      add constraint inscritos_lote_id_fkey
      foreign key (lote_id) references public.lotes(id) on delete set null;
  end if;
end $$;

create index if not exists inscritos_lote_id_idx on public.inscritos(lote_id);

update public.inscritos i
set lote_id = l.id
from public.participantes p
left join public.inscricoes ins on ins.id = p.inscricao_id
left join lateral (
  select lt.id
  from public.lotes lt
  where lt.evento_id = p.evento_id
    and coalesce(ins.created_at::date, p.created_at::date) between lt.inicio and lt.fim
  order by lt.inicio desc
  limit 1
) l on true
where i.numero_original = p.id::text;

create or replace function public.sync_inscritos_from_participantes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_numero integer;
  v_igreja text;
  v_distrito text;
  v_lote_id uuid;
  v_inscricao_data date;
begin
  v_user := public.get_default_user_id();
  if v_user is null then
    return coalesce(new, old);
  end if;

  if (TG_OP = 'DELETE') then
    delete from public.inscritos
      where user_id = v_user and numero_original = old.id::text;
    return old;
  end if;

  select nome into v_igreja from public.igrejas where id = new.igreja_id;
  select nome into v_distrito from public.distritos where id = new.distrito_id;

  select i.created_at::date into v_inscricao_data
    from public.inscricoes i
    where i.id = new.inscricao_id;

  if v_inscricao_data is null then
    v_inscricao_data := new.created_at::date;
  end if;

  select l.id into v_lote_id
    from public.lotes l
    where l.evento_id = new.evento_id
      and v_inscricao_data between l.inicio and l.fim
    order by l.inicio desc
    limit 1;

  if exists (
    select 1 from public.inscritos
      where user_id = v_user and numero_original = new.id::text
  ) then
    update public.inscritos
      set nome = new.nome,
          data_nascimento = new.nascimento,
          idade = case
            when new.nascimento is null then 0
            else date_part('year', age(current_date, new.nascimento))::int
          end,
          igreja = coalesce(v_igreja, 'Nao informado'),
          distrito = coalesce(v_distrito, 'Nao informado'),
          lote_id = v_lote_id
      where user_id = v_user and numero_original = new.id::text;
  else
    select coalesce(max(numero), 0) + 1
      into v_numero
      from public.inscritos
      where user_id = v_user;

    insert into public.inscritos (
      user_id,
      numero,
      nome,
      data_nascimento,
      idade,
      igreja,
      distrito,
      foto_url,
      status_pagamento,
      is_manual,
      numero_original,
      numero_pulseira,
      lote_id
    ) values (
      v_user,
      v_numero,
      new.nome,
      new.nascimento,
      case
        when new.nascimento is null then 0
        else date_part('year', age(current_date, new.nascimento))::int
      end,
      coalesce(v_igreja, 'Nao informado'),
      coalesce(v_distrito, 'Nao informado'),
      null,
      'PENDING',
      false,
      new.id::text,
      v_numero::text,
      v_lote_id
    );
  end if;

  return new;
end;
$$;
