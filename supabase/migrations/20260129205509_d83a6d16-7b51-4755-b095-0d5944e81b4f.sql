-- Tabela de torneios (vinculada a uma gincana/modalidade)
CREATE TABLE public.torneios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gincana_id TEXT NOT NULL, -- ID da gincana local (IndexedDB)
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'finalizado')),
  pontos_primeiro INTEGER NOT NULL DEFAULT 100,
  pontos_segundo INTEGER NOT NULL DEFAULT 70,
  pontos_terceiro INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de confrontos
CREATE TABLE public.confrontos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  torneio_id UUID NOT NULL REFERENCES public.torneios(id) ON DELETE CASCADE,
  fase TEXT NOT NULL CHECK (fase IN ('quartas', 'semifinal', 'terceiro_lugar', 'final')),
  ordem INTEGER NOT NULL, -- Ordem do confronto na fase (1, 2, 3, 4 para quartas, etc)
  equipe1_id TEXT, -- ID da equipe local (IndexedDB)
  equipe2_id TEXT, -- ID da equipe local (IndexedDB)
  vencedor_id TEXT, -- ID da equipe vencedora
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.torneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confrontos ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (sem autenticação conforme solicitado)
CREATE POLICY "Todos podem visualizar torneios" ON public.torneios FOR SELECT USING (true);
CREATE POLICY "Todos podem criar torneios" ON public.torneios FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar torneios" ON public.torneios FOR UPDATE USING (true);
CREATE POLICY "Todos podem deletar torneios" ON public.torneios FOR DELETE USING (true);

CREATE POLICY "Todos podem visualizar confrontos" ON public.confrontos FOR SELECT USING (true);
CREATE POLICY "Todos podem criar confrontos" ON public.confrontos FOR INSERT WITH CHECK (true);
CREATE POLICY "Todos podem atualizar confrontos" ON public.confrontos FOR UPDATE USING (true);
CREATE POLICY "Todos podem deletar confrontos" ON public.confrontos FOR DELETE USING (true);

-- Enable realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.torneios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confrontos;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_torneios_updated_at
  BEFORE UPDATE ON public.torneios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_confrontos_updated_at
  BEFORE UPDATE ON public.confrontos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();