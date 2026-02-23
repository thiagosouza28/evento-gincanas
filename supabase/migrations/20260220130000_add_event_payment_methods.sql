alter table public.eventos
  add column if not exists formas_pagamento text[] not null default array['pix'];

update public.eventos
set formas_pagamento = array['pix']
where formas_pagamento is null
   or cardinality(formas_pagamento) = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eventos_formas_pagamento_check'
  ) then
    alter table public.eventos
      add constraint eventos_formas_pagamento_check
      check (
        formas_pagamento <@ array['pix', 'manual']::text[]
        and cardinality(formas_pagamento) > 0
      );
  end if;
end $$;
