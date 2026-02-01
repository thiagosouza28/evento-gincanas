import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Inscrito, Equipe, Sorteio, Gincana, Pontuacao, SyncQueue, ApiConfig } from '@/types';
import { createId } from '@/lib/id';

interface GincanaDB extends DBSchema {
  inscritos: {
    key: number;
    value: Inscrito;
    indexes: { 'by-nome': string };
  };
  equipes: {
    key: string;
    value: Equipe;
  };
  sorteios: {
    key: string;
    value: Sorteio;
    indexes: { 
      'by-inscrito': number;
      'by-equipe': string;
      'by-gincana': string;
    };
  };
  gincanas: {
    key: string;
    value: Gincana;
  };
  pontuacoes: {
    key: string;
    value: Pontuacao;
    indexes: { 
      'by-equipe': string;
      'by-gincana': string;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueue;
    indexes: { 'by-synced': number };
  };
  config: {
    key: string;
    value: ApiConfig;
  };
}

let dbInstance: IDBPDatabase<GincanaDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<GincanaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GincanaDB>('gincana-db', 1, {
    upgrade(db) {
      // Inscritos (somente leitura - cache da API)
      const inscritosStore = db.createObjectStore('inscritos', { keyPath: 'numero' });
      inscritosStore.createIndex('by-nome', 'nome');

      // Equipes
      db.createObjectStore('equipes', { keyPath: 'id' });

      // Sorteios
      const sorteiosStore = db.createObjectStore('sorteios', { keyPath: 'id' });
      sorteiosStore.createIndex('by-inscrito', 'numeroInscrito');
      sorteiosStore.createIndex('by-equipe', 'equipeId');
      sorteiosStore.createIndex('by-gincana', 'gincanaId');

      // Gincanas
      db.createObjectStore('gincanas', { keyPath: 'id' });

      // Pontuações
      const pontuacoesStore = db.createObjectStore('pontuacoes', { keyPath: 'id' });
      pontuacoesStore.createIndex('by-equipe', 'equipeId');
      pontuacoesStore.createIndex('by-gincana', 'gincanaId');

      // Fila de sincronização
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-synced', 'synced');

      // Configurações
      db.createObjectStore('config', { keyPath: 'baseUrl' });
    },
  });

  return dbInstance;
}

// ============== INSCRITOS (Somente Leitura) ==============

export async function getAllInscritos(): Promise<Inscrito[]> {
  const db = await getDB();
  return db.getAll('inscritos');
}

export async function getInscrito(numero: number): Promise<Inscrito | undefined> {
  const db = await getDB();
  return db.get('inscritos', numero);
}

