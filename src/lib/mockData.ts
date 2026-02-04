import type { Inscrito, Equipe, Gincana, Pontuacao } from '@/types';
import { calcularIdade } from '@/types';

// Helper para criar inscrito com idade calculada
const createInscrito = (numero: number, nome: string, dataNascimento: string, igreja: string, distrito: string): Inscrito => ({
  numero,
  nome,
  dataNascimento,
  idade: calcularIdade(dataNascimento),
  igreja,
  distrito,
  statusPagamento: 'PAID',
  isManual: false,
  numeroPulseira: String(numero),
});

// 50 inscritos fictícios
export const mockInscritos: Inscrito[] = [
  createInscrito(1, "Ana Carolina Silva", "2005-03-15", "Central", "Norte"),
  createInscrito(2, "Bruno Santos Costa", "2004-07-22", "Esperança", "Sul"),
  createInscrito(3, "Camila Oliveira", "2006-01-10", "Vida Nova", "Leste"),
  createInscrito(4, "Daniel Ferreira Lima", "2003-11-28", "Monte Sinai", "Oeste"),
  createInscrito(5, "Eduarda Martins", "2007-05-03", "Betel", "Norte"),
  createInscrito(6, "Felipe Rodrigues", "2004-09-17", "Central", "Sul"),
  createInscrito(7, "Gabriela Almeida", "2005-12-25", "Shalom", "Leste"),
  createInscrito(8, "Henrique Pereira", "2006-08-14", "Maranata", "Oeste"),
  createInscrito(9, "Isabela Souza", "2003-04-30", "Esperança", "Norte"),
  createInscrito(10, "João Pedro Nunes", "2007-02-19", "Vida Nova", "Sul"),
  createInscrito(11, "Larissa Costa", "2004-10-08", "Monte Sinai", "Leste"),
  createInscrito(12, "Lucas Gabriel", "2005-06-12", "Betel", "Oeste"),
  createInscrito(13, "Mariana Santos", "2006-03-27", "Central", "Norte"),
  createInscrito(14, "Nicolas Oliveira", "2003-09-05", "Shalom", "Sul"),
  createInscrito(15, "Olivia Fernandes", "2007-07-16", "Maranata", "Leste"),
  createInscrito(16, "Pedro Henrique", "2004-01-23", "Esperança", "Oeste"),
  createInscrito(17, "Rafaela Lima", "2005-11-09", "Vida Nova", "Norte"),
  createInscrito(18, "Samuel Martins", "2006-04-18", "Monte Sinai", "Sul"),
  createInscrito(19, "Thais Almeida", "2003-08-02", "Betel", "Leste"),
  createInscrito(20, "Vinícius Pereira", "2007-12-11", "Central", "Oeste"),
  createInscrito(21, "Amanda Rodrigues", "2004-05-26", "Shalom", "Norte"),
  createInscrito(22, "Bernardo Costa", "2005-02-14", "Maranata", "Sul"),
  createInscrito(23, "Carolina Souza", "2006-09-30", "Esperança", "Leste"),
  createInscrito(24, "Davi Santos", "2003-06-07", "Vida Nova", "Oeste"),
  createInscrito(25, "Emanuele Oliveira", "2007-10-21", "Monte Sinai", "Norte"),
  createInscrito(26, "Fernando Lima", "2004-03-13", "Betel", "Sul"),
  createInscrito(27, "Giovana Martins", "2005-08-29", "Central", "Leste"),
  createInscrito(28, "Heitor Almeida", "2006-01-04", "Shalom", "Oeste"),
  createInscrito(29, "Isadora Pereira", "2003-12-17", "Maranata", "Norte"),
  createInscrito(30, "João Lucas", "2007-04-06", "Esperança", "Sul"),
  createInscrito(31, "Letícia Costa", "2004-07-24", "Vida Nova", "Leste"),
  createInscrito(32, "Matheus Santos", "2005-10-15", "Monte Sinai", "Oeste"),
  createInscrito(33, "Natália Oliveira", "2006-06-22", "Betel", "Norte"),
  createInscrito(34, "Otávio Lima", "2003-02-28", "Central", "Sul"),
  createInscrito(35, "Patrícia Martins", "2007-09-10", "Shalom", "Leste"),
  createInscrito(36, "Rafael Almeida", "2004-11-03", "Maranata", "Oeste"),
  createInscrito(37, "Sofia Pereira", "2005-05-19", "Esperança", "Norte"),
  createInscrito(38, "Thiago Santos", "2006-12-08", "Vida Nova", "Sul"),
  createInscrito(39, "Valentina Costa", "2003-07-14", "Monte Sinai", "Leste"),
  createInscrito(40, "William Oliveira", "2007-01-27", "Betel", "Oeste"),
  createInscrito(41, "Yasmin Lima", "2004-04-11", "Central", "Norte"),
  createInscrito(42, "Arthur Martins", "2005-09-06", "Shalom", "Sul"),
  createInscrito(43, "Beatriz Almeida", "2006-02-23", "Maranata", "Leste"),
  createInscrito(44, "Caio Pereira", "2003-10-31", "Esperança", "Oeste"),
  createInscrito(45, "Diana Santos", "2007-06-15", "Vida Nova", "Norte"),
  createInscrito(46, "Enzo Costa", "2004-12-02", "Monte Sinai", "Sul"),
  createInscrito(47, "Fernanda Oliveira", "2005-03-20", "Betel", "Leste"),
  createInscrito(48, "Guilherme Lima", "2006-08-09", "Central", "Oeste"),
  createInscrito(49, "Helena Martins", "2003-05-25", "Shalom", "Norte"),
  createInscrito(50, "Igor Almeida", "2007-11-18", "Maranata", "Sul"),
];

