// Tipos para o módulo de torneios eliminatórios

export type FaseConfronto = 'quartas' | 'semifinal' | 'terceiro_lugar' | 'final';
export type StatusTorneio = 'pendente' | 'em_andamento' | 'finalizado';

export interface Torneio {
  id: string;
  gincana_id: string;
  nome: string;
  status: StatusTorneio;
  pontos_primeiro: number;
  pontos_segundo: number;
  pontos_terceiro: number;
  pontos_participacao: number;
  created_at: string;
  updated_at: string;
}

export interface Confronto {
  id: string;
  torneio_id: string;
  fase: FaseConfronto;
  ordem: number;
  equipe1_id: string | null;
  equipe2_id: string | null;
  vencedor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfrontoComEquipes extends Confronto {
  equipe1_nome?: string;
  equipe2_nome?: string;
  equipe1_cor?: string;
  equipe2_cor?: string;
  equipe1_imagem?: string;
  equipe2_imagem?: string;
  vencedor_nome?: string;
}

export interface TorneioComGincana extends Torneio {
  gincana_nome?: string;
}

// Resultado do torneio com colocações
export interface ResultadoTorneio {
  primeiro: string | null;
  segundo: string | null;
  terceiro: string | null;
  quarto: string | null;
}
