import { useState, useCallback, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useInscritos, useSorteios, useEquipesComParticipantes } from '@/hooks/useDatabase';
import { Shuffle, User, Church, MapPin, Calendar, AlertCircle, CheckCircle2, Loader2, Maximize2, ExternalLink, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SorteioResultPopup } from '@/components/sorteio/SorteioResultPopup';
import { getMensagemBloqueioSorteioEquipe } from '@/lib/pagamentoStatus';
import type { Inscrito, Equipe } from '@/types';

// Canal de broadcast para sincronização em tempo real
const SORTEIO_CHANNEL = 'sorteio-broadcast-channel';

const Sorteio = () => {
  const [numero, setNumero] = useState('');
  const [inscritoAtual, setInscritoAtual] = useState<Inscrito | null>(null);
  const [jaSorteado, setJaSorteado] = useState(false);
  const [equipeDestino, setEquipeDestino] = useState<Equipe | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [sorteadosSet, setSorteadosSet] = useState<Set<number>>(new Set());
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

  // Função para enviar broadcast
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

  const buscarInscrito = useCallback(async () => {
    setError(null);
    setInscritoAtual(null);
    setJaSorteado(false);
    setEquipeDestino(null);
    setShowResult(false);

    const num = parseInt(numero);
    if (isNaN(num)) {
      setError('Digite um número válido');
      return;
    }

    // Buscar na memória (Map)
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

    // Verificar se já foi sorteado
    const sorteioExistente = await verificarSorteado(num);
    if (sorteioExistente) {
      setJaSorteado(true);
      const equipeSorteada = equipes.find(e => e.id === sorteioExistente.equipeId);
      if (equipeSorteada) {
        setEquipeDestino(equipeSorteada);
      }
    }
  }, [numero, getInscrito, verificarSorteado, equipes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarInscrito();
    }
  };

  const handleOpenPublico = () => {
    const width = window.screen.width;
    const height = window.screen.height;
    window.open('/publico', 'sorteio-publico', `width=${width},height=${height},fullscreen=yes`);
  };

  const handleSortear = async () => {
    if (!inscritoAtual || jaSorteado || equipes.length === 0) return;
    const mensagemBloqueio = getMensagemBloqueioSorteioEquipe(inscritoAtual.statusPagamento);
    if (mensagemBloqueio) {
      setError(mensagemBloqueio);
      return;
    }

    setSorteando(true);
    setShowResult(false);

    // Animação de "roleta" mostrando equipes
    const tempoTotal = 2000;
    const intervalo = 100;
    let tempoDecorrido = 0;

    const animacao = setInterval(() => {
      tempoDecorrido += intervalo;
      const randomIndex = Math.floor(Math.random() * equipes.length);
      const randomEquipe = equipes[randomIndex];
      setEquipeDestino(randomEquipe);
      // Broadcast da animação em tempo real
      broadcastState(inscritoAtual, randomEquipe, true, false);

      if (tempoDecorrido >= tempoTotal) {
        clearInterval(animacao);
      }
    }, intervalo);

    // Realizar o sorteio real
    const equipeSorteada = await realizarSorteio(inscritoAtual.numero);

    // Esperar a animação terminar
    await new Promise(resolve => setTimeout(resolve, tempoTotal + 200));
    clearInterval(animacao);

    if (equipeSorteada) {
      setEquipeDestino(equipeSorteada);
      setJaSorteado(true);
      setShowResult(true);
      setShowPopup(true);
      setSorteadosSet(prev => new Set(prev).add(inscritoAtual.numero));
      // Broadcast do resultado final
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
    setShowPopup(false);
    // Broadcast reset
    broadcastState(null, null, false, false, '');
  };

  const handleNumeroChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '');
    setNumero(sanitized);
    broadcastState(null, null, false, false, sanitized);
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    limpar();
  };

  if (inscritosLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Carregando inscritos na memória...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="hidden md:block" />
          <div className="text-center">
            <h1 className="text-display-sm text-foreground">Sorteio de Equipes</h1>
            <p className="text-muted-foreground">
              Distribua os participantes nas equipes cadastradas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {inscritos.size} inscritos disponíveis
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPublico}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Tela Pública
            </Button>
          </div>
        </div>

        {/* Search Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-center">Digite o Número do Inscrito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Digite o número da sua inscrição/pulseira"
                value={numero}
                onChange={(e) => handleNumeroChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-center text-6xl leading-none h-16 tracking-widest placeholder:transition-opacity focus:placeholder-transparent"
                autoFocus
              />
              <Button onClick={buscarInscrito} size="lg" className="h-16 px-8 gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Digite apenas números. Ex.: 1, 25, 304
            </p>
          </CardContent>
        </Card>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">{error}</span>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inscrito Info */}
        <AnimatePresence>
          {inscritoAtual && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className={`glass ${jaSorteado && !showResult ? 'border-warning' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {/* Foto do Participante */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <img
                          src={inscritoAtual.fotoUrl || '/placeholder.svg'}
                          alt={inscritoAtual.nome}
                          className="h-32 w-32 md:h-40 md:w-40 rounded-2xl object-cover border-4 border-primary shadow-lg"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                        <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-bold shadow-md">
                          Nº {inscritoAtual.numero}
                        </div>
                      </div>
                    </div>

                    {/* Dados do Participante */}
                    <div className="flex-1 grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm text-muted-foreground">Nome</p>
                            <p className="text-xl font-semibold">{inscritoAtual.nome}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-info" />
                          <div>
                            <p className="text-sm text-muted-foreground">Idade</p>
                            <p className="text-xl font-semibold">{inscritoAtual.idade} anos</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Church className="h-5 w-5 text-accent" />
                          <div>
                            <p className="text-sm text-muted-foreground">Igreja</p>
                            <p className="text-xl font-semibold">{inscritoAtual.igreja}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-warning" />
                          <div>
                            <p className="text-sm text-muted-foreground">Distrito</p>
                            <p className="text-xl font-semibold">{inscritoAtual.distrito}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Already Sorted Warning */}
                  {jaSorteado && !showResult && (
                    <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-warning/20 p-4 text-warning">
                      <AlertCircle className="h-5 w-5" />
                      <span>Este inscrito já foi sorteado para a equipe <strong>{equipeDestino?.nome}</strong></span>
                    </div>
                  )}

                  {mensagemBloqueioPagamento && (
                    <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      <span>{mensagemBloqueioPagamento}</span>
                    </div>
                  )}

                  {/* Sort Button */}
                  {!jaSorteado && !mensagemBloqueioPagamento && equipes.length > 0 && (
                    <div className="mt-6 text-center">
                      <Button
                        onClick={handleSortear}
                        disabled={sorteando}
                        size="lg"
                        className="h-16 px-12 text-xl glow-primary"
                      >
                        {sorteando ? (
                          <>
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            Sorteando...
                          </>
                        ) : (
                          <>
                            <Shuffle className="mr-2 h-6 w-6" />
                            Sortear Equipe
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  {!jaSorteado && equipes.length === 0 && (
                    <div className="mt-6 text-center text-warning">
                      <AlertCircle className="mx-auto h-6 w-6 mb-2" />
                      <p>Cadastre equipes antes de realizar o sorteio</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team Result Animation */}
        <AnimatePresence>
          {equipeDestino && (sorteando || showResult) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: 1,
                scale: showResult ? 1 : [0.95, 1.05, 0.95],
              }}
              transition={{
                duration: showResult ? 0.5 : 0.2,
                repeat: showResult ? 0 : Infinity,
              }}
            >
              <Card
                className={`overflow-hidden ${showResult ? 'animate-bounce-in' : ''}`}
                style={{
                  borderColor: `hsl(var(--team-${equipeDestino.cor}))`,
                  boxShadow: showResult ? `0 0 40px hsl(var(--team-${equipeDestino.cor}) / 0.5)` : undefined
                }}
              >
                <div
                  className="h-2"
                  style={{ backgroundColor: `hsl(var(--team-${equipeDestino.cor}))` }}
                />
                <CardContent className="p-8 text-center">
                  {showResult && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-success" />
                    </motion.div>
                  )}
                  <h2 className="text-display-md font-bold" style={{ color: `hsl(var(--team-${equipeDestino.cor}))` }}>
                    {equipeDestino.nome}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Líder: {equipeDestino.lider} | Vice: {equipeDestino.vice}
                  </p>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 flex justify-center gap-3"
                    >
                      <Button onClick={() => setShowPopup(true)} variant="outline" size="lg">
                        <Maximize2 className="mr-2 h-4 w-4" />
                        Abrir Popup
                      </Button>
                      <Button onClick={limpar} variant="outline" size="lg">
                        Sortear Outro
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teams Overview */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Distribuição Atual</h2>
          <div className="grid gap-3 md:grid-cols-4">
            {equipes.map((equipe) => (
              <Card
                key={equipe.id}
                className="glass"
                style={{ borderColor: `hsl(var(--team-${equipe.cor}))` }}
              >
                <CardContent className="p-4 text-center">
                  <p className="font-semibold" style={{ color: `hsl(var(--team-${equipe.cor}))` }}>
                    {equipe.nome}
                  </p>
                  <p className="text-2xl font-bold">{equipe.participantes}</p>
                  <p className="text-sm text-muted-foreground">participantes</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Result Popup */}
      <SorteioResultPopup
        open={showPopup}
        onClose={handleClosePopup}
        inscrito={inscritoAtual}
        equipe={equipeDestino}
      />
    </MainLayout>
  );
};

export default Sorteio;
