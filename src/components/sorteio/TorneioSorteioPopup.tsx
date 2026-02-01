import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Dices, Swords } from 'lucide-react';
import type { Equipe } from '@/types';

export interface ConfrontoSorteado {
  numero: number;
  equipe1: Equipe | null;
  equipe2: Equipe | null;
}

interface TorneioSorteioPopupProps {
  open: boolean;
  equipe: Equipe | null;
  posicao: number;
  sorteando: boolean;
  confrontos: ConfrontoSorteado[];
  mostrarResumo: boolean;
  torneioNome: string;
}

export function TorneioSorteioPopup({ 
  open, 
  equipe, 
  posicao, 
  sorteando, 
  confrontos,
  mostrarResumo,
  torneioNome
}: TorneioSorteioPopupProps) {
  if (!open) return null;

  // Calcula qual confronto está sendo definido (1-4)
  const numeroConfronto = Math.ceil(posicao / 2);
  const isPrimeiroDoConfronto = posicao % 2 === 1;

  // Encontra o confronto atual
  const confrontoAtual = confrontos.find(c => c.numero === numeroConfronto);
  const confrontoCompleto = confrontoAtual?.equipe1 && confrontoAtual?.equipe2;
  const getEquipeColor = (target?: Equipe | null) => {
    if (!target) return 'hsl(var(--primary))';
    if (target.corPulseira) return target.corPulseira;
    if (typeof target.cor === 'number') return `hsl(var(--team-${target.cor}))`;
    return 'hsl(var(--primary))';
  };
  const equipeColor = getEquipeColor(equipe);
  const equipe1Color = getEquipeColor(confrontoAtual?.equipe1);
  const equipe2Color = getEquipeColor(confrontoAtual?.equipe2);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-3xl flex flex-col items-center justify-center bg-background border-2 p-8" style={{ borderColor: equipeColor }}>
        <AnimatePresence mode="wait">
          {/* Estado: Sorteando */}
          {sorteando && (
            <motion.div
              key="sorteando"
              className="text-center space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.15, 1], y: [0, -6, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              >
                <Dices className="h-20 w-20 text-primary mx-auto" />
              </motion.div>
              <div>
                <p className="text-xl text-muted-foreground">
                  {torneioNome}
                </p>
                <p className="text-2xl font-medium text-foreground mt-2">
                  Sorteando {numeroConfronto}º Confronto...
                </p>
                <p className="text-muted-foreground mt-1">
                  {isPrimeiroDoConfronto ? '1ª equipe' : '2ª equipe'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Estado: Mostrar equipe sorteada (aguardando segunda equipe) */}
          {!sorteando && !mostrarResumo && equipe && isPrimeiroDoConfronto && (
            <motion.div
              key="primeira-equipe"
              className="text-center space-y-6"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              {equipe.imagemUrl ? (
                <div
                  className="mx-auto h-28 w-28 rounded-full overflow-hidden border-4"
                  style={{ borderColor: equipeColor }}
                >
                  <img
                    src={equipe.imagemUrl}
                    alt={equipe.nome}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <Trophy className="h-16 w-16 mx-auto" style={{ color: equipeColor }} />
              )}
              
              <div>
                <p className="text-lg text-muted-foreground">{numeroConfronto}º Confronto - 1ª Equipe</p>
              </div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="rounded-2xl px-10 py-6"
                style={{
                  backgroundColor: `${equipeColor}20`,
                  border: `3px solid ${equipeColor}`,
                  boxShadow: `0 0 40px ${equipeColor}66`
                }}
              >
                <h1
                  className="text-display-sm font-bold"
                  style={{ color: equipeColor }}
                >
                  {equipe.nome}
                </h1>
              </motion.div>

              <p className="text-muted-foreground">Aguardando adversário...</p>
            </motion.div>
          )}

          {/* Estado: Confronto completo (mostra Equipe vs Equipe) */}
          {!sorteando && !mostrarResumo && confrontoCompleto && !isPrimeiroDoConfronto && (
            <motion.div
              key="confronto-completo"
              className="text-center space-y-6"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Swords className="h-16 w-16 mx-auto text-primary" />
              
              <div>
                <p className="text-xl text-muted-foreground">{numeroConfronto}º Confronto Definido!</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                {/* Equipe 1 */}
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl px-6 py-4 min-w-[180px]"
                  style={{
                    backgroundColor: `${equipe1Color}20`,
                    border: `2px solid ${equipe1Color}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {confrontoAtual.equipe1?.imagemUrl && (
                      <div
                        className="h-12 w-12 rounded-full overflow-hidden border-2"
                        style={{ borderColor: equipe1Color }}
                      >
                        <img
                          src={confrontoAtual.equipe1.imagemUrl}
                          alt={confrontoAtual.equipe1.nome}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <h2
                      className="text-xl font-bold"
                      style={{ color: equipe1Color }}
                    >
                      {confrontoAtual.equipe1?.nome}
                    </h2>
                  </div>
                </motion.div>

                {/* VS */}
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  className="text-2xl font-bold text-muted-foreground"
                >
                  VS
                </motion.span>

                {/* Equipe 2 */}
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl px-6 py-4 min-w-[180px]"
                  style={{
                    backgroundColor: `${equipe2Color}20`,
                    border: `2px solid ${equipe2Color}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {confrontoAtual.equipe2?.imagemUrl && (
                      <div
                        className="h-12 w-12 rounded-full overflow-hidden border-2"
                        style={{ borderColor: equipe2Color }}
                      >
                        <img
                          src={confrontoAtual.equipe2.imagemUrl}
                          alt={confrontoAtual.equipe2.nome}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <h2
                      className="text-xl font-bold"
                      style={{ color: equipe2Color }}
                    >
                      {confrontoAtual.equipe2?.nome}
                    </h2>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Estado: Resumo final de todos os confrontos */}
          {mostrarResumo && (
            <motion.div
              key="resumo"
              className="text-center space-y-6 w-full"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 150 }}
            >
              <Trophy className="h-16 w-16 mx-auto text-primary" />
              
              <div>
                <p className="text-lg text-muted-foreground">{torneioNome}</p>
                <h2 className="text-2xl font-bold text-foreground mt-1">Quartas de Final</h2>
              </div>

              <div className="space-y-4 w-full max-w-xl mx-auto">
                {confrontos.map((conf, index) => (
                  <motion.div
                    key={conf.numero}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.15 }}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-muted/30 border border-border"
                  >
                    <span className="text-sm text-muted-foreground font-medium w-8">
                      {conf.numero}º
                    </span>
                    
                    <div 
                      className="flex-1 text-center py-2 px-3 rounded-lg"
                      style={{
                        backgroundColor: `${getEquipeColor(conf.equipe1)}20`,
                        borderLeft: `3px solid ${getEquipeColor(conf.equipe1)}`
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {conf.equipe1?.imagemUrl && (
                          <div
                            className="h-7 w-7 rounded-full overflow-hidden border-2"
                            style={{ borderColor: getEquipeColor(conf.equipe1) }}
                          >
                            <img
                              src={conf.equipe1.imagemUrl}
                              alt={conf.equipe1.nome}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <span 
                          className="font-semibold"
                          style={{ color: getEquipeColor(conf.equipe1) }}
                        >
                          {conf.equipe1?.nome || '?'}
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-bold text-muted-foreground px-2">VS</span>

                    <div 
                      className="flex-1 text-center py-2 px-3 rounded-lg"
                      style={{
                        backgroundColor: `${getEquipeColor(conf.equipe2)}20`,
                        borderRight: `3px solid ${getEquipeColor(conf.equipe2)}`
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {conf.equipe2?.imagemUrl && (
                          <div
                            className="h-7 w-7 rounded-full overflow-hidden border-2"
                            style={{ borderColor: getEquipeColor(conf.equipe2) }}
                          >
                            <img
                              src={conf.equipe2.imagemUrl}
                              alt={conf.equipe2.nome}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <span 
                          className="font-semibold"
                          style={{ color: getEquipeColor(conf.equipe2) }}
                        >
                          {conf.equipe2?.nome || '?'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
