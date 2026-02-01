import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEquipesComParticipantes, usePontuacoes, useGincanas } from '@/hooks/useDatabase';
import { Plus, Minus, History, Loader2, Trophy, Users, ListChecks } from 'lucide-react';
import { motion } from 'framer-motion';

const Pontuacao = () => {
  const { equipes, loading: equipesLoading, reload: reloadEquipes } = useEquipesComParticipantes();
  const { pontuacoes, adicionarPontuacao, loading: pontuacoesLoading } = usePontuacoes();
  const { gincanas, loading: gincanasLoading } = useGincanas();
  
  const [selectedEquipe, setSelectedEquipe] = useState<string | null>(null);
  const [selectedGincana, setSelectedGincana] = useState<string>('');
  const [pontos, setPontos] = useState('');
  const [observacao, setObservacao] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isPenalty, setIsPenalty] = useState(false);

  const loading = equipesLoading || pontuacoesLoading || gincanasLoading;

  const handleAddPontos = async () => {
    if (!selectedEquipe || !pontos || !selectedGincana) return;
    
    const pontosNum = parseInt(pontos) * (isPenalty ? -1 : 1);
    await adicionarPontuacao(selectedEquipe, pontosNum, selectedGincana, observacao || undefined);
    reloadEquipes();
    
    setPontos('');
    setObservacao('');
    setSelectedEquipe(null);
    setSelectedGincana('');
    setIsAdding(false);
    setIsPenalty(false);
  };

  const openAddDialog = (equipeId: string, penalty: boolean = false) => {
    setSelectedEquipe(equipeId);
    setIsPenalty(penalty);
    setIsAdding(true);
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
    return equipes.find(e => e.id === equipeId)?.nome || 'Equipe';
  };

  const getEquipeCor = (equipeId: string) => {
    return equipes.find(e => e.id === equipeId)?.cor || 1;
  };

  const getEquipeImagem = (equipeId: string) => {
    return equipes.find(e => e.id === equipeId)?.imagemUrl;
  };

  const getGincanaNome = (gincanaId: string) => {
    return gincanas.find(g => g.id === gincanaId)?.nome || gincanaId;
  };

  const totalPontos = pontuacoes.reduce((sum, p) => sum + p.pontos, 0);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-display-sm text-foreground">Pontuação</h1>
          <p className="text-muted-foreground">Pontuação geral das equipes</p>
        </div>

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
                <div 
                  className="h-2"
                  style={{ backgroundColor: `hsl(var(--team-${equipe.cor}))` }}
                />
                <div
                  className={`absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-semibold ${
                    index === 0 ? 'bg-gold/20 text-gold' :
                    index === 1 ? 'bg-silver/20 text-silver' :
                    index === 2 ? 'bg-bronze/20 text-bronze' :
                    'bg-secondary/40 text-muted-foreground'
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
                    <CardTitle 
                      className="text-lg truncate"
                      style={{ color: `hsl(var(--team-${equipe.cor}))` }}
                    >
                      {equipe.nome}
                    </CardTitle>
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
                  
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-full"
                      onClick={() => openAddDialog(equipe.id, false)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Pontos
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-full"
                      onClick={() => openAddDialog(equipe.id, true)}
                    >
                      <Minus className="mr-1 h-4 w-4" />
                      Penalidade
                    </Button>
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
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
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
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isPenalty ? 'Aplicar Penalidade' : 'Adicionar Pontos'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Equipe</Label>
                <p className="text-lg font-semibold" style={{ 
                  color: selectedEquipe ? `hsl(var(--team-${getEquipeCor(selectedEquipe)}))` : undefined 
                }}>
                  {selectedEquipe ? getEquipeNome(selectedEquipe) : ''}
                </p>
              </div>
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
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddPontos}
                  disabled={!pontos || !selectedGincana}
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
