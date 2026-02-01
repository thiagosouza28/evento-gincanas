import { useEffect, useState } from 'react';
import { useEquipesComParticipantes } from '@/hooks/useDatabase';
import { Trophy, Maximize2, Minimize2, Loader2, FileDown, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { generatePodioPDF } from '@/lib/pdfGenerator';
import { toast } from 'sonner';

const Podio = () => {
  const { equipes, loading: equipesLoading } = useEquipesComParticipantes();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPoints, setShowPoints] = useState(() => {
    const stored = localStorage.getItem('podio-show-points');
    return stored ? stored === 'true' : true;
  });

  const loading = equipesLoading;

  useEffect(() => {
    localStorage.setItem('podio-show-points', String(showPoints));
  }, [showPoints]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      await generatePodioPDF(equipes, 'Pontuação Geral');
      toast.success('PDF do pódio gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF do pódio');
    }
  };

  // Ordenar por pontuação
  const ranking = [...equipes].sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const PodiumContent = () => (
    <div className={`min-h-screen bg-background p-8 ${isFullscreen ? 'pt-16' : ''}`}>
      {/* Header */}
      <div className="mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4"
        >
          <Trophy className="h-12 w-12 text-gold" />
          <h1 className="text-display-lg text-foreground">Pódio</h1>
          <Trophy className="h-12 w-12 text-gold" />
        </motion.div>
        <p className="mt-2 text-xl text-muted-foreground">Pontuação Geral</p>
      </div>

      {/* Top 3 Podium */}
      <div className="mx-auto mb-12 flex max-w-4xl items-end justify-center gap-4">
        {/* 2nd Place */}
        {ranking[1] && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div 
              className="mb-4 rounded-lg p-6 text-center glow-silver"
              style={{ backgroundColor: `hsl(var(--team-${ranking[1].cor}) / 0.2)`, borderColor: `hsl(var(--team-${ranking[1].cor}))`, borderWidth: 2 }}
            >
              <p className="text-silver text-5xl font-bold">2º</p>
              <h3 className="mt-2 text-xl font-bold" style={{ color: `hsl(var(--team-${ranking[1].cor}))` }}>
                {ranking[1].nome}
              </h3>
              {showPoints && (
                <>
                  <p className="text-3xl font-bold text-foreground">{ranking[1].pontuacaoTotal}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                </>
              )}
            </div>
            <div className="h-32 w-40 rounded-t-lg bg-silver/30" />
          </motion.div>
        )}

        {/* 1st Place */}
        {ranking[0] && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-4 rounded-lg p-8 text-center glow-gold"
              style={{ backgroundColor: `hsl(var(--team-${ranking[0].cor}) / 0.2)`, borderColor: `hsl(var(--team-${ranking[0].cor}))`, borderWidth: 3 }}
            >
              <Trophy className="mx-auto mb-2 h-12 w-12 text-gold" />
              <p className="text-gold text-6xl font-bold text-glow">1º</p>
              <h3 className="mt-2 text-2xl font-bold" style={{ color: `hsl(var(--team-${ranking[0].cor}))` }}>
                {ranking[0].nome}
              </h3>
              {showPoints && (
                <>
                  <p className="text-4xl font-bold text-foreground">{ranking[0].pontuacaoTotal}</p>
                  <p className="text-muted-foreground">pontos</p>
                </>
              )}
            </motion.div>
            <div className="h-48 w-48 rounded-t-lg bg-gold/30" />
          </motion.div>
        )}

        {/* 3rd Place */}
        {ranking[2] && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center"
          >
            <div 
              className="mb-4 rounded-lg p-6 text-center glow-bronze"
              style={{ backgroundColor: `hsl(var(--team-${ranking[2].cor}) / 0.2)`, borderColor: `hsl(var(--team-${ranking[2].cor}))`, borderWidth: 2 }}
            >
              <p className="text-bronze text-4xl font-bold">3º</p>
              <h3 className="mt-2 text-lg font-bold" style={{ color: `hsl(var(--team-${ranking[2].cor}))` }}>
                {ranking[2].nome}
              </h3>
              {showPoints && (
                <>
                  <p className="text-2xl font-bold text-foreground">{ranking[2].pontuacaoTotal}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                </>
              )}
            </div>
            <div className="h-24 w-36 rounded-t-lg bg-bronze/30" />
          </motion.div>
        )}
      </div>

      {/* Full Ranking */}
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-center text-xl font-semibold text-foreground">Classificação Completa</h2>
        <div className="space-y-2">
          {ranking.map((equipe, index) => (
            <motion.div
              key={equipe.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center gap-4 rounded-lg border border-border bg-card/50 p-4"
              style={{ borderLeftColor: `hsl(var(--team-${equipe.cor}))`, borderLeftWidth: 4 }}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                index === 0 ? 'bg-gold/20 text-gold' :
                index === 1 ? 'bg-silver/20 text-silver' :
                index === 2 ? 'bg-bronze/20 text-bronze' :
                'bg-secondary text-foreground'
              }`}>
                {index + 1}º
              </div>
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: `hsl(var(--team-${equipe.cor}))` }}>
                  {equipe.nome}
                </h3>
                <p className="text-sm text-muted-foreground">{equipe.participantes} participantes</p>
              </div>
              {showPoints && (
                <div className="text-right">
                  <p className="text-2xl font-bold">{equipe.pontuacaoTotal}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowPoints(!showPoints)}
          title={showPoints ? 'Ocultar pontos' : 'Mostrar pontos'}
        >
          {showPoints ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportPDF}
          title="Baixar PDF do pódio"
        >
          <FileDown className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );

  if (isFullscreen) {
    return <PodiumContent />;
  }

  return (
    <MainLayout>
      <PodiumContent />
    </MainLayout>
  );
};

export default Podio;