export async function saveInscritos(inscritos: Inscrito[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('inscritos', 'readwrite');
  await Promise.all([
    ...inscritos.map(i => tx.store.put(i)),
    tx.done,
  ]);
}

export async function saveInscrito(inscrito: Inscrito): Promise<void> {
  const db = await getDB();
  await db.put('inscritos', inscrito);
}

export async function deleteInscrito(numero: number): Promise<void> {
  const db = await getDB();
  await db.delete('inscritos', numero);
}

export async function countInscritos(): Promise<number> {
  const db = await getDB();
  return db.count('inscritos');
}

// ============== EQUIPES ==============

export async function getAllEquipes(): Promise<Equipe[]> {
  const db = await getDB();
  return db.getAll('equipes');
}

export async function getEquipe(id: string): Promise<Equipe | undefined> {
  const db = await getDB();
  return db.get('equipes', id);
}

export async function saveEquipe(equipe: Equipe): Promise<void> {
  const db = await getDB();
  await db.put('equipes', equipe);
  await addToSyncQueue('equipe', 'update', equipe);
}

export async function deleteEquipe(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('equipes', id);
  await addToSyncQueue('equipe', 'delete', { id });
}

// ============== SORTEIOS ==============

export async function getAllSorteios(): Promise<Sorteio[]> {
  const db = await getDB();
  return db.getAll('sorteios');
}

export async function getSorteioByInscrito(numeroInscrito: number): Promise<Sorteio | undefined> {
  const db = await getDB();
  const sorteios = await db.getAllFromIndex('sorteios', 'by-inscrito', numeroInscrito);
  return sorteios[0];
}

export async function getSorteiosByEquipe(equipeId: string): Promise<Sorteio[]> {
  const db = await getDB();
  return db.getAllFromIndex('sorteios', 'by-equipe', equipeId);
}

export async function getSorteiosByGincana(gincanaId: string): Promise<Sorteio[]> {
  const db = await getDB();
  return db.getAllFromIndex('sorteios', 'by-gincana', gincanaId);
}

export async function saveSorteio(sorteio: Sorteio): Promise<void> {
  const db = await getDB();
  await db.put('sorteios', sorteio);
  await addToSyncQueue('sorteio', 'create', sorteio);
}

export async function countSorteiosByEquipe(equipeId: string): Promise<number> {
  const db = await getDB();
  const sorteios = await db.getAllFromIndex('sorteios', 'by-equipe', equipeId);
  return sorteios.length;
}

// ============== GINCANAS ==============

export async function getAllGincanas(): Promise<Gincana[]> {
  const db = await getDB();
  return db.getAll('gincanas');
}

export async function getGincana(id: string): Promise<Gincana | undefined> {
  const db = await getDB();
  return db.get('gincanas', id);
}

export async function getGincanaAtiva(): Promise<Gincana | undefined> {
  const db = await getDB();
  const gincanas = await db.getAll('gincanas');
  return gincanas.find(g => g.ativa);
}

export async function saveGincana(gincana: Gincana): Promise<void> {
  const db = await getDB();
  await db.put('gincanas', gincana);
  await addToSyncQueue('gincana', 'update', gincana);
}

export async function deleteGincana(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('gincanas', id);
  await addToSyncQueue('gincana', 'delete', { id });
}

export async function setGincanaAtiva(id: string): Promise<void> {
  const db = await getDB();
  const gincanas = await db.getAll('gincanas');
  const tx = db.transaction('gincanas', 'readwrite');
  
  for (const gincana of gincanas) {
    await tx.store.put({ ...gincana, ativa: gincana.id === id, updatedAt: new Date().toISOString() });
  }
  
  await tx.done;
}

// ============== PONTUAÇÕES ==============

export async function getAllPontuacoes(): Promise<Pontuacao[]> {
  const db = await getDB();
  return db.getAll('pontuacoes');
}

export async function getPontuacoesByGincana(gincanaId: string): Promise<Pontuacao[]> {
  const db = await getDB();
  return db.getAllFromIndex('pontuacoes', 'by-gincana', gincanaId);
}

export async function getPontuacoesByEquipe(equipeId: string): Promise<Pontuacao[]> {
  const db = await getDB();
  return db.getAllFromIndex('pontuacoes', 'by-equipe', equipeId);
}

export async function savePontuacao(pontuacao: Pontuacao): Promise<void> {
  const db = await getDB();
  await db.put('pontuacoes', pontuacao);
  await addToSyncQueue('pontuacao', 'create', pontuacao);
}

export async function getTotalPontosByEquipe(equipeId: string, gincanaId?: string): Promise<number> {
  const db = await getDB();
  let pontuacoes: Pontuacao[];
  
  if (gincanaId) {
    pontuacoes = await db.getAllFromIndex('pontuacoes', 'by-gincana', gincanaId);
    pontuacoes = pontuacoes.filter(p => p.equipeId === equipeId);
  } else {
    pontuacoes = await db.getAllFromIndex('pontuacoes', 'by-equipe', equipeId);
  }
  
  return pontuacoes.reduce((total, p) => total + p.pontos, 0);
}

// ============== SYNC QUEUE ==============

async function addToSyncQueue(type: SyncQueue['type'], action: SyncQueue['action'], data: unknown): Promise<void> {
  const db = await getDB();
  const syncItem: SyncQueue = {
    id: createId(),
    type,
    action,
    data,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  await db.put('syncQueue', syncItem);
}

export async function getPendingSyncItems(): Promise<SyncQueue[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-synced', 0);
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    await db.put('syncQueue', { ...item, synced: true });
  }
}

// ============== CONFIG ==============

export async function getApiConfig(): Promise<ApiConfig | undefined> {
  const db = await getDB();
  const configs = await db.getAll('config');
  return configs[0];
}

export async function saveApiConfig(config: ApiConfig): Promise<void> {
  const db = await getDB();
  await db.put('config', config);
}
