import { useEffect, useState, useRef } from 'react';
import { Wifi, WifiOff, Trophy } from 'lucide-react';
import { TorneioSorteioPopup, ConfrontoSorteado } from '@/components/sorteio/TorneioSorteioPopup';
import type { Equipe } from '@/types';

// Canal de broadcast para sincronização em tempo real
const TORNEIO_SORTEIO_CHANNEL = 'torneio-sorteio-broadcast-channel';

interface TorneioSorteioData {
  type: 'sorteando' | 'resultado' | 'completo' | 'fechar';
  posicao: number;
  equipe: Equipe | null;
  torneioNome: string;
  confrontos: ConfrontoSorteado[];
}

const PublicoTorneio = () => {
  const [isConnected, setIsConnected] = useState(false);
  const torneioChannelRef = useRef<BroadcastChannel | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Estado do popup de torneio
  const [torneioPopup, setTorneioPopup] = useState<{
    open: boolean;
    equipe: Equipe | null;
    posicao: number;
    sorteando: boolean;
    torneioNome: string;
    confrontos: ConfrontoSorteado[];
    mostrarResumo: boolean;
  }>({
    open: false,
    equipe: null,
    posicao: 0,
    sorteando: false,
    torneioNome: '',
    confrontos: [],
    mostrarResumo: false,
  });

  // Escuta eventos do sorteio de torneio
  useEffect(() => {
    torneioChannelRef.current = new BroadcastChannel(TORNEIO_SORTEIO_CHANNEL);
    setIsConnected(true);

    torneioChannelRef.current.onmessage = (event: MessageEvent<TorneioSorteioData>) => {
      console.log('Torneio sorteio broadcast recebido:', event.data);
      
      const { type, posicao, equipe, torneioNome, confrontos } = event.data;

      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = null;
      }

      if (resumoTimeoutRef.current) {
        clearTimeout(resumoTimeoutRef.current);
        resumoTimeoutRef.current = null;
      }
      
      if (type === 'sorteando') {
        setTorneioPopup({
          open: true,
          equipe: null,
          posicao,
          sorteando: true,
          torneioNome,
          confrontos: confrontos || [],
          mostrarResumo: false,
        });
      } else if (type === 'resultado') {
        setTorneioPopup({
          open: true,
          equipe,
          posicao,
          sorteando: false,
          torneioNome,
          confrontos: confrontos || [],
          mostrarResumo: false,
        });
        
        const isSegundaEquipe = posicao % 2 === 0;
        const closeDelayMs = isSegundaEquipe ? 6000 : 3000;
        const isFinalSorteio = posicao === 8;

        if (isFinalSorteio) {
          // No ??ltimo sorteio, mostra o resumo ap??s a anima????o da 2a equipe
          resumoTimeoutRef.current = setTimeout(() => {
            setTorneioPopup(prev => ({
              ...prev,
              equipe: null,
              posicao: 8,
              sorteando: false,
              mostrarResumo: true,
            }));
            resumoTimeoutRef.current = null;
          }, closeDelayMs);
        } else {
          // Fechar popup depois de alguns segundos (mais tempo na 2a equipe)
          popupTimeoutRef.current = setTimeout(() => {
            setTorneioPopup(prev => ({ ...prev, open: false }));
            popupTimeoutRef.current = null;
          }, closeDelayMs);
        }
      } else if (type === 'completo') {
        // Mostrar resumo final - permanece até ser fechado manualmente
        setTorneioPopup({
          open: true,
          equipe: null,
          posicao: 8,
          sorteando: false,
          torneioNome,
          confrontos: confrontos || [],
          mostrarResumo: true,
        });
      } else if (type === 'fechar') {
        setTorneioPopup(prev => ({ ...prev, open: false }));
      }
    };

    torneioChannelRef.current.onmessageerror = () => {
      setIsConnected(false);
    };

    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = null;
      }
      if (resumoTimeoutRef.current) {
        clearTimeout(resumoTimeoutRef.current);
        resumoTimeoutRef.current = null;
      }
      torneioChannelRef.current?.close();
      setIsConnected(false);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Connection Status */}
      <div className="fixed top-2 right-2 z-50">
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${isConnected ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy className="h-10 w-10 text-warning" />
          <h1 className="text-display-sm font-bold text-foreground">Sorteio de Torneio</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          {torneioPopup.torneioNome || 'Aguardando início do sorteio...'}
        </p>
      </div>

      {/* Waiting state */}
      {!torneioPopup.open && (
        <div className="text-center space-y-4">
          <div className="w-32 h-32 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
            <Trophy className="h-16 w-16 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">
            Aguardando início do sorteio dos confrontos...
          </p>
        </div>
      )}

      {/* Popup de sorteio de torneio */}
      <TorneioSorteioPopup
        open={torneioPopup.open}
        equipe={torneioPopup.equipe}
        posicao={torneioPopup.posicao}
        sorteando={torneioPopup.sorteando}
        confrontos={torneioPopup.confrontos}
        mostrarResumo={torneioPopup.mostrarResumo}
        torneioNome={torneioPopup.torneioNome}
      />
    </div>
  );
};

export default PublicoTorneio;
