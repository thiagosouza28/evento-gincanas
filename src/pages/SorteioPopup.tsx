import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useInscritos, useSorteios, useEquipesComParticipantes } from '@/hooks/useDatabase';
import { Shuffle, User, Church, MapPin, Calendar, AlertCircle, CheckCircle2, Loader2, Home, ExternalLink, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getMensagemBloqueioSorteioEquipe } from '@/lib/pagamentoStatus';
import { Link } from 'react-router-dom';
import type { Inscrito, Equipe } from '@/types';

// Canal de broadcast para sincronização em tempo real
const SORTEIO_CHANNEL = 'sorteio-broadcast-channel';

const SorteioPopup = () => {
  const [numero, setNumero] = useState('');
  const [inscritoAtual, setInscritoAtual] = useState<Inscrito | null>(null);
  const [jaSorteado, setJaSorteado] = useState(false);
  const [equipeDestino, setEquipeDestino] = useState<Equipe | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [publicoOpen, setPublicoOpen] = useState(false);
  const publicoWindow = useRef<Window | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const { inscritos, loading: inscritosLoading, getInscrito } = useInscritos();
  const { verificarSorteado, realizarSorteio } = useSorteios();
  const { equipes, reload: reloadEquipes } = useEquipesComParticipantes();
  const mensagemBloqueioPagamento = inscritoAtual
    ? getMensagemBloqueioSorteioEquipe(inscritoAtual.statusPagamento)
    : null;

  // Inicializa o canal de broadcast
  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(SORTEIO_CHANNEL);
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  // Broadcast state para página pública
  const broadcastState = useCallback((
    inscrito: Inscrito | null,
    equipe: Equipe | null,
    sorteandoState: boolean,
    showResultState: boolean,
    numeroDigitado?: string
  ) => {
    const data = {
      inscrito,
      equipe,
      sorteando: sorteandoState,
      showResult: showResultState,
      numeroDigitado,
    };
    broadcastChannelRef.current?.postMessage(data);
  }, []);

  // Abre página pública em nova janela
  const abrirPublico = () => {
    const width = window.screen.width;
    const height = window.screen.height;
    publicoWindow.current = window.open('/publico', 'sorteio-publico', `width=${width},height=${height},fullscreen=yes`);
    if (publicoWindow.current) {
      setPublicoOpen(true);
      // Verifica se a janela foi fechada
      const checkWindow = setInterval(() => {
        if (publicoWindow.current?.closed) {
          setPublicoOpen(false);
          clearInterval(checkWindow);
        }
      }, 1000);
    }
  };

  const buscarInscrito = useCallback(async () => {
    setError(null);
    setInscritoAtual(null);
    setJaSorteado(false);
    setEquipeDestino(null);
    setShowResult(false);
    broadcastState(null, null, false, false, numero);

    const num = parseInt(numero);
    if (isNaN(num)) {
      setError('Digite um número válido');
      return;
    }

    const inscrito = getInscrito(num);
    
    if (!inscrito) {
      setError('Inscrito não encontrado');
      return;
    }

    setInscritoAtual(inscrito);
    const mensagemBloqueio = getMensagemBloqueioSorteioEquipe(inscrito.statusPagamento);
    if (mensagemBloqueio) {
      setError(mensagemBloqueio);
      return;
    }

    const sorteioExistente = await verificarSorteado(num);
    if (sorteioExistente) {
      setJaSorteado(true);
      const equipeSorteada = equipes.find(e => e.id === sorteioExistente.equipeId);
      if (equipeSorteada) {
        setEquipeDestino(equipeSorteada);
        broadcastState(inscrito, equipeSorteada, false, true);
      }
    }
  }, [numero, getInscrito, verificarSorteado, equipes, broadcastState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarInscrito();
    }
  };

  const handleSortear = async () => {
    if (!inscritoAtual || jaSorteado) return;
    const mensagemBloqueio = getMensagemBloqueioSorteioEquipe(inscritoAtual.statusPagamento);
    if (mensagemBloqueio) {
      setError(mensagemBloqueio);
      return;
    }

    setSorteando(true);
    setShowResult(false);

    const tempoTotal = 2000;
    const intervalo = 100;
    let tempoDecorrido = 0;

    const animacao = setInterval(() => {
      tempoDecorrido += intervalo;
      const randomIndex = Math.floor(Math.random() * equipes.length);
      const randomEquipe = equipes[randomIndex];
      setEquipeDestino(randomEquipe);
      broadcastState(inscritoAtual, randomEquipe, true, false);
      
      if (tempoDecorrido >= tempoTotal) {
        clearInterval(animacao);
      }
    }, intervalo);

    const equipeSorteada = await realizarSorteio(inscritoAtual.numero);
    
    await new Promise(resolve => setTimeout(resolve, tempoTotal + 200));
    clearInterval(animacao);

    if (equipeSorteada) {
      setEquipeDestino(equipeSorteada);
      setJaSorteado(true);
      setShowResult(true);
      broadcastState(inscritoAtual, equipeSorteada, false, true);
      reloadEquipes();
    } else {
      setError('Erro ao realizar sorteio');
    }

    setSorteando(false);
  };

  const limpar = () => {
    setNumero('');
    setInscritoAtual(null);
    setJaSorteado(false);
    setEquipeDestino(null);
    setError(null);
    setShowResult(false);
    broadcastState(null, null, false, false, '');
  };

  const handleNumeroChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '');
    setNumero(sanitized);
    broadcastState(null, null, false, false, sanitized);
  };

  if (inscritosLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
          <p className="mt-4 text-xl text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Back Button */}
      <div className="absolute top-4 left-4">
        <Link to="/sorteio">
          <Button variant="ghost" size="sm">
            <Home className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      {/* Broadcast Button */}
      <div className="absolute top-4 right-4">
        <Button 
          onClick={abrirPublico}
          variant={publicoOpen ? "secondary" : "default"}
          size="sm"
          className="gap-2"
        >
          <Monitor className="h-4 w-4" />
          {publicoOpen ? 'Tela Pública Aberta' : 'Abrir Tela para Público'}
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center pt-8">
          <h1 className="text-display-lg font-bold text-foreground">Sorteio de Equipes</h1>
          <p className="text-xl text-muted-foreground mt-2">
            Distribuicao de participantes entre equipes
          </p>
        </div>

        {/* Search */}
        <Card className="glass mx-auto max-w-xl">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Input
                type="number"
                placeholder="Número do inscrito"
                value={numero}
                onChange={(e) => handleNumeroChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-center text-3xl h-16"
                autoFocus
              />
              <Button onClick={buscarInscrito} size="lg" className="h-16 px-10 text-lg">
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-xl"
            >
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="flex items-center justify-center gap-3 p-4">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <span className="text-lg text-destructive">{error}</span>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inscrito Info */}
        <AnimatePresence>
          {inscritoAtual && !showResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className={`glass mx-auto max-w-3xl ${jaSorteado ? 'border-warning' : ''}`}>
                <CardContent className="p-8">
                  <div className="flex items-center gap-8">
                    <Avatar className="h-32 w-32 border-4 border-primary">
                      <AvatarImage src={inscritoAtual.fotoUrl} />
                      <AvatarFallback className="bg-primary/20 text-4xl">
                        <User className="h-16 w-16 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-4">
                      <div>
                        <p className="text-lg text-muted-foreground">Inscrito Nº {inscritoAtual.numero}</p>
                        <h2 className="text-display-sm font-bold">{inscritoAtual.nome}</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-info" />
                          <span className="text-lg">{inscritoAtual.idade} anos</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Church className="h-5 w-5 text-accent" />
                          <span className="text-lg">{inscritoAtual.igreja}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-warning" />
                          <span className="text-lg">{inscritoAtual.distrito}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {jaSorteado && (
                    <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-warning/20 p-4 text-warning">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-lg">Já sorteado para: <strong>{equipeDestino?.nome}</strong></span>
                    </div>
                  )}

                  {mensagemBloqueioPagamento && (
                    <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-lg">{mensagemBloqueioPagamento}</span>
                    </div>
                  )}

                  {!jaSorteado && !mensagemBloqueioPagamento && (
                    <div className="mt-8 text-center">
                      <Button
                        onClick={handleSortear}
                        disabled={sorteando}
                        size="lg"
                        className="h-20 px-16 text-2xl glow-primary"
                      >
                        {sorteando ? (
                          <>
                            <Loader2 className="mr-3 h-8 w-8 animate-spin" />
                            Sorteando...
                          </>
                        ) : (
                          <>
                            <Shuffle className="mr-3 h-8 w-8" />
                            Sortear Equipe
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animação do Sorteio */}
        <AnimatePresence>
          {equipeDestino && sorteando && !showResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-2xl"
            >
              <Card 
                className="overflow-hidden"
                style={{ borderColor: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))` }}
              >
                <div 
                  className="h-3"
                  style={{ backgroundColor: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))` }}
                />
                <CardContent className="p-12 text-center">
                  <motion.h2 
                    className="text-display-lg font-bold"
                    style={{ color: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))` }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.2, repeat: Infinity }}
                  >
                    {equipeDestino.nome}
                  </motion.h2>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resultado Final */}
        <AnimatePresence>
          {showResult && inscritoAtual && equipeDestino && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 150 }}
            >
              <Card 
                className="mx-auto max-w-4xl overflow-hidden"
                style={{ 
                  borderColor: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))`,
                  boxShadow: `0 0 80px ${equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))`}66`
                }}
              >
                <div 
                  className="h-3"
                  style={{ backgroundColor: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))` }}
                />
                <CardContent className="p-12 text-center space-y-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <Avatar className="mx-auto h-40 w-40 border-4 border-primary">
                      <AvatarImage src={inscritoAtual.fotoUrl} />
                      <AvatarFallback className="bg-primary/20 text-5xl">
                        <User className="h-20 w-20 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="text-2xl text-muted-foreground">Inscrito Nº {inscritoAtual.numero}</p>
                    <h2 className="text-display-md font-bold mt-2">{inscritoAtual.nome}</h2>
                    <p className="text-xl text-muted-foreground mt-2">
                      {inscritoAtual.igreja} • {inscritoAtual.distrito}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: "spring" }}
                  >
                    <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="space-y-4"
                  >
                    <p className="text-xl text-muted-foreground">Foi sorteado para a equipe</p>
                    <div
                      className="inline-block rounded-2xl px-16 py-8"
                      style={{
                        backgroundColor: `${equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))`}20`,
                        border: `3px solid ${equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))`}`,
                      }}
                    >
                      <h1
                        className="text-display-lg font-bold"
                        style={{ color: equipeDestino.corPulseira || `hsl(var(--team-${equipeDestino.cor}))` }}
                      >
                        {equipeDestino.nome}
                      </h1>
                      <p className="mt-2 text-lg text-muted-foreground">
                        Líder: {equipeDestino.lider} | Vice: {equipeDestino.vice}
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                  >
                    <Button onClick={limpar} size="lg" className="px-16 h-14 text-lg">
                      Próximo Sorteio
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teams Overview */}
        <div className="pt-4">
          <h2 className="mb-4 text-xl font-semibold text-center text-foreground">Distribuição Atual</h2>
          <div className="grid gap-3 grid-cols-4 lg:grid-cols-8">
            {equipes.map((equipe) => (
              <Card 
                key={equipe.id}
                className="glass"
                style={{ borderColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
              >
                <CardContent className="p-3 text-center">
                  <p className="font-semibold text-sm" style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}>
                    {equipe.nome}
                  </p>
                  <p className="text-2xl font-bold">{equipe.participantes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SorteioPopup;
