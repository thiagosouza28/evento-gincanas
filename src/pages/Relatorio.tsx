import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Trophy, Medal, Users, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as torneioService from '@/lib/torneioService';
import type { Gincana, Equipe, Pontuacao, Inscrito } from '@/types';
import type { Torneio } from '@/types/torneio';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { generatePontuacaoEquipePDF, generatePontuacaoGeralPDF } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { useApiConfig } from '@/hooks/useDatabase';
import { fetchEventos } from '@/lib/apiSync';

interface PontuacaoPorGincana {
  gincanaId: string;
  gincanaNome: string;
  pontos: number;
  detalhes: Pontuacao[];
}

interface EquipeRelatorio {
  equipe: Equipe;
  pontosTotais: number;
  pontuacoesPorGincana: PontuacaoPorGincana[];
}

const statusLabels: Record<Inscrito['statusPagamento'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PAID: { label: 'Pago', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  MANUAL: { label: 'Manual', variant: 'outline' },
};

export default function Relatorio() {
  const { user } = useAuth();
  const { config } = useApiConfig();
  const [gincanas, setGincanas] = useState<Gincana[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [pontuacoes, setPontuacoes] = useState<Pontuacao[]>([]);
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGincana, setSelectedGincana] = useState<string>('all');
  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PENDING' | 'CANCELLED' | 'MANUAL'>('all');
  const [eventoNome, setEventoNome] = useState<string>('');
  
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setGincanas([]);
      setEquipes([]);
      setPontuacoes([]);
      setTorneios([]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadEventoNome = async () => {
      if (!config?.eventId) {
        setEventoNome('');
        return;
      }
      const eventos = await fetchEventos();
      if (!active) return;
      const match = eventos.find((evento) => evento.id === config.eventId);
      setEventoNome(match?.name || config.eventId);
    };
    loadEventoNome();
    return () => {
      active = false;
    };
  }, [config?.eventId]);
  
  async function loadData() {
    try {
      setLoading(true);
      if (!user) {
        return;
      }

      const [gincanasRes, equipesRes, pontuacoesRes, torneiosData, inscritosRes] = await Promise.all([
        supabase.from('gincanas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('equipes').select('*').eq('user_id', user.id).order('nome'),
        supabase.from('pontuacoes').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
        torneioService.getAllTorneios(),
        supabase.from('inscritos').select('*').eq('user_id', user.id).order('numero'),
      ]);

      if (gincanasRes.error) throw gincanasRes.error;
      if (equipesRes.error) throw equipesRes.error;
      if (pontuacoesRes.error) throw pontuacoesRes.error;
      if (inscritosRes.error) throw inscritosRes.error;

      const gincanasData = (gincanasRes.data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        categoria: row.categoria as Gincana['categoria'],
        ativa: row.ativa || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const equipesData = (equipesRes.data || []).map(row => ({
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

      const pontuacoesData = (pontuacoesRes.data || []).map(row => ({
        id: row.id,
        gincanaId: row.gincana_id,
        equipeId: row.equipe_id,
        pontos: row.pontos,
        observacao: row.observacao || undefined,
        dataHora: row.data_hora,
      }));

      const inscritosData = (inscritosRes.data || []).map(row => ({
        numero: row.numero,
        nome: row.nome,
        dataNascimento: row.data_nascimento || '',
        idade: row.idade || 0,
        igreja: row.igreja || 'Não informado',
        distrito: row.distrito || 'Não informado',
        fotoUrl: row.foto_url || undefined,
        statusPagamento: (row.status_pagamento as Inscrito['statusPagamento']) || 'PENDING',
        isManual: row.is_manual || false,
        numeroOriginal: row.numero_original || undefined,
        numeroPulseira: row.numero_pulseira || undefined,
      }));

      setGincanas(gincanasData);
      setEquipes(equipesData);
      setPontuacoes(pontuacoesData);
      setInscritos(inscritosData);
      setTorneios(torneiosData);
    } finally {
      setLoading(false);
    }
  }
  
  // Calcular relatório de pontuação por equipe
  function calcularRelatorio(): EquipeRelatorio[] {
    return equipes.map(equipe => {
      const pontuacoesEquipe = pontuacoes.filter(p => p.equipeId === equipe.id);
      
      // Agrupar por gincana
      const porGincana = new Map<string, Pontuacao[]>();
      pontuacoesEquipe.forEach(p => {
        const existing = porGincana.get(p.gincanaId) || [];
        existing.push(p);
        porGincana.set(p.gincanaId, existing);
      });
      
      const pontuacoesPorGincana: PontuacaoPorGincana[] = [];
      porGincana.forEach((detalhes, gincanaId) => {
        const gincana = gincanas.find(g => g.id === gincanaId);
        pontuacoesPorGincana.push({
          gincanaId,
          gincanaNome: gincana?.nome || 'Desconhecida',
          pontos: detalhes.reduce((sum, p) => sum + p.pontos, 0),
          detalhes,
        });
      });
      
      return {
        equipe,
        pontosTotais: pontuacoesEquipe.reduce((sum, p) => sum + p.pontos, 0),
        pontuacoesPorGincana,
      };
    }).sort((a, b) => b.pontosTotais - a.pontosTotais);
  }
  
  const relatorio = calcularRelatorio();

  useEffect(() => {
    if (!selectedEquipeId && relatorio.length > 0) {
      setSelectedEquipeId(relatorio[0].equipe.id);
    } else if (selectedEquipeId && relatorio.length > 0 && !relatorio.find(r => r.equipe.id === selectedEquipeId)) {
      setSelectedEquipeId(relatorio[0].equipe.id);
    }
  }, [relatorio, selectedEquipeId]);
  
  // Filtrar por gincana selecionada
  const relatorioFiltrado = selectedGincana === 'all' 
    ? relatorio 
    : relatorio.map(r => ({
        ...r,
        pontosTotais: r.pontuacoesPorGincana
          .filter(g => g.gincanaId === selectedGincana)
          .reduce((sum, g) => sum + g.pontos, 0),
        pontuacoesPorGincana: r.pontuacoesPorGincana.filter(g => g.gincanaId === selectedGincana),
      })).sort((a, b) => b.pontosTotais - a.pontosTotais);
  
  // Estatísticas gerais
  const totalPontos = pontuacoes.reduce((sum, p) => sum + p.pontos, 0);
  const torneiosFinalizados = torneios.filter(t => t.status === 'finalizado').length;
  const totalInscritos = inscritos.length;
  const totalPagos = inscritos.filter(i => i.statusPagamento === 'PAID').length;
  const totalPendentes = inscritos.filter(i => i.statusPagamento === 'PENDING').length;
  const totalCancelados = inscritos.filter(i => i.statusPagamento === 'CANCELLED').length;
  const totalManuais = inscritos.filter(i => i.statusPagamento === 'MANUAL').length;

  const inscritosFiltrados = statusFilter === 'all'
    ? inscritos
    : inscritos.filter(i => i.statusPagamento === statusFilter);

  const handleExportGeral = async () => {
    toast.info('Gerando PDF geral...');
    await generatePontuacaoGeralPDF(equipes, gincanas, torneios, pontuacoes);
    toast.success('PDF geral gerado com sucesso.');
  };

  const handleExportEquipe = async () => {
    const equipe = equipes.find(e => e.id === selectedEquipeId);
    if (!equipe) {
      toast.error('Selecione uma equipe para gerar o PDF.');
      return;
    }
    toast.info(`Gerando PDF da equipe ${equipe.nome}...`);
    await generatePontuacaoEquipePDF(equipe, gincanas, torneios, pontuacoes);
    toast.success('PDF da equipe gerado com sucesso.');
  };
  
  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
          Carregando...
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm font-bold text-foreground">Relatório de Pontuação</h1>
            <p className="text-muted-foreground">Visualize a pontuação detalhada por equipe e modalidade</p>
            {config?.eventId && (
              <p className="text-sm text-muted-foreground mt-1">
                Evento: <span className="font-medium text-foreground">{eventoNome || config.eventId}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handleExportGeral} disabled={equipes.length === 0}>
              <FileDown className="h-4 w-4" />
              PDF Geral
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportEquipe} disabled={!selectedEquipeId}>
              <FileDown className="h-4 w-4" />
              PDF Equipe
            </Button>
          </div>
        </div>
        
        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pontos</p>
                  <p className="text-2xl font-bold">{totalPontos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gincanas</p>
                  <p className="text-2xl font-bold">{gincanas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <Medal className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Torneios Finalizados</p>
                  <p className="text-2xl font-bold">{torneiosFinalizados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-accent/10">
                  <Users className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Equipes</p>
                  <p className="text-2xl font-bold">{equipes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status de pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Status de Pagamento</CardTitle>
            <CardDescription>Resumo das inscrições por status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalInscritos}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagos</p>
                <p className="text-2xl font-bold text-success">{totalPagos}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-warning">{totalPendentes}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold text-destructive">{totalCancelados}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Manuais</p>
                <p className="text-2xl font-bold">{totalManuais}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Filtrar por status:</span>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PAID">Pagos</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                  <SelectItem value="MANUAL">Manuais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Distrito</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inscritosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma inscrição encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inscritosFiltrados.map((inscrito) => {
                      const statusInfo = statusLabels[inscrito.statusPagamento] || statusLabels.PENDING;
                      return (
                        <TableRow key={inscrito.numero}>
                          <TableCell>{inscrito.numero}</TableCell>
                          <TableCell className="font-medium">{inscrito.nome}</TableCell>
                          <TableCell>{inscrito.igreja}</TableCell>
                          <TableCell>{inscrito.distrito}</TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        {/* Filtro */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select value={selectedGincana} onValueChange={setSelectedGincana}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Todas as gincanas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as gincanas</SelectItem>
              {gincanas.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Tabela principal */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking Geral</CardTitle>
            <CardDescription>
              {selectedGincana === 'all' 
                ? 'Pontuação acumulada de todas as gincanas' 
                : `Pontuação da gincana: ${gincanas.find(g => g.id === selectedGincana)?.nome}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos.</TableHead>
                  <TableHead>Equipe</TableHead>
                  {selectedGincana === 'all' && gincanas.map(g => (
                    <TableHead key={g.id} className="text-right">{g.nome}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorioFiltrado.map((r, index) => (
                  <TableRow key={r.equipe.id}>
                    <TableCell>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 && "bg-gold/20 text-gold",
                        index === 1 && "bg-silver/20 text-silver",
                        index === 2 && "bg-bronze/20 text-bronze",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}º
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.equipe.corPulseira && (
                          <div 
                            className="w-3 h-3 rounded-full ring-1 ring-border" 
                            style={{ backgroundColor: r.equipe.corPulseira }} 
                          />
                        )}
                        <span className="font-medium">{r.equipe.nome}</span>
                      </div>
                    </TableCell>
                    {selectedGincana === 'all' && gincanas.map(g => {
                      const pontuacaoGincana = r.pontuacoesPorGincana.find(pg => pg.gincanaId === g.id);
                      return (
                        <TableCell key={g.id} className="text-right">
                          {pontuacaoGincana?.pontos || 0}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-bold text-lg">
                      {r.pontosTotais}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Detalhamento por equipe */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Equipe</CardTitle>
            <CardDescription>Histórico de lançamentos de pontuação</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedEquipeId} onValueChange={setSelectedEquipeId}>
              <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                {relatorioFiltrado.map(r => (
                  <TabsTrigger 
                    key={r.equipe.id} 
                    value={r.equipe.id}
                    className="flex items-center gap-2"
                  >
                    {r.equipe.corPulseira && (
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: r.equipe.corPulseira }} 
                      />
                    )}
                    {r.equipe.nome}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {relatorioFiltrado.map(r => (
                <TabsContent key={r.equipe.id} value={r.equipe.id}>
                  <div className="space-y-4">
                    {r.pontuacoesPorGincana.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhuma pontuação registrada</p>
                    ) : (
                      r.pontuacoesPorGincana.map(pg => (
                        <div key={pg.gincanaId} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{pg.gincanaNome}</h4>
                            <span className="text-lg font-bold">{pg.pontos} pts</span>
                          </div>
                          <div className="space-y-2">
                            {pg.detalhes.map((d, i) => (
                              <div key={i} className="flex justify-between text-sm text-muted-foreground">
                                <span>{d.observacao || 'Pontuação'}</span>
                                <span className={d.pontos >= 0 ? 'text-success' : 'text-destructive'}>
                                  {d.pontos >= 0 ? '+' : ''}{d.pontos}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
