-- Add team numbers and participant bracelet numbers

ALTER TABLE public.equipes
ADD COLUMN numero integer;

WITH ordered AS (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.equipes
)
UPDATE public.equipes e
SET numero = ordered.rn
FROM ordered
WHERE e.id = ordered.id;

ALTER TABLE public.equipes
ALTER COLUMN numero SET NOT NULL;

ALTER TABLE public.equipes
ADD CONSTRAINT equipes_user_numero_unique UNIQUE (user_id, numero);

ALTER TABLE public.inscritos
ADD COLUMN numero_pulseira text;

UPDATE public.inscritos
SET numero_pulseira = COALESCE(numero_original, numero::text)
WHERE numero_pulseira IS NULL;

ALTER TABLE public.inscritos
ALTER COLUMN numero_pulseira SET NOT NULL;

CREATE INDEX IF NOT EXISTS inscritos_user_numero_pulseira_idx
ON public.inscritos (user_id, numero_pulseira);
