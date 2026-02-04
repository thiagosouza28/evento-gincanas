import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Trophy, Medal, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as torneioService from '@/lib/torneioService';
import type { Gincana, Equipe, Pontuacao } from '@/types';
import type { Torneio } from '@/types/torneio';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

export default function Relatorio() {
  const { user } = useAuth();
  const [gincanas, setGincanas] = useState<Gincana[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [pontuacoes, setPontuacoes] = useState<Pontuacao[]>([]);
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGincana, setSelectedGincana] = useState<string>('all');
  
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
  
  async function loadData() {
    try {
      setLoading(true);
      if (!user) {
        return;
      }

      const [gincanasRes, equipesRes, pontuacoesRes, torneiosData] = await Promise.all([
        supabase.from('gincanas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('equipes').select('*').eq('user_id', user.id).order('nome'),
        supabase.from('pontuacoes').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
        torneioService.getAllTorneios(),
      ]);

      if (gincanasRes.error) throw gincanasRes.error;
      if (equipesRes.error) throw equipesRes.error;
      if (pontuacoesRes.error) throw pontuacoesRes.error;

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

      setGincanas(gincanasData);
      setEquipes(equipesData);
      setPontuacoes(pontuacoesData);
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
        <div>
          <h1 className="text-display-sm font-bold text-foreground">Relatório de Pontuação</h1>
          <p className="text-muted-foreground">Visualize a pontuação detalhada por equipe e modalidade</p>
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
            <Tabs defaultValue={relatorioFiltrado[0]?.equipe.id}>
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
