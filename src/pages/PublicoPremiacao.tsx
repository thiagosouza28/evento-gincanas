import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Gift, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Inscrito, Equipe } from '@/types';

const PREMIACAO_CHANNEL = 'premiacao-broadcast-channel';

interface PremiacaoData {
  type: 'participante' | 'equipe' | null;
  participante?: Inscrito;
  equipe?: Equipe;
  descricaoPremio: string;
  sorteando: boolean;
  showResult: boolean;
}

const PublicoPremiacao = () => {
  const [premiacaoData, setPremiacaoData] = useState<PremiacaoData>({
    type: null,
    descricaoPremio: '',
    sorteando: false,
    showResult: false,
  });
  const [isConnected, setIsConnected] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(PREMIACAO_CHANNEL);
    setIsConnected(true);

    broadcastChannelRef.current.onmessage = (event: MessageEvent<PremiacaoData>) => {
      console.log('Premiação broadcast recebido:', event.data);
      setPremiacaoData(event.data);
    };

    broadcastChannelRef.current.onmessageerror = (event) => {
      console.error('Erro no broadcast:', event);
      setIsConnected(false);
    };

    return () => {
      broadcastChannelRef.current?.close();
      setIsConnected(false);
    };
  }, []);

  const { type, participante, equipe, descricaoPremio, sorteando, showResult } = premiacaoData;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      {/* Connection Status */}
      <div className="fixed top-4 right-4 z-50">
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${isConnected ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
          {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {isConnected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-display-md font-bold text-foreground flex items-center justify-center gap-4">
          <Gift className="h-12 w-12 text-primary" />
          Sorteio de Premiação
        </h1>
      </div>

      <AnimatePresence mode="wait">
        {/* Aguardando */}
        {!sorteando && !showResult && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <Gift className="mx-auto h-24 w-24 text-primary/30" />
            <p className="mt-6 text-2xl text-muted-foreground">
              Aguardando próximo sorteio...
            </p>
          </motion.div>
        )}

        {/* Animação de Sorteio */}
        {sorteando && !showResult && (
          <motion.div
            key="sorteando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Gift className="mx-auto h-32 w-32 text-primary" />
            </motion.div>
            <motion.p
              className="mt-8 text-display-sm font-bold text-primary"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              Sorteando...
            </motion.p>
            {descricaoPremio && (
              <p className="mt-4 text-xl text-muted-foreground">{descricaoPremio}</p>
            )}
          </motion.div>
        )}

        {/* Resultado - Participante */}
        {showResult && type === 'participante' && participante && (
          <motion.div
            key="resultado-participante"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="w-full max-w-2xl"
          >
            <Card className="overflow-hidden border-4 border-primary">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-12 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <Gift className="h-20 w-20 mx-auto text-primary mb-6" />
                </motion.div>

                {descricaoPremio && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8"
                  >
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Prêmio / Tarefa</p>
                    <h3 className="text-display-xs font-bold text-primary">{descricaoPremio}</h3>
                  </motion.div>
                )}

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-muted-foreground uppercase tracking-wider mb-4"
                >
                  Sorteado
                </motion.p>

                {participante.fotoUrl && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="w-40 h-40 mx-auto mb-6 rounded-full overflow-hidden border-4 border-primary"
                  >
                    <img
                      src={participante.fotoUrl}
                      alt={participante.nome}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                )}

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-display-md font-bold text-foreground mb-4"
                >
                  {participante.nome}
                </motion.h2>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7, type: "spring" }}
                  className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full px-8 py-3 text-3xl font-bold"
                >
                  Nº {participante.numero}
                </motion.div>

                {participante.igreja && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-xl text-muted-foreground mt-6"
                  >
                    {participante.igreja}
                  </motion.p>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Resultado - Equipe */}
        {showResult && type === 'equipe' && equipe && (() => {
          const corEquipe = equipe.corPulseira || '#888888';
          return (
            <motion.div
              key="resultado-equipe"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", stiffness: 150 }}
              className="w-full max-w-2xl"
            >
              <Card
                className="overflow-hidden border-4"
                style={{ borderColor: corEquipe }}
              >
                <div
                  className="p-12 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${corEquipe}30 0%, ${corEquipe}10 100%)`
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <Gift className="h-20 w-20 mx-auto mb-6" style={{ color: corEquipe }} />
                  </motion.div>

                  {descricaoPremio && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mb-8"
                    >
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Prêmio / Tarefa</p>
                      <h3 className="text-display-xs font-bold" style={{ color: corEquipe }}>{descricaoPremio}</h3>
                    </motion.div>
                  )}

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg text-muted-foreground uppercase tracking-wider mb-6"
                  >
                    Equipe Sorteada
                  </motion.p>

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="w-32 h-32 mx-auto mb-6 rounded-full"
                    style={{ backgroundColor: corEquipe }}
                  />

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-display-lg font-bold text-foreground mb-4"
                  >
                    {equipe.nome}
                  </motion.h2>

                  {equipe.lider && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="text-xl text-muted-foreground"
                    >
                      Líder: {equipe.lider}
                    </motion.p>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default PublicoPremiacao;
