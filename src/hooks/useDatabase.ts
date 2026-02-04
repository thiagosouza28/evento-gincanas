// Re-export all hooks from the new Supabase-based implementation
// This file is kept for backward compatibility

export {
  useSupabaseInscritos as useInscritos,
  useSupabaseEquipes as useEquipes,
  useSupabaseEquipesComParticipantes as useEquipesComParticipantes,
  useSupabaseGincanas as useGincanas,
  useSupabaseSorteios as useSorteios,
  useSupabasePontuacoes as usePontuacoes,
} from './useSupabaseData';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ApiConfig, SystemConfig } from '@/types';

// Keep useDatabase for initialization checking
export function useDatabase() {
  const { user, loading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [inscritosCount, setInscritosCount] = useState(0);

  const initializeDatabase = useCallback(async () => {
    if (!user) {
      setIsReady(false);
      setInscritosCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('inscritos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!error) {
        setInscritosCount(count || 0);
      }
      setIsReady(true);
    } catch (error) {
      console.error('Erro ao inicializar banco de dados:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      initializeDatabase();
    }
  }, [authLoading, initializeDatabase]);

  return { isReady, inscritosCount, reinitialize: initializeDatabase };
}

// Keep useApiConfig for external API sync
export function useApiConfig() {
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      // Config is now stored in localStorage since it's not user-specific
      const stored = localStorage.getItem('apiConfig');
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async (newConfig: ApiConfig) => {
    localStorage.setItem('apiConfig', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  return { config, loading, saveConfig, reload: loadConfig };
}

// Sistema config (minimo de equipes)
const DEFAULT_SYSTEM_CONFIG: SystemConfig = { minEquipes: 2 };

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('systemConfig');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SystemConfig>;
        const minEquipes = Number.isFinite(parsed.minEquipes)
          ? Math.max(1, Math.floor(parsed.minEquipes as number))
          : DEFAULT_SYSTEM_CONFIG.minEquipes;
        setConfig({ minEquipes });
      } else {
        setConfig(DEFAULT_SYSTEM_CONFIG);
      }
    } catch (error) {
      console.error('Erro ao carregar configuracao do sistema:', error);
      setConfig(DEFAULT_SYSTEM_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async (newConfig: SystemConfig) => {
    const minEquipes = Number.isFinite(newConfig.minEquipes)
      ? Math.max(1, Math.floor(newConfig.minEquipes))
      : DEFAULT_SYSTEM_CONFIG.minEquipes;
    const normalized = { minEquipes };
    localStorage.setItem('systemConfig', JSON.stringify(normalized));
    setConfig(normalized);
  };

  return { config, loading, saveConfig, reload: loadConfig };
}

// Keep useOnlineStatus
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
