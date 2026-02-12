alter table public.eventos
  add column if not exists slug text;

create unique index if not exists eventos_slug_unique on public.eventos (slug)
  where slug is not null;
