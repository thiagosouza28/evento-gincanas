import { useEffect, useState } from 'react';
import { useApiConfig } from '@/hooks/useDatabase';
import { fetchEventos } from '@/lib/apiSync';

export function useEventoNome() {
  const { config } = useApiConfig();
  const [eventoNome, setEventoNome] = useState<string>('');

  useEffect(() => {
    let active = true;

    const loadEvento = async () => {
      if (!config?.eventId) {
        if (active) {
          setEventoNome('');
        }
        return;
      }

      if (active) {
        setEventoNome(config.eventId);
      }

      try {
        const eventos = await fetchEventos();
        if (!active) return;
        const match = eventos.find((evento) => evento.id === config.eventId);
        setEventoNome(match?.name || config.eventId);
      } catch (error) {
        if (active) {
          setEventoNome(config.eventId);
        }
      }
    };

    loadEvento();
    return () => {
      active = false;
    };
  }, [config?.eventId]);

  return { eventoNome, eventId: config?.eventId };
}
