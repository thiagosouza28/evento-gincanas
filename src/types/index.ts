// Tipos base do sistema de gincanas

export interface Inscrito {
  numero: number;
  nome: string;
  dataNascimento: string;
  idade: number;
  igreja: string;
  distrito: string;
  fotoUrl?: string;
  statusPagamento: 'PAID' | 'PENDING' | 'CANCELLED' | 'MANUAL';
  isManual?: boolean; // Inscrito adicionado manualmente
  numeroOriginal?: string; // Número original do banco de dados externo
  numeroPulseira?: string; // Numero da pulseira (igual ao numero da lista)
}

export interface Equipe {
  id: string;
  numero: number; // Numero identificador unico da equipe
  nome: string;
  lider: string;
  vice: string;
  cor: number; // 1-8 para cores do tema
  corPulseira?: string; // Cor hexadecimal da pulseira
  imagemUrl?: string; // URL da imagem/logo da equipe
  createdAt: string;
  updatedAt: string;
}

export interface Sorteio {
  id: string;
  numeroInscrito: number;
  equipeId: string;
  gincanaId: string;
  dataHora: string;
}

export type CategoriaGincana = 'adulto' | 'adulto_mulher' | 'adulto_homem' | 'criancas';

export interface Gincana {
  id: string;
  nome: string;
  categoria: CategoriaGincana;
  ativa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pontuacao {
  id: string;
  gincanaId: string;
  equipeId: string;
  pontos: number;
  observacao?: string;
  dataHora: string;
  numeroInscrito?: number; // Participante vinculado ao lancamento (opcional)
}

export interface SyncQueue {
  id: string;
  type: 'equipe' | 'sorteio' | 'gincana' | 'pontuacao';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: string;
  synced: boolean;
}

export interface ApiConfig {
  baseUrl: string;
  token: string;
  lastSync?: string;
}

export interface SystemConfig {
  minEquipes: number;
}

export interface EquipeComParticipantes extends Equipe {
  participantes: number;
  pontuacaoTotal: number;
}

// Utilitário para calcular idade
export function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth();
  const mesNascimento = nascimento.getMonth();
  
  if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  
  return idade;
}
