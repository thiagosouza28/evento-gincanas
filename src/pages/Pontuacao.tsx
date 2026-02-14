import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEquipesComParticipantes, usePontuacoes, useGincanas, useInscritos, useSorteios, useSystemConfig } from '@/hooks/useDatabase';
import { Plus, Minus, History, Loader2, Trophy, Users, ListChecks, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { generatePontuacaoEquipePDF, generatePontuacaoGeralPDF } from '@/lib/pdfGenerator';
import { useEventoNome } from '@/hooks/useEventoNome';
import * as torneioService from '@/lib/torneioService';
import type { Torneio } from '@/types/torneio';
import type { Inscrito, EquipeComParticipantes } from '@/types';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const PARTICIPANTE_NAO_ENCONTRADO = 'Participante não encontrado.';

function findParticipanteByQuery(inscritos: Inscrito[], rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) {
    return { error: 'Informe o nome, número ou pulseira do participante ou equipe.' };
  }

  const isNumeric = /^\d+$/.test(query);

  if (isNumeric) {
    const numero = Number(query);
    const matchNumero = inscritos.find((i) => i.numero === numero);
    if (matchNumero) {
      return { participante: matchNumero };
    }

    const matchesPulseira = inscritos.filter((i) => {
      if (!i.numeroPulseira) return false;
      const pulseira = i.numeroPulseira.trim();
      if (pulseira === query) return true;
      const pulseiraNum = Number(pulseira);
      return Number.isFinite(pulseiraNum) && pulseiraNum === numero;
    });

    if (matchesPulseira.length === 1) {
      return { participante: matchesPulseira[0] };
    }

    if (matchesPulseira.length > 1) {
      return { error: 'Mais de um participante encontrado para este número de pulseira.' };
    }

    return { error: PARTICIPANTE_NAO_ENCONTRADO };
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { error: 'Informe o nome, número ou pulseira do participante ou equipe.' };
  }

  const exactMatches = inscritos.filter((i) => normalizeText(i.nome) === normalizedQuery);
  if (exactMatches.length === 1) {
    return { participante: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { error: 'Mais de um participante com este nome. Use número ou pulseira.' };
  }

  const partialMatches = inscritos.filter((i) => normalizeText(i.nome).includes(normalizedQuery));
  if (partialMatches.length === 1) {
    return { participante: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { error: 'Mais de um participante encontrado. Seja mais específico.' };
  }

  return { error: PARTICIPANTE_NAO_ENCONTRADO };
}

function findEquipeByQuery(equipes: EquipeComParticipantes[], rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) {
    return { error: 'Informe o nome ou número da equipe.' };
  }

  const isNumeric = /^\d+$/.test(query);
  if (isNumeric) {
    const numero = Number(query);
    const matchNumero = equipes.find((e) => e.numero === numero);
    if (matchNumero) {
      return { equipe: matchNumero };
    }
    return { error: 'Equipe não encontrada.' };
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { error: 'Informe o nome ou número da equipe.' };
  }

  const exactMatches = equipes.filter((e) => normalizeText(e.nome) === normalizedQuery);
  if (exactMatches.length === 1) {
    return { equipe: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { error: 'Mais de uma equipe com este nome. Seja mais específico.' };
  }

  const partialMatches = equipes.filter((e) => normalizeText(e.nome).includes(normalizedQuery));
  if (partialMatches.length === 1) {
    return { equipe: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { error: 'Mais de uma equipe encontrada. Seja mais específico.' };
  }

  return { error: 'Equipe não encontrada.' };
}

const Pontuacao = () => {
  const { equipes, loading: equipesLoading, reload: reloadEquipes } = useEquipesComParticipantes();
  const { pontuacoes, adicionarPontuacao, loading: pontuacoesLoading } = usePontuacoes();
  const { gincanas, loading: gincanasLoading } = useGincanas();
  const { inscritos, loading: inscritosLoading } = useInscritos();
  const { sorteios, loading: sorteiosLoading } = useSorteios();
  const { config: systemConfig, loading: systemLoading } = useSystemConfig();
  const { eventoNome } = useEventoNome();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [torneiosLoading, setTorneiosLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchError, setSearchError] = useState('');
  const [selectedParticipante, setSelectedParticipante] = useState<Inscrito | null>(null);
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [selectedGincana, setSelectedGincana] = useState<string>('');
  const [pontos, setPontos] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPenalty, setIsPenalty] = useState(false);

  const inscritosList = useMemo(() => Array.from(inscritos.values()), [inscritos]);
  const selectedEquipe = selectedEquipeId ? equipes.find((e) => e.id === selectedEquipeId) : null;
  const minEquipes = systemConfig?.minEquipes ?? 2;
  const hasMinTeams = equipes.length >= minEquipes;

  const loading =
    equipesLoading ||
    pontuacoesLoading ||
    gincanasLoading ||
    inscritosLoading ||
    sorteiosLoading ||
    systemLoading ||
    torneiosLoading;

  useEffect(() => {
    let active = true;
    const loadTorneios = async () => {
      try {
        const data = await torneioService.getAllTorneios();
        if (active) {
          setTorneios(data);
        }
      } catch (error) {
        console.error('Erro ao carregar competições:', error);
      } finally {
        if (active) {
          setTorneiosLoading(false);
        }
      }
    };
    loadTorneios();
    return () => {
      active = false;
    };
  }, []);

  const resetForm = () => {
    setSearchTerm('');
    setSearchError('');
    setSelectedParticipante(null);
    setSelectedEquipeId(null);
    setSelectedGincana('');
    setPontos('');
    setObservacao('');
    setIsPenalty(false);
  };

  const handleBuscarParticipante = () => {
    setSearchError('');
    setSelectedParticipante(null);
    setSelectedEquipeId(null);

    if (inscritosList.length === 0 && equipes.length === 0) {
      setSearchError('Nenhum participante ou equipe cadastrada.');
      return;
    }

    const result = findParticipanteByQuery(inscritosList, searchTerm);
    if (result.error || !result.participante) {
      if (result.error && result.error !== PARTICIPANTE_NAO_ENCONTRADO) {
        setSearchError(result.error);
        return;
      }

      const equipeResult = findEquipeByQuery(equipes, searchTerm);
      if (equipeResult.equipe) {
        setSelectedEquipeId(equipeResult.equipe.id);
        return;
      }

      setSearchError(equipeResult.error || result.error || 'Participante ou equipe não encontrada.');
      return;
    }

    const participante = result.participante;
    const sorteiosParticipante = sorteios.filter((s) => s.numeroInscrito === participante.numero);

    if (sorteiosParticipante.length === 0) {
      setSearchError('Participante ainda não foi vinculado a uma equipe.');
      return;
    }

    if (sorteiosParticipante.length > 1) {
      setSearchError('Participante vinculado a mais de uma equipe. Revise os sorteios.');
      return;
    }

    const equipeId = sorteiosParticipante[0].equipeId;
    const equipe = equipes.find((e) => e.id === equipeId);

    if (!equipe) {
      setSearchError('Equipe do participante não encontrada.');
      return;
    }

    setSelectedParticipante(participante);
    setSelectedEquipeId(equipe.id);
  };

  const handleAddPontos = async () => {
    if (!hasMinTeams) {
      toast.error(`É necessário ter pelo menos ${minEquipes} equipes cadastradas.`);
      return;
    }

    if (!selectedEquipe) {
      toast.error('Identifique um participante ou equipe antes de lançar pontos.');
      return;
    }

    if (!selectedGincana) {
      toast.error('Selecione a gincana/modalidade.');
      return;
    }

    const pontosNum = Number(pontos);
    if (!Number.isFinite(pontosNum) || pontosNum <= 0) {
      toast.error('Informe um valor de pontos válido.');
      return;
    }

    if (isPenalty && selectedEquipe.pontuacaoTotal - pontosNum < 0) {
      toast.error('A pontuação da equipe não pode ficar negativa.');
      return;
    }

    await adicionarPontuacao(
      selectedEquipe.id,
      isPenalty ? -pontosNum : pontosNum,
      selectedGincana,
      observacao || undefined,
      selectedParticipante?.numero
    );
    reloadEquipes();
    toast.success('Pontuação registrada com sucesso.');

    resetForm();
    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const getEquipeNome = (equipeId: string) => {
    return equipes.find((e) => e.id === equipeId)?.nome || 'Equipe';
  };

  const getEquipeCor = (equipeId: string) => {
    return equipes.find((e) => e.id === equipeId)?.cor || 1;
  };

  const getEquipeImagem = (equipeId: string) => {
    return equipes.find((e) => e.id === equipeId)?.imagemUrl;
  };

  const getGincanaNome = (gincanaId: string) => {
    return gincanas.find((g) => g.id === gincanaId)?.nome || gincanaId;
  };

  const getParticipanteNome = (numeroInscrito?: number) => {
    if (!numeroInscrito) return undefined;
    return inscritos.get(numeroInscrito)?.nome;
  };

  const totalPontos = pontuacoes.reduce((sum, p) => sum + p.pontos, 0);

  const handleExportPontuacaoGeral = async () => {
    const pdfBranding = eventoNome
      ? { eventName: eventoNome, logoUrl: '/icon.png' }
      : undefined;
    toast.info('Gerando PDF geral...');
    await generatePontuacaoGeralPDF(equipes, gincanas, torneios, pontuacoes, pdfBranding);
    toast.success('PDF geral gerado com sucesso.');
  };

  const handleExportPontuacaoEquipe = async (equipe: EquipeComParticipantes) => {
    const pdfBranding = eventoNome
      ? { eventName: eventoNome, logoUrl: '/icon.png' }
      : undefined;
    toast.info(`Gerando PDF da equipe ${equipe.nome}...`);
    await generatePontuacaoEquipePDF(equipe, gincanas, torneios, pontuacoes, pdfBranding);
    toast.success('PDF da equipe gerado com sucesso.');
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-foreground">Pontuação</h1>
            <p className="text-muted-foreground">Pontuação geral das equipes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportPontuacaoGeral}
              disabled={equipes.length === 0}
            >
              <FileDown className="h-4 w-4" />
              PDF Geral
            </Button>
            <Button
              className="gap-2"
              onClick={() => setIsDialogOpen(true)}
              disabled={!hasMinTeams}
            >
              <Plus className="h-4 w-4" />
              Lançar Pontos
            </Button>
          </div>
        </div>

        {!hasMinTeams && (
          <Card className="glass border-destructive/50">
            <CardContent className="pt-6 text-sm text-destructive">
              É necessário ter pelo menos {minEquipes} equipes cadastradas para lançar ou descontar pontos. Atualmente: {equipes.length}.
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass border-border/60">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de pontos</p>
                <p className="text-2xl font-bold">{totalPontos}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/60">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-success/15 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Lançamentos</p>
                <p className="text-2xl font-bold">{pontuacoes.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/60">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-secondary/40 flex items-center justify-center">
                <Users className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipes</p>
                <p className="text-2xl font-bold">{equipes.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/60">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center">
                <History className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gincanas</p>
                <p className="text-2xl font-bold">{gincanas.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teams Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {equipes
            .sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal)
            .map((equipe, index) => (
              <motion.div
                key={equipe.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="glass overflow-hidden relative transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderColor: `hsl(var(--team-${equipe.cor}))` }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-3 top-3 h-8 w-8"
                    onClick={() => handleExportPontuacaoEquipe(equipe)}
                    title={`PDF da equipe ${equipe.nome}`}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <div
                    className="h-2"
                    style={{ backgroundColor: `hsl(var(--team-${equipe.cor}))` }}
                  />
                  <div
                    className={`absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-semibold ${
                      index === 0
                        ? 'bg-gold/20 text-gold'
                        : index === 1
                        ? 'bg-silver/20 text-silver'
                        : index === 2
                        ? 'bg-bronze/20 text-bronze'
                        : 'bg-secondary/40 text-muted-foreground'
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      {equipe.imagemUrl ? (
                        <div
                          className="h-12 w-12 rounded-full overflow-hidden border-2"
                          style={{ borderColor: `hsl(var(--team-${equipe.cor}))` }}
                        >
                          <img
                            src={equipe.imagemUrl}
                            alt={equipe.nome}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className="h-12 w-12 rounded-full border-2"
                          style={{ borderColor: `hsl(var(--team-${equipe.cor}))` }}
                        />
                      )}
                      <div className="min-w-0">
                        <CardTitle
                          className="text-lg truncate"
                          style={{ color: `hsl(var(--team-${equipe.cor}))` }}
                        >
                          {equipe.nome}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Num. {equipe.numero}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 items-end">
                      <div>
                        <p className="text-3xl font-bold">{equipe.pontuacaoTotal}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">pontos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold">{equipe.participantes}</p>
                        <p className="text-xs text-muted-foreground">participantes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
        </div>

        {/* History */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Histórico de Lançamentos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {pontuacoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum lançamento registrado
              </p>
            ) : (
              <div className="custom-scrollbar space-y-3 max-h-96 overflow-y-auto pr-1">
                {pontuacoes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-card/40 p-4 transition-colors hover:bg-card/60"
                  >
                    <div className="flex items-center gap-3">
                      {getEquipeImagem(p.equipeId) ? (
                        <div
                          className="h-10 w-10 rounded-full overflow-hidden border-2"
                          style={{ borderColor: `hsl(var(--team-${getEquipeCor(p.equipeId)}))` }}
                        >
                          <img
                            src={getEquipeImagem(p.equipeId)}
                            alt={getEquipeNome(p.equipeId)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full border-2"
                          style={{ borderColor: `hsl(var(--team-${getEquipeCor(p.equipeId)}))` }}
                        />
                      )}
                      <div>
                        <p className="font-medium">{getEquipeNome(p.equipeId)}</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {getGincanaNome(p.gincanaId)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.dataHora).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {p.numeroInscrito && (
                          <p className="text-xs text-muted-foreground">
                            Participante: {getParticipanteNome(p.numeroInscrito) || `Num. ${p.numeroInscrito}`}
                          </p>
                        )}
                        {p.observacao && (
                          <p className="text-sm text-muted-foreground">{p.observacao}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${p.pontos >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {p.pontos >= 0 ? '+' : ''}{p.pontos}
                      </p>
                      <p className="text-xs text-muted-foreground">pontos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Points Dialog */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isPenalty ? 'Aplicar Penalidade' : 'Adicionar Pontos'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={isPenalty ? 'outline' : 'default'}
                  onClick={() => setIsPenalty(false)}
                  className="flex-1"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant={isPenalty ? 'destructive' : 'outline'}
                  onClick={() => setIsPenalty(true)}
                  className="flex-1"
                >
                  <Minus className="mr-1 h-4 w-4" />
                  Penalidade
                </Button>
              </div>

              <div>
                <Label htmlFor="participante">Participante ou equipe (nome, número ou pulseira)</Label>
                <div className="flex gap-2">
                  <Input
                    id="participante"
                    placeholder="Ex: Maria Silva, Equipe Azul ou 123"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSearchError('');
                      setSelectedParticipante(null);
                      setSelectedEquipeId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleBuscarParticipante();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBuscarParticipante}
                    disabled={!searchTerm.trim()}
                  >
                    Buscar
                  </Button>
                </div>
                {searchError && (
                  <p className="text-sm text-destructive mt-2">{searchError}</p>
                )}
              </div>

              {selectedEquipe && (
                <Card className="border-border/70 bg-secondary/30">
                  <CardContent className="pt-4 space-y-2">
                    {selectedParticipante && (
                      <div>
                        <p className="text-sm text-muted-foreground">Participante</p>
                        <p className="font-semibold">{selectedParticipante.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Num. {selectedParticipante.numero} - Pulseira {selectedParticipante.numero}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Equipe</p>
                      <p
                        className="font-semibold"
                        style={{ color: `hsl(var(--team-${selectedEquipe.cor}))` }}
                      >
                        {selectedEquipe.nome} (Num. {selectedEquipe.numero})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pontuação atual: {selectedEquipe.pontuacaoTotal} pts
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label htmlFor="gincana">Gincana/Modalidade</Label>
                <Select value={selectedGincana} onValueChange={setSelectedGincana}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a gincana" />
                  </SelectTrigger>
                  <SelectContent>
                    {gincanas.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pontos">
                  {isPenalty ? 'Pontos a descontar' : 'Pontos a adicionar'}
                </Label>
                <Input
                  id="pontos"
                  type="number"
                  min="1"
                  placeholder="Ex: 100"
                  value={pontos}
                  onChange={(e) => setPontos(e.target.value)}
                  className="text-2xl text-center h-14"
                />
              </div>
              <div>
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Input
                  id="observacao"
                  placeholder="Ex: 1º lugar"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddPontos}
                  disabled={!pontos || !selectedGincana || !selectedEquipe}
                  variant={isPenalty ? 'destructive' : 'default'}
                >
                  {isPenalty ? 'Aplicar Penalidade' : 'Adicionar Pontos'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Pontuacao;
