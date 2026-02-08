import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useGincanas, useEquipesComParticipantes, useInscritos } from '@/hooks/useDatabase';
import { Loader2, CheckCircle2, Users, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Inscrito, Equipe } from '@/types';

// Canal de broadcast para sincronização em tempo real
const SORTEIO_CHANNEL = 'sorteio-broadcast-channel';

interface SorteioData {
  inscrito: Inscrito | null;
  equipe: Equipe | null;
  sorteando: boolean;
  showResult: boolean;
  numeroDigitado?: string;
}

const PublicoSorteio = () => {
  const [sorteioData, setSorteioData] = useState<SorteioData>({
    inscrito: null,
    equipe: null,
    sorteando: false,
    showResult: false,
    numeroDigitado: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const { gincanaAtiva } = useGincanas();
  const { inscritos } = useInscritos();
  const { equipes, reload: reloadEquipes } = useEquipesComParticipantes(gincanaAtiva?.id);

  // Escuta eventos via BroadcastChannel
  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(SORTEIO_CHANNEL);
    setIsConnected(true);

    broadcastChannelRef.current.onmessage = (event: MessageEvent<SorteioData>) => {
      console.log('Sorteio broadcast recebido:', event.data);
      setSorteioData(event.data);
      
      if (event.data.showResult) {
        setTimeout(() => reloadEquipes(), 500);
      }
    };

    broadcastChannelRef.current.onmessageerror = (event) => {
      console.error('Erro no broadcast:', event);
      setIsConnected(false);
    };

    return () => {
      broadcastChannelRef.current?.close();
      setIsConnected(false);
    };
  }, [reloadEquipes]);

  const { inscrito, equipe, sorteando, showResult } = sorteioData;
  const numeroDigitado = sorteioData.numeroDigitado?.trim() ?? '';
  const inscritoPreview = useMemo(() => {
    if (!numeroDigitado) return null;
    const numero = Number(numeroDigitado);
    if (!Number.isFinite(numero)) return null;
    return inscritos.get(numero) ?? null;
  }, [inscritos, numeroDigitado]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pb-24">
      {/* Connection Status */}
      <div className="fixed top-2 right-2 z-50">
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${isConnected ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-display-sm font-bold text-foreground">Sorteio de Equipes</h1>
      </div>

      {/* Aguardando Sorteio */}
      <AnimatePresence mode="wait">
        {!inscrito && !sorteando && !showResult && (
          numeroDigitado ? (
            <motion.div
              key="digitando"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-xl"
            >
              <Card className="overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardContent className="p-8 text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Digitando</p>
                  <p className="mt-3 text-display-md font-bold text-primary">{numeroDigitado}</p>
                  {inscritoPreview ? (
                    <div className="mt-4 flex flex-col items-center gap-3">
                      <img
                        src={inscritoPreview.fotoUrl || '/placeholder.svg'}
                        alt={inscritoPreview.nome}
                        className="h-20 w-20 rounded-2xl object-cover border-2 border-primary/40"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                      <div className="space-y-2 text-center">
                        <p className="text-2xl font-semibold text-foreground">{inscritoPreview.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {inscritoPreview.igreja} {inscritoPreview.distrito ? `- ${inscritoPreview.distrito}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">{inscritoPreview.idade} anos</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Aguardando confirmacao</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary/30" />
              <p className="mt-4 text-lg text-muted-foreground">
                Aguardando próximo participante...
              </p>
            </motion.div>
          )
        )}

        {/* Animação do Sorteio */}
        {equipe && sorteando && !showResult && (
          <motion.div
            key="sorteando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-xl"
          >
            <Card 
              className="overflow-hidden"
              style={{ borderColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
            >
              <div 
                className="h-2"
                style={{ backgroundColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
              />
              <CardContent className="p-8 text-center">
                <motion.h2 
                  className="text-display-md font-bold"
                  style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                >
                  {equipe.nome}
                </motion.h2>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Resultado Final */}
        {showResult && inscrito && equipe && (
          <motion.div
            key="resultado"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="w-full max-w-2xl"
          >
            <Card 
              className="overflow-hidden"
              style={{ 
                borderColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`,
                boxShadow: `0 0 60px ${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}40`
              }}
            >
              <div 
                className="h-2"
                style={{ backgroundColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
              />
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <img
                    src={inscrito.fotoUrl || '/placeholder.svg'}
                    alt={inscrito.nome}
                    className="mx-auto h-28 w-28 rounded-2xl object-cover border-4 border-primary shadow-xl"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-base text-muted-foreground">Inscrito Nº {inscrito.numero}</p>
                  <h2 className="text-display-sm font-bold mt-1">{inscrito.nome}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {inscrito.igreja} • {inscrito.distrito}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                >
                  <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="space-y-3"
                >
                  <p className="text-base text-muted-foreground">Foi sorteado para a equipe</p>
                  <div
                    className="inline-block rounded-2xl px-10 py-4"
                    style={{
                      backgroundColor: `${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}20`,
                      border: `2px solid ${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}`,
                    }}
                  >
                    <h1
                      className="text-display-sm font-bold"
                      style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
                    >
                      {equipe.nome}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Líder: {equipe.lider} | Vice: {equipe.vice}
                    </p>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teams Overview */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-center">Distribuição das Equipes</h3>
          </div>
          <div className="grid gap-1.5 grid-cols-4 lg:grid-cols-8">
            {equipes.map((eq) => (
              <Card 
                key={eq.id}
                className="glass"
                style={{ borderColor: eq.corPulseira || `hsl(var(--team-${eq.cor}))` }}
              >
                <CardContent className="p-1.5 text-center">
                  <p className="font-semibold text-[10px]" style={{ color: eq.corPulseira || `hsl(var(--team-${eq.cor}))` }}>
                    {eq.nome}
                  </p>
                  <p className="text-base font-bold">{eq.participantes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicoSorteio;
