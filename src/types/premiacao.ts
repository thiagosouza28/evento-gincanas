// Tipos para o módulo de Premiação

export interface PremiacaoHistorico {
  id: string;
  type: 'participante' | 'equipe';
  participanteNumero?: number;
  participanteNome?: string;
  equipeId?: string;
  equipeNome?: string;
  descricaoPremio: string;
  dataHora: string;
}
