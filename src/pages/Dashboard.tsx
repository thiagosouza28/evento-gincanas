import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MainLayout } from '@/components/layout/MainLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDatabase, useEquipesComParticipantes, useGincanas, useInscritos, useOnlineStatus } from '@/hooks/useDatabase';
import { Users, Trophy, Shuffle, Medal, Wifi, WifiOff, Loader2, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTeamColor } from '@/lib/teamColor';
import { supabase } from '@/integrations/supabase/client';
import { buildLoteResumo, formatLoteOrigem, type LoteLookup } from '@/lib/loteResumo';

const Dashboard = () => {
  const { isReady, inscritosCount } = useDatabase();
  const { equipes, loading: equipesLoading } = useEquipesComParticipantes();
  const { gincanaAtiva, loading: gincanasLoading } = useGincanas();
  const { inscritos, loading: inscritosLoading } = useInscritos();
  const isOnline = useOnlineStatus();
  const [lotesById, setLotesById] = useState<Map<string, LoteLookup>>(new Map());

  useEffect(() => {
    let active = true;

    const loadLotes = async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome, eventos(nome)');

      if (error || !active) return;

      const next = new Map<string, LoteLookup>();
      (data || []).forEach((row: { id: string; nome: string; eventos?: { nome?: string | null } | Array<{ nome?: string | null }> | null }) => {
        const eventoNome = Array.isArray(row.eventos)
          ? row.eventos[0]?.nome || null
          : row.eventos?.nome || null;
        next.set(row.id, {
          id: row.id,
          nome: row.nome,
          eventoNome,
        });
      });
      setLotesById(next);
    };

    loadLotes();
    return () => {
      active = false;
    };
  }, []);

  const totalParticipantes = equipes.reduce((acc, eq) => acc + eq.participantes, 0);
  const resumoLotes = useMemo(
    () => buildLoteResumo(Array.from(inscritos.values()), lotesById),
    [inscritos, lotesById],
  );
  const totalCanceladasPorLote = resumoLotes.reduce((sum, item) => sum + item.totalCanceladas, 0);

  if (!isReady || equipesLoading || gincanasLoading || inscritosLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Carregando sistema...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const stats = [
    { label: 'Inscritos Sincronizados', value: inscritosCount, icon: Users, color: 'text-info' },
    { label: 'Participantes Sorteados', value: totalParticipantes, icon: Shuffle, color: 'text-primary' },
    { label: 'Equipes', value: equipes.length, icon: Trophy, color: 'text-warning' },
    { label: 'Canceladas por Lote', value: totalCanceladasPorLote, icon: Ban, color: 'text-destructive' },
    { label: 'Gincana Ativa', value: gincanaAtiva?.nome || 'Nenhuma', icon: Medal, color: 'text-accent', isText: true },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do sistema de gincanas</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${
            isOnline ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
          }`}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.isText ? 'text-lg' : ''}`}>
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Inscricoes por lote */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Inscricoes por Lote</h2>
          <Card className="glass">
            <CardContent className="pt-6">
              {resumoLotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma inscricao encontrada para agrupar por lote.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Inscritos</TableHead>
                      <TableHead className="text-right">Canceladas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoLotes.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell>{formatLoteOrigem(item.origem)}</TableCell>
                        <TableCell className="text-right">{item.totalInscritos}</TableCell>
                        <TableCell className="text-right">{item.totalCanceladas}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Acesso Rápido</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { to: '/sorteio', icon: Shuffle, label: 'Realizar Sorteio', desc: 'Sortear participantes para equipes' },
              { to: '/pontuacao', icon: Medal, label: 'Lançar Pontos', desc: 'Adicionar pontuação às equipes' },
              { to: '/podio', icon: Trophy, label: 'Ver Pódio', desc: 'Ranking das equipes' },
              { to: '/equipes', icon: Users, label: 'Gerenciar Equipes', desc: 'Editar equipes e participantes' },
            ].map((action, index) => (
              <motion.div
                key={action.to}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <Link to={action.to}>
                  <Card className="glass cursor-pointer transition-all hover:scale-105 hover:border-primary/50">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <action.icon className="mb-3 h-10 w-10 text-primary" />
                      <h3 className="font-semibold text-foreground">{action.label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{action.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Teams Overview */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Equipes</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {equipes.map((equipe, index) => (
              <motion.div
                key={equipe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.05 }}
              >
                <Card 
                  className="glass overflow-hidden"
                  style={{ borderColor: getTeamColor(equipe) }}
                >
                  <div 
                    className="h-1"
                    style={{ backgroundColor: getTeamColor(equipe) }}
                  />
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground">{equipe.nome}</h3>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{equipe.participantes} participantes</span>
                      <span className="font-bold" style={{ color: getTeamColor(equipe) }}>
                        {equipe.pontuacaoTotal} pts
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
