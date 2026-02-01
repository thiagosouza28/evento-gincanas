import { useState, useEffect, useCallback } from 'react';
import type { PremiacaoHistorico } from '@/types/premiacao';
import { createId } from '@/lib/id';

const STORAGE_KEY = 'premiacao-historico';

// Usa localStorage para persistência simples do histórico de premiações
export function usePremiacaoHistorico() {
  const [historico, setHistorico] = useState<PremiacaoHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistorico = useCallback(() => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PremiacaoHistorico[];
        // Ordenar do mais recente para o mais antigo
        setHistorico(parsed.sort((a, b) => 
          new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
        ));
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de premiação:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  const adicionarPremiacao = useCallback((premiacao: Omit<PremiacaoHistorico, 'id' | 'dataHora'>) => {
    const novaPremiacao: PremiacaoHistorico = {
      ...premiacao,
      id: createId(),
      dataHora: new Date().toISOString(),
    };

    setHistorico(prev => {
      const updated = [novaPremiacao, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    return novaPremiacao;
  }, []);

  const limparHistorico = useCallback(() => {
    setHistorico([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const removerPremiacao = useCallback((id: string) => {
    setHistorico(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    historico,
    loading,
    adicionarPremiacao,
    limparHistorico,
    removerPremiacao,
    reload: loadHistorico,
  };
}
