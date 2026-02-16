import type { Inscrito } from '@/types';

export type LoteOrigem = 'LOCAL' | 'EXTERNO' | 'SEM_LOTE';

export interface LoteLookup {
  id: string;
  nome: string;
  eventoNome?: string | null;
}

export interface LoteResumo {
  key: string;
  nome: string;
  origem: LoteOrigem;
  totalInscritos: number;
  totalCanceladas: number;
}

function isCancelled(status: Inscrito['statusPagamento'] | string | undefined): boolean {
  return String(status || '').toUpperCase() === 'CANCELLED';
}

function getLocalLoteNome(loteId: string, lotesById?: Map<string, LoteLookup>): string {
  const lote = lotesById?.get(loteId);
  if (!lote) {
    return `Lote ${loteId}`;
  }
  if (lote.eventoNome) {
    return `${lote.nome} - ${lote.eventoNome}`;
  }
  return lote.nome;
}

export function formatLoteOrigem(origem: LoteOrigem): string {
  if (origem === 'LOCAL') return 'Local';
  if (origem === 'EXTERNO') return 'Externo';
  return 'Sem lote';
}

export function buildLoteResumo(
  inscritos: Inscrito[],
  lotesById?: Map<string, LoteLookup>,
): LoteResumo[] {
  const resumo = new Map<string, LoteResumo>();

  for (const inscrito of inscritos) {
    let key: string;
    let nome: string;
    let origem: LoteOrigem;

    if (inscrito.loteId) {
      key = `local:${inscrito.loteId}`;
      nome = getLocalLoteNome(inscrito.loteId, lotesById);
      origem = 'LOCAL';
    } else if (inscrito.loteExternoId || inscrito.loteExternoNome) {
      const externalKey = inscrito.loteExternoId || inscrito.loteExternoNome || 'externo';
      key = `externo:${externalKey}`;
      nome = inscrito.loteExternoNome || `Lote ${inscrito.loteExternoId}`;
      origem = 'EXTERNO';
    } else {
      key = 'sem-lote';
      nome = 'Sem lote';
      origem = 'SEM_LOTE';
    }

    const current = resumo.get(key);
    if (!current) {
      resumo.set(key, {
        key,
        nome,
        origem,
        totalInscritos: 1,
        totalCanceladas: isCancelled(inscrito.statusPagamento) ? 1 : 0,
      });
      continue;
    }

    current.totalInscritos += 1;
    if (isCancelled(inscrito.statusPagamento)) {
      current.totalCanceladas += 1;
    }
  }

  const origemOrder: Record<LoteOrigem, number> = {
    LOCAL: 0,
    EXTERNO: 1,
    SEM_LOTE: 2,
  };

  return Array.from(resumo.values()).sort((a, b) => {
    const origemDiff = origemOrder[a.origem] - origemOrder[b.origem];
    if (origemDiff !== 0) return origemDiff;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}
