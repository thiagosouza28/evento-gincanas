create or replace function public.get_default_user_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select user_id from public.profiles order by created_at asc limit 1
$$;

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
begin
  v_user := public.get_default_user_id();
  if v_user is null then
    return coalesce(new, old);
  end if;

  if (TG_OP = 'DELETE') then
    delete from public.inscritos
      where user_id = v_user and numero_original = old.id;
    return old;
  end if;

  select nome into v_igreja from public.igrejas where id = new.igreja_id;
  select nome into v_distrito from public.distritos where id = new.distrito_id;

  if exists (
    select 1 from public.inscritos
      where user_id = v_user and numero_original = new.id
  ) then
    update public.inscritos
      set nome = new.nome,
          data_nascimento = new.nascimento,
          idade = case
            when new.nascimento is null then 0
            else date_part('year', age(current_date, new.nascimento))::int
          end,
          igreja = coalesce(v_igreja, 'Nao informado'),
          distrito = coalesce(v_distrito, 'Nao informado')
      where user_id = v_user and numero_original = new.id;
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
      numero_pulseira
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
      new.id,
      v_numero::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inscritos_from_participantes on public.participantes;

create trigger sync_inscritos_from_participantes
after insert or update or delete on public.participantes
for each row execute function public.sync_inscritos_from_participantes();
