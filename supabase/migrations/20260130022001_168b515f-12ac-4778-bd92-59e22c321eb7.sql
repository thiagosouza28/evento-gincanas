-- Adicionar coluna para pontos de participação (equipes eliminadas nas quartas)
ALTER TABLE public.torneios 
ADD COLUMN pontos_participacao integer NOT NULL DEFAULT 0;