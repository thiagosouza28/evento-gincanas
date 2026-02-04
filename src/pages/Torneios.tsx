import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSystemConfig } from '@/hooks/useDatabase';
import { Trophy, Plus, Shuffle, Play, Check, Trash2, Eye, Settings, Dices, ExternalLink } from 'lucide-react';
import { TournamentBracket } from '@/components/torneio/TournamentBracket';
import * as torneioService from '@/lib/torneioService';
import type { Gincana, Equipe, Pontuacao } from '@/types';
import type { Torneio, Confronto } from '@/types/torneio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Canal de broadcast para sincronização do sorteio de torneio
const TORNEIO_SORTEIO_CHANNEL = 'torneio-sorteio-broadcast-channel';
const TORNEIO_SORTEIO_DELAY_MS = 2500;

export default function Torneios() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { config: systemConfig } = useSystemConfig();
  
  // Estados
  const [gincanas, setGincanas] = useState<Gincana[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [confrontos, setConfrontos] = useState<Confronto[]>([]);
  const [loading, setLoading] = useState(true);
  const minEquipes = systemConfig?.minEquipes ?? 2;
  const hasMinTeams = equipes.length >= minEquipes;
  
  // Torneio selecionado para visualização
  const [selectedTorneio, setSelectedTorneio] = useState<Torneio | null>(null);
  
  // Estado do sorteio passo a passo
  const [sorteioAtivo, setSorteioAtivo] = useState(false);
  const [ultimoSorteado, setUltimoSorteado] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  
  // BroadcastChannel para tela pública
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  
  // Inicializar BroadcastChannel
  useEffect(() => {
    broadcastChannelRef.current = new BroadcastChannel(TORNEIO_SORTEIO_CHANNEL);
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);
  
  // Dialog de criação
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: '',
    gincana_id: '',
    pontos_primeiro: 100,
    pontos_segundo: 70,
    pontos_terceiro: 50,
    pontos_participacao: 0,
  });
  
  // Carregar dados
  useEffect(() => {
    loadData();
  }, []);
  
  // Subscription realtime quando um torneio é selecionado
  useEffect(() => {
    if (!selectedTorneio) return;
    
    const unsubscribe = torneioService.subscribeTorneioUpdates(
      selectedTorneio.id,
      (newConfrontos) => setConfrontos(newConfrontos)
    );
    
    return unsubscribe;
  }, [selectedTorneio?.id]);
  
  async function loadData() {
    try {
      setLoading(true);
      const [gincanasRes, equipesRes, torneiosData] = await Promise.all([
        supabase.from('gincanas').select('*').order('created_at', { ascending: false }),
        supabase.from('equipes').select('*').order('nome'),
        torneioService.getAllTorneios(),
      ]);

      if (gincanasRes.error) {
        throw gincanasRes.error;
      }

      if (equipesRes.error) {
        throw equipesRes.error;
      }

      const gincanasData = (gincanasRes.data || []).map((row) => ({
        id: row.id,
        nome: row.nome,
        categoria: row.categoria as Gincana['categoria'],
        ativa: row.ativa || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const equipesData = (equipesRes.data || []).map((row) => ({
        id: row.id,
        nome: row.nome,
        numero: row.numero,
        lider: row.lider,
        vice: row.vice,
        cor: row.cor,
        corPulseira: row.cor_pulseira || undefined,
        imagemUrl: row.imagem_url || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setGincanas(gincanasData);
      setEquipes(equipesData);
      setTorneios(torneiosData);
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const handleOpenPublico = () => {
    const width = window.screen.width;
    const height = window.screen.height;
    window.open('/publico-torneio', 'torneio-publico', `width=${width},height=${height},fullscreen=yes`);
  };
  
  async function handleCreateTorneio() {
    if (!createForm.nome || !createForm.gincana_id) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    
    try {
      const novo = await torneioService.createTorneio({
        nome: createForm.nome,
        gincana_id: createForm.gincana_id,
        status: 'pendente',
        pontos_primeiro: createForm.pontos_primeiro,
        pontos_segundo: createForm.pontos_segundo,
        pontos_terceiro: createForm.pontos_terceiro,
        pontos_participacao: createForm.pontos_participacao,
      });
      
      setTorneios(prev => [novo, ...prev]);
      setIsCreating(false);
      setCreateForm({ nome: '', gincana_id: '', pontos_primeiro: 100, pontos_segundo: 70, pontos_terceiro: 50, pontos_participacao: 0 });
      toast({ title: 'Torneio criado!' });
    } catch (error) {
      toast({ title: 'Erro ao criar torneio', variant: 'destructive' });
    }
  }
  
  async function handleSelectTorneio(torneio: Torneio) {
    setSelectedTorneio(torneio);
    const conf = await torneioService.getConfrontosByTorneio(torneio.id);
    setConfrontos(conf);
  }
  
  // Iniciar sorteio passo a passo
  async function handleIniciarSorteio() {
    if (!selectedTorneio) return;
    
    if (equipes.length < 8) {
      toast({ title: 'É necessário ter 8 equipes cadastradas', variant: 'destructive' });
      return;
    }
    
    try {
      const novosConfrontos = await torneioService.iniciarSorteioPasso(selectedTorneio.id);
      setConfrontos(novosConfrontos);
      setSorteioAtivo(true);
      setUltimoSorteado(null);
      
      // Atualizar status do torneio na lista
      setTorneios(prev => prev.map(t => 
        t.id === selectedTorneio.id ? { ...t, status: 'em_andamento' as const } : t
      ));
      setSelectedTorneio(prev => prev ? { ...prev, status: 'em_andamento' } : null);
      
      toast({ title: 'Sorteio iniciado! Clique em "Sortear" para cada equipe.' });
    } catch (error) {
      toast({ title: 'Erro ao iniciar sorteio', variant: 'destructive' });
    }
  }
  
  // Sortear próxima equipe
  async function handleSortearProximo() {
    if (!selectedTorneio || sorteando) return;
    
    const posicaoAtual = torneioService.getProximoNumeroSorteio(confrontos);
    
    setSorteando(true);
    setUltimoSorteado(null);
    
    // Gerar dados de confrontos para broadcast
    const getConfrontosBroadcast = (confrontosAtuais: Confronto[]) => {
      const quartasFinal = confrontosAtuais.filter(c => c.fase === 'quartas');
      return [1, 2, 3, 4].map(num => {
        const conf = quartasFinal.find(c => c.ordem === num);
        return {
          numero: num,
          equipe1: conf?.equipe1_id ? equipes.find(e => e.id === conf.equipe1_id) || null : null,
          equipe2: conf?.equipe2_id ? equipes.find(e => e.id === conf.equipe2_id) || null : null,
        };
      });
    };
    
    // Broadcast: iniciar animação de sorteio
    broadcastChannelRef.current?.postMessage({
      type: 'sorteando',
      posicao: posicaoAtual,
      equipe: null,
      torneioNome: selectedTorneio.nome,
      confrontos: getConfrontosBroadcast(confrontos),
    });

    // Mantém a animação de sorteio por um tempo para dar suspense
    await new Promise(resolve => setTimeout(resolve, TORNEIO_SORTEIO_DELAY_MS));
    
    try {
      const equipesIds = equipes.slice(0, 8).map(e => e.id);
      const resultado = await torneioService.sortearProximaEquipe(
        selectedTorneio.id,
        confrontos,
        equipesIds
      );
      
      if (resultado) {
        // Atualizar confrontos
        const updated = await torneioService.getConfrontosByTorneio(selectedTorneio.id);
        setConfrontos(updated);
        setUltimoSorteado(resultado.equipeId);
        
        const equipe = equipes.find(e => e.id === resultado.equipeId);
        
        // Broadcast: resultado do sorteio
        broadcastChannelRef.current?.postMessage({
          type: 'resultado',
          posicao: posicaoAtual,
          equipe: equipe || null,
          torneioNome: selectedTorneio.nome,
          confrontos: getConfrontosBroadcast(updated),
        });
        
        // Verificar se sorteio está completo
        if (torneioService.isSorteioQuartasCompleto(updated)) {
          setSorteioAtivo(false);
          toast({ title: 'Sorteio completo! Todos os confrontos definidos.' });
          
          // Broadcast: sorteio completo com resumo (aguarda a animação final)
          setTimeout(() => {
            broadcastChannelRef.current?.postMessage({
              type: 'completo',
              posicao: 8,
              equipe: null,
              torneioNome: selectedTorneio.nome,
              confrontos: getConfrontosBroadcast(updated),
            });
          }, 6000);
        } else {
          toast({ title: `Sorteado: ${equipe?.nome || 'Equipe'}` });
        }
      } else {
        setSorteioAtivo(false);
        toast({ title: 'Sorteio completo!' });
        
        // Broadcast: sorteio completo
        broadcastChannelRef.current?.postMessage({
          type: 'completo',
          posicao: 8,
          equipe: null,
          torneioNome: selectedTorneio.nome,
          confrontos: getConfrontosBroadcast(confrontos),
        });
      }
    } catch (error) {
      toast({ title: 'Erro ao sortear equipe', variant: 'destructive' });
      
      // Broadcast: fechar popup em caso de erro
      broadcastChannelRef.current?.postMessage({
        type: 'fechar',
        posicao: 0,
        equipe: null,
        torneioNome: '',
        confrontos: [],
      });
    } finally {
      setSorteando(false);
    }
  }
  
  async function handleSelectWinner(confrontoId: string, vencedorId: string) {
    try {
      await torneioService.registrarVencedor(confrontoId, vencedorId, confrontos);
      
      // Recarregar confrontos
      if (selectedTorneio) {
        const updated = await torneioService.getConfrontosByTorneio(selectedTorneio.id);
        setConfrontos(updated);
        
        // Verificar se torneio finalizou
        if (torneioService.isTorneioFinalizado(updated)) {
          await handleFinalizarTorneio(updated);
        }
      }
      
      toast({ title: 'Vencedor registrado!' });
    } catch (error) {
      toast({ title: 'Erro ao registrar vencedor', variant: 'destructive' });
    }
  }
  
  async function handleFinalizarTorneio(confrontosAtuais: Confronto[]) {
    if (!selectedTorneio || !user) return;

    if (!hasMinTeams) {
      toast({
        title: 'Numero minimo de equipes nao atingido',
        description: `Necessario ter pelo menos ${minEquipes} equipes para aplicar pontuacao.`,
        variant: 'destructive',
      });

      await torneioService.updateTorneio(selectedTorneio.id, { status: 'finalizado' });
      setTorneios(prev => prev.map(t =>
        t.id === selectedTorneio.id ? { ...t, status: 'finalizado' as const } : t
      ));
      setSelectedTorneio(prev => prev ? { ...prev, status: 'finalizado' } : null);
      return;
    }
    
    const resultado = torneioService.calcularResultado(confrontosAtuais);
    
    // Aplicar pontuação usando o sistema existente
    const gincanaId = selectedTorneio.gincana_id;
    const now = new Date().toISOString();
    
    const pontuacoes: Omit<Pontuacao, 'id'>[] = [];
    
    if (resultado.primeiro) {
      pontuacoes.push({
        gincanaId,
        equipeId: resultado.primeiro,
        pontos: selectedTorneio.pontos_primeiro,
        observacao: `1º lugar - ${selectedTorneio.nome}`,
        dataHora: now,
      });
    }
    
    if (resultado.segundo) {
      pontuacoes.push({
        gincanaId,
        equipeId: resultado.segundo,
        pontos: selectedTorneio.pontos_segundo,
        observacao: `2º lugar - ${selectedTorneio.nome}`,
        dataHora: now,
      });
    }
    
    if (resultado.terceiro) {
      pontuacoes.push({
        gincanaId,
        equipeId: resultado.terceiro,
        pontos: selectedTorneio.pontos_terceiro,
        observacao: `3º lugar - ${selectedTorneio.nome}`,
        dataHora: now,
      });
    }
    
    // Pontos de participação para equipes eliminadas nas quartas (4º ao 8º)
    if (selectedTorneio.pontos_participacao > 0) {
      // Pegar todas as equipes que participaram
      const todasEquipes = new Set<string>();
      const quartas = confrontosAtuais.filter(c => c.fase === 'quartas');
      quartas.forEach(c => {
        if (c.equipe1_id) todasEquipes.add(c.equipe1_id);
        if (c.equipe2_id) todasEquipes.add(c.equipe2_id);
      });
      
      // Remover as 4 que ficaram no pódio (1º, 2º, 3º, 4º)
      const equipesNoPodio = new Set([
        resultado.primeiro,
        resultado.segundo,
        resultado.terceiro,
        resultado.quarto,
      ].filter(Boolean) as string[]);
      
      // As equipes restantes são as eliminadas nas quartas
      const equipesEliminadas = Array.from(todasEquipes).filter(id => !equipesNoPodio.has(id));
      
      for (const equipeId of equipesEliminadas) {
        pontuacoes.push({
          gincanaId,
          equipeId,
          pontos: selectedTorneio.pontos_participacao,
          observacao: `Participação - ${selectedTorneio.nome}`,
          dataHora: now,
        });
      }
    }
    
    // Salvar pontuações no Supabase
    if (pontuacoes.length > 0) {
      const { error } = await supabase.from('pontuacoes').insert(
        pontuacoes.map(p => ({
          user_id: user.id,
          equipe_id: p.equipeId,
          gincana_id: p.gincanaId,
          pontos: p.pontos,
          observacao: p.observacao || null,
          data_hora: p.dataHora,
        }))
      );

      if (error) {
        throw error;
      }
    }
    
    // Atualizar status do torneio
    await torneioService.updateTorneio(selectedTorneio.id, { status: 'finalizado' });
    
    setTorneios(prev => prev.map(t => 
      t.id === selectedTorneio.id ? { ...t, status: 'finalizado' as const } : t
    ));
    setSelectedTorneio(prev => prev ? { ...prev, status: 'finalizado' } : null);
    
    toast({ 
      title: 'Torneio finalizado!', 
      description: 'Pontuação aplicada às equipes automaticamente.' 
    });
  }
  
  async function handleDeleteTorneio(id: string) {
    try {
      await torneioService.deleteTorneio(id);
      setTorneios(prev => prev.filter(t => t.id !== id));
      if (selectedTorneio?.id === id) {
        setSelectedTorneio(null);
        setConfrontos([]);
      }
      toast({ title: 'Torneio excluído' });
    } catch (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  }
  
  function getGincanaNome(id: string) {
    return gincanas.find(g => g.id === id)?.nome || 'Gincana não encontrada';
  }
  
  function getStatusBadge(status: Torneio['status']) {
    switch (status) {
      case 'pendente':
        return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">Pendente</span>;
      case 'em_andamento':
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">Em andamento</span>;
      case 'finalizado':
        return <span className="px-2 py-1 text-xs rounded-full bg-success/20 text-success">Finalizado</span>;
    }
  }
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm font-bold text-foreground">Torneios</h1>
            <p className="text-muted-foreground">Gerencie torneios eliminatórios das modalidades</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenPublico} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Tela Pública
            </Button>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Torneio
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Torneio</DialogTitle>
                </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Torneio</Label>
                  <Input 
                    placeholder="Ex: Futebol Masculino"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Gincana/Modalidade</Label>
                  <Select 
                    value={createForm.gincana_id} 
                    onValueChange={(v) => setCreateForm(prev => ({ ...prev, gincana_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a gincana" />
                    </SelectTrigger>
                    <SelectContent>
                      {gincanas.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>1º Lugar</Label>
                    <Input 
                      type="number"
                      value={createForm.pontos_primeiro}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, pontos_primeiro: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>2º Lugar</Label>
                    <Input 
                      type="number"
                      value={createForm.pontos_segundo}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, pontos_segundo: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>3º Lugar</Label>
                    <Input 
                      type="number"
                      value={createForm.pontos_terceiro}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, pontos_terceiro: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Participação</Label>
                    <Input 
                      type="number"
                      placeholder="0"
                      value={createForm.pontos_participacao}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, pontos_participacao: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
                <Button onClick={handleCreateTorneio}>Criar Torneio</Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Torneios */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Torneios</CardTitle>
              <CardDescription>{torneios.length} torneio(s) cadastrado(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : torneios.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum torneio cadastrado</p>
              ) : (
                torneios.map(t => (
                  <div 
                    key={t.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTorneio?.id === t.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectTorneio(t)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{t.nome}</p>
                        <p className="text-xs text-muted-foreground">{getGincanaNome(t.gincana_id)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(t.status)}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir torneio?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. {t.status === 'finalizado' && 'A pontuação já aplicada NÃO será removida.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTorneio(t.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          
          {/* Visualização do Bracket */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedTorneio ? selectedTorneio.nome : 'Chave do Torneio'}
                  </CardTitle>
                  {selectedTorneio && (
                    <CardDescription>
                      {getGincanaNome(selectedTorneio.gincana_id)} • 
                      Pontuação: 1º {selectedTorneio.pontos_primeiro} | 2º {selectedTorneio.pontos_segundo} | 3º {selectedTorneio.pontos_terceiro}
                    </CardDescription>
                  )}
                </div>
                
                {selectedTorneio && selectedTorneio.status === 'pendente' && confrontos.length === 0 && (
                  <Button onClick={handleIniciarSorteio} className="gap-2">
                    <Shuffle className="h-4 w-4" />
                    Iniciar Sorteio
                  </Button>
                )}
                
                {selectedTorneio && sorteioAtivo && !torneioService.isSorteioQuartasCompleto(confrontos) && (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      Posição {torneioService.getProximoNumeroSorteio(confrontos)} de 8
                    </div>
                    <Button 
                      onClick={handleSortearProximo} 
                      disabled={sorteando}
                      className="gap-2 min-w-32"
                    >
                      {sorteando ? (
                        <>
                          <Dices className="h-4 w-4 animate-spin" />
                          Sorteando...
                        </>
                      ) : (
                        <>
                          <Dices className="h-4 w-4" />
                          Sortear
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedTorneio ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Selecione um torneio para visualizar a chave</p>
                </div>
              ) : (
                <TournamentBracket 
                  confrontos={confrontos}
                  equipes={equipes}
                  onSelectWinner={selectedTorneio.status === 'em_andamento' ? handleSelectWinner : undefined}
                  readOnly={selectedTorneio.status === 'finalizado'}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