// 8 equipes pré-configuradas
export const mockEquipes: Equipe[] = [
  { id: "eq-1", numero: 1, nome: "Leões de Judá", lider: "Pastor Carlos", vice: "Maria Silva", cor: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-2", numero: 2, nome: "Águias do Altíssimo", lider: "Diácono Pedro", vice: "Ana Costa", cor: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-3", numero: 3, nome: "Guerreiros da Fé", lider: "Líder João", vice: "Paula Santos", cor: 3, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-4", numero: 4, nome: "Exército do Rei", lider: "Presbítero Lucas", vice: "Carla Lima", cor: 4, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-5", numero: 5, nome: "Fortaleza de Deus", lider: "Evangelista André", vice: "Julia Martins", cor: 5, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-6", numero: 6, nome: "Soldados de Cristo", lider: "Missionário Tiago", vice: "Fernanda Alves", cor: 6, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-7", numero: 7, nome: "Vencedores", lider: "Pastor Marcos", vice: "Renata Souza", cor: 7, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "eq-8", numero: 8, nome: "Embaixadores do Céu", lider: "Diácono Felipe", vice: "Gabriela Nunes", cor: 8, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];

// 2 gincanas de exemplo
export const mockGincanas: Gincana[] = [
  { 
    id: "gin-1", 
    nome: "Futebol Masculino", 
    categoria: "adulto_homem", 
    ativa: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  },
  { 
    id: "gin-2", 
    nome: "Vôlei Feminino", 
    categoria: "adulto_mulher", 
    ativa: false,
    createdAt: "2023-07-01",
    updatedAt: "2023-07-15"
  },
];

// Pontuações de demonstração
export const mockPontuacoes: Pontuacao[] = [
  { id: "pt-1", gincanaId: "gin-1", equipeId: "eq-1", pontos: 150, observacao: "Corrida de revezamento", dataHora: "2024-01-20T10:00:00" },
  { id: "pt-2", gincanaId: "gin-1", equipeId: "eq-2", pontos: 200, observacao: "Quiz bíblico", dataHora: "2024-01-20T10:30:00" },
  { id: "pt-3", gincanaId: "gin-1", equipeId: "eq-3", pontos: 175, observacao: "Gincana de hinos", dataHora: "2024-01-20T11:00:00" },
  { id: "pt-4", gincanaId: "gin-1", equipeId: "eq-4", pontos: 125, dataHora: "2024-01-20T11:30:00" },
  { id: "pt-5", gincanaId: "gin-1", equipeId: "eq-5", pontos: 180, observacao: "Desafio de versículos", dataHora: "2024-01-20T12:00:00" },
  { id: "pt-6", gincanaId: "gin-1", equipeId: "eq-6", pontos: 160, dataHora: "2024-01-20T12:30:00" },
  { id: "pt-7", gincanaId: "gin-1", equipeId: "eq-7", pontos: 190, observacao: "Prova de teatro", dataHora: "2024-01-20T13:00:00" },
  { id: "pt-8", gincanaId: "gin-1", equipeId: "eq-8", pontos: 140, dataHora: "2024-01-20T13:30:00" },
  { id: "pt-9", gincanaId: "gin-1", equipeId: "eq-1", pontos: -20, observacao: "Penalidade por atraso", dataHora: "2024-01-20T14:00:00" },
  { id: "pt-10", gincanaId: "gin-1", equipeId: "eq-2", pontos: 100, observacao: "Bônus criatividade", dataHora: "2024-01-20T14:30:00" },
];
