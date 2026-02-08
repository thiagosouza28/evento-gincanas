import { useState, useCallback, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Users, Users2, Shuffle, RotateCcw, X, ExternalLink, History, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useInscritos, useEquipes } from '@/hooks/useDatabase';
import { usePremiacaoHistorico } from '@/hooks/usePremiacaoHistorico';
import { playDrumroll, playReveal } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Inscrito, Equipe } from '@/types';

const PREMIACAO_CHANNEL = 'premiacao-broadcast-channel';
const SESSION_PARTICIPANTES_KEY = 'premiacao-session-participantes';
const SESSION_EQUIPES_KEY = 'premiacao-session-equipes';

interface SorteioResult {
  type: 'participante' | 'equipe';
  participante?: Inscrito;
  equipe?: Equipe;
  descricaoPremio: string;
}

export default function Premiacao() {
  const { inscritos } = useInscritos();
  const { equipes } = useEquipes();
  const { historico, adicionarPremiacao, limparHistorico, removerPremiacao } = usePremiacaoHistorico();
  
  const [permitirRepeticao, setPermitirRepeticao] = useState(false);
  const [participantesSorteados, setParticipantesSorteados] = useState<number[]>(() => {
    const stored = localStorage.getItem(SESSION_PARTICIPANTES_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value) => typeof value === 'number' && Number.isFinite(value));
    } catch {
      return [];
    }
  });
  const [equipesSorteadas, setEquipesSorteadas] = useState<string[]>(() => {
    const stored = localStorage.getItem(SESSION_EQUIPES_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value) => typeof value === 'string');
    } catch {
      return [];
    }
  });
  const [resultado, setResultado] = useState<SorteioResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [descricaoPremio, setDescricaoPremio] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const descricaoPremioTrimmed = descricaoPremio.trim();
  const descricaoPremioValida = descricaoPremioTrimmed.length > 0;
  
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const stopDrumrollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(PREMIACAO_CHANNEL);
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSION_PARTICIPANTES_KEY, JSON.stringify(participantesSorteados));
  }, [participantesSorteados]);

  useEffect(() => {
    localStorage.setItem(SESSION_EQUIPES_KEY, JSON.stringify(equipesSorteadas));
  }, [equipesSorteadas]);

  const broadcast = (data: {
    type: 'participante' | 'equipe' | null;
    participante?: Inscrito;
    equipe?: Equipe;
    descricaoPremio: string;
    sorteando: boolean;
    showResult: boolean;
  }) => {
    broadcastChannelRef.current?.postMessage(data);
  };

  const inscritosArray = Array.from(inscritos.values());
  const participantesDisponiveis = permitirRepeticao 
    ? inscritosArray 
    : inscritosArray.filter(p => !participantesSorteados.includes(p.numero));
  
  const equipesDisponiveis = permitirRepeticao 
    ? equipes 
    : equipes.filter(e => !equipesSorteadas.includes(e.id));

  const sortearParticipante = useCallback(() => {
    if (!descricaoPremioValida) {
      toast.error('Informe a descrição do prêmio/tarefa');
      return;
    }
    if (participantesDisponiveis.length === 0) return;
    
    setIsAnimating(true);
    setResultado(null);
    
    // Iniciar som de suspense
    stopDrumrollRef.current = playDrumroll(1500);
    
    // Broadcast: sorteando
    broadcast({
      type: 'participante',
      descricaoPremio: descricaoPremioTrimmed,
      sorteando: true,
      showResult: false,
    });
    
    setTimeout(() => {
      const sorteado = participantesDisponiveis[Math.floor(Math.random() * participantesDisponiveis.length)];
      
      setParticipantesSorteados(prev => [sorteado.numero, ...prev]);
      
      const result: SorteioResult = { type: 'participante', participante: sorteado, descricaoPremio: descricaoPremioTrimmed };
      setResultado(result);
      setIsAnimating(false);
      
      // Tocar som de revelação
      playReveal();
      
      // Salvar no histórico
      adicionarPremiacao({
        type: 'participante',
        participanteNumero: sorteado.numero,
        participanteNome: sorteado.nome,
        descricaoPremio: descricaoPremioTrimmed,
      });
      
      // Broadcast: resultado
      broadcast({
        type: 'participante',
        participante: sorteado,
        descricaoPremio: descricaoPremioTrimmed,
        sorteando: false,
        showResult: true,
      });
    }, 1500);
  }, [participantesDisponiveis, permitirRepeticao, descricaoPremioTrimmed, descricaoPremioValida, adicionarPremiacao]);

  const sortearEquipe = useCallback(() => {
    if (!descricaoPremioValida) {
      toast.error('Informe a descrição do prêmio/tarefa');
      return;
    }
    if (equipesDisponiveis.length === 0) return;
    
    setIsAnimating(true);
    setResultado(null);
    
    // Iniciar som de suspense
    stopDrumrollRef.current = playDrumroll(1500);
    
    // Broadcast: sorteando
    broadcast({
      type: 'equipe',
      descricaoPremio: descricaoPremioTrimmed,
      sorteando: true,
      showResult: false,
    });
    
    setTimeout(() => {
      const sorteada = equipesDisponiveis[Math.floor(Math.random() * equipesDisponiveis.length)];
      
      setEquipesSorteadas(prev => [sorteada.id, ...prev]);
      
      const result: SorteioResult = { type: 'equipe', equipe: sorteada, descricaoPremio: descricaoPremioTrimmed };
      setResultado(result);
      setIsAnimating(false);
      
      // Tocar som de revelação
      playReveal();
      
      // Salvar no histórico
      adicionarPremiacao({
        type: 'equipe',
        equipeId: sorteada.id,
        equipeNome: sorteada.nome,
        descricaoPremio: descricaoPremioTrimmed,
      });
      
      // Broadcast: resultado
      broadcast({
        type: 'equipe',
        equipe: sorteada,
        descricaoPremio: descricaoPremioTrimmed,
        sorteando: false,
        showResult: true,
      });
    }, 1500);
  }, [equipesDisponiveis, permitirRepeticao, descricaoPremioTrimmed, descricaoPremioValida, adicionarPremiacao]);

  const resetarSorteios = () => {
    setParticipantesSorteados([]);
    setEquipesSorteadas([]);
    setResultado(null);
    localStorage.removeItem(SESSION_PARTICIPANTES_KEY);
    localStorage.removeItem(SESSION_EQUIPES_KEY);
    broadcast({
      type: null,
      descricaoPremio: '',
      sorteando: false,
      showResult: false,
    });
  };

  const fecharResultado = () => {
    setResultado(null);
    broadcast({
      type: null,
      descricaoPremio: '',
      sorteando: false,
      showResult: false,
    });
  };

  const abrirTelaPublica = () => {
    const width = window.screen.width;
    const height = window.screen.height;
    window.open('/publico-premiacao', 'premiacao-publico', `width=${width},height=${height},fullscreen=yes`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Premiação</h1>
              <p className="text-muted-foreground">Sorteio de prêmios e tarefas</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              variant={mostrarHistorico ? "default" : "outline"} 
              onClick={() => setMostrarHistorico(!mostrarHistorico)} 
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
            
            <Button variant="outline" onClick={abrirTelaPublica} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Tela Pública
            </Button>
            
            <div className="flex items-center gap-2">
              <Switch
                id="permitir-repeticao"
                checked={permitirRepeticao}
                onCheckedChange={setPermitirRepeticao}
              />
              <Label htmlFor="permitir-repeticao" className="text-sm">
                Permitir repetição
              </Label>
            </div>
            
            <Button variant="outline" onClick={resetarSorteios} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Resetar
            </Button>
          </div>
        </div>

        {/* Histórico Persistente */}
        <AnimatePresence>
          {mostrarHistorico && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Histórico de Premiações
                  </CardTitle>
                  {historico.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={limparHistorico}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Limpar tudo
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {historico.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhuma premiação realizada ainda
                    </p>
                  ) : (
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {historico.map((item) => (
                          <div 
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                item.type === 'participante' ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent-foreground"
                              )}>
                                {item.type === 'participante' ? (
                                  <Users className="h-5 w-5" />
                                ) : (
                                  <Users2 className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {item.type === 'participante' 
                                    ? `${item.participanteNome} (Nº ${item.participanteNumero})`
                                    : item.equipeNome
                                  }
                                </p>
                                {item.descricaoPremio && (
                                  <p className="text-sm text-muted-foreground">
                                    🎁 {item.descricaoPremio}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(item.dataHora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removerPremiacao(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Campo de Descrição do Prêmio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Descrição do Prêmio / Tarefa</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Ex: Caixa de chocolate, Cantar uma música, Vale compras..."
              value={descricaoPremio}
              onChange={(e) => setDescricaoPremio(e.target.value)}
              autoFocus
              required
              aria-required="true"
              aria-invalid={!descricaoPremioValida}
              className={cn(
                "text-lg",
                !descricaoPremioValida && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {!descricaoPremioValida && (
              <p className="mt-2 text-sm text-destructive">
                Informe a descrição do prêmio/tarefa para continuar.
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="participantes" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="participantes" className="gap-2">
              <Users className="h-4 w-4" />
              Participantes
            </TabsTrigger>
            <TabsTrigger value="equipes" className="gap-2">
              <Users2 className="h-4 w-4" />
              Equipes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participantes" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Área de Sorteio */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shuffle className="h-5 w-5" />
                    Sortear Participante
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">
                      {participantesDisponiveis.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      participantes disponíveis
                    </p>
                  </div>
                  
                  <Button 
                    onClick={sortearParticipante}
                    disabled={participantesDisponiveis.length === 0 || isAnimating || !descricaoPremioValida}
                    className="w-full h-16 text-xl gap-3"
                    size="lg"
                  >
                    {isAnimating ? (
                      <>
                        <Shuffle className="h-6 w-6 animate-spin" />
                        Sorteando...
                      </>
                    ) : (
                      <>
                        <Gift className="h-6 w-6" />
                        Sortear Participante
                      </>
                    )}
                  </Button>
                  
                  {!permitirRepeticao && participantesSorteados.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      {participantesSorteados.length} já sorteados
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Lista de Sorteados da Sessão */}
              <Card>
                <CardHeader>
                  <CardTitle>Sorteados nesta sessão</CardTitle>
                </CardHeader>
                <CardContent>
                  {participantesSorteados.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum participante sorteado ainda
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {participantesSorteados.map((numero, index) => {
                        const participante = inscritos.get(numero);
                        const igreja = participante?.igreja || 'Igreja nao informada';
                        const distrito = participante?.distrito ? ` - ${participante.distrito}` : '';
                        return (
                          <div 
                            key={`${numero}-${index}`}
                            className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/40 p-3"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                              {index + 1}
                            </div>
                            <img
                              src={participante?.fotoUrl || '/placeholder.svg'}
                              alt={participante?.nome || `Nº ${numero}`}
                              className="h-11 w-11 rounded-full object-cover border-2 border-primary/30"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder.svg';
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{participante?.nome || `Nº ${numero}`}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Nº {numero} • {igreja}{distrito}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipes" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Área de Sorteio */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shuffle className="h-5 w-5" />
                    Sortear Equipe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">
                      {equipesDisponiveis.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      equipes disponíveis
                    </p>
                  </div>
                  
                  <Button 
                    onClick={sortearEquipe}
                    disabled={equipesDisponiveis.length === 0 || isAnimating || !descricaoPremioValida}
                    className="w-full h-16 text-xl gap-3"
                    size="lg"
                  >
                    {isAnimating ? (
                      <>
                        <Shuffle className="h-6 w-6 animate-spin" />
                        Sorteando...
                      </>
                    ) : (
                      <>
                        <Gift className="h-6 w-6" />
                        Sortear Equipe
                      </>
                    )}
                  </Button>
                  
                  {!permitirRepeticao && equipesSorteadas.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      {equipesSorteadas.length} já sorteadas
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Lista de Sorteadas da Sessão */}
              <Card>
                <CardHeader>
                  <CardTitle>Sorteadas nesta sessão</CardTitle>
                </CardHeader>
                <CardContent>
                  {equipesSorteadas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma equipe sorteada ainda
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {equipesSorteadas.map((equipeId, index) => {
                        const equipe = equipes.find(e => e.id === equipeId);
                        const corEquipe = equipe?.corPulseira || (equipe ? `hsl(var(--team-${equipe.cor}))` : '#888888');
                        return (
                          <div 
                            key={`${equipeId}-${index}`}
                            className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/40 p-3"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                              {index + 1}
                            </div>
                            <div 
                              className="h-10 w-10 rounded-full border-2"
                              style={{ backgroundColor: corEquipe, borderColor: corEquipe }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold" style={{ color: corEquipe }}>
                                {equipe?.nome || 'Equipe'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Nº {equipe?.numero ?? '--'}{equipe?.lider ? ` • Líder: ${equipe.lider}` : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Popup de Resultado */}
      <AnimatePresence>
        {resultado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={fecharResultado}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 z-10 rounded-full bg-background"
                onClick={fecharResultado}
              >
                <X className="h-4 w-4" />
              </Button>

              {resultado.type === 'participante' && resultado.participante && (
                <Card className="w-[400px] border-4 border-primary overflow-hidden">
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center">
                    <Gift className="h-16 w-16 mx-auto text-primary mb-4" />
                    
                    {resultado.descricaoPremio && (
                      <div className="mb-4 p-3 rounded-lg bg-primary/10">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Prêmio / Tarefa</p>
                        <p className="text-lg font-bold text-primary">{resultado.descricaoPremio}</p>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                      Sorteado
                    </p>
                    
                    {resultado.participante.fotoUrl && (
                      <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-primary">
                        <img 
                          src={resultado.participante.fotoUrl} 
                          alt={resultado.participante.nome}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <h2 className="text-3xl font-bold text-foreground mb-2">
                      {resultado.participante.nome}
                    </h2>
                    
                    <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full px-6 py-2 text-2xl font-bold">
                      Nº {resultado.participante.numero}
                    </div>
                    
                    {resultado.participante.igreja && (
                      <p className="text-muted-foreground mt-4">
                        {resultado.participante.igreja}
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {resultado.type === 'equipe' && resultado.equipe && (() => {
                const corEquipe = resultado.equipe.corPulseira || '#888888';
                return (
                  <Card 
                    className="w-[400px] border-4 overflow-hidden"
                    style={{ borderColor: corEquipe }}
                  >
                    <div 
                      className="p-8 text-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${corEquipe}30 0%, ${corEquipe}10 100%)` 
                      }}
                    >
                      <Gift className="h-16 w-16 mx-auto mb-4" style={{ color: corEquipe }} />
                      
                      {resultado.descricaoPremio && (
                        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: `${corEquipe}20` }}>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Prêmio / Tarefa</p>
                          <p className="text-lg font-bold" style={{ color: corEquipe }}>{resultado.descricaoPremio}</p>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-4">
                        Equipe Sorteada
                      </p>
                      
                      <div 
                        className="w-24 h-24 mx-auto mb-4 rounded-full"
                        style={{ backgroundColor: corEquipe }}
                      />
                      
                      <h2 className="text-4xl font-bold text-foreground mb-2">
                        {resultado.equipe.nome}
                      </h2>
                      
                      {resultado.equipe.lider && (
                        <p className="text-muted-foreground">
                          Líder: {resultado.equipe.lider}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
