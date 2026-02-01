import { cn } from '@/lib/utils';
import type { Confronto, ConfrontoComEquipes, FaseConfronto } from '@/types/torneio';
import type { Equipe } from '@/types';
import { Trophy, Medal, Award, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TournamentBracketProps {
  confrontos: Confronto[];
  equipes: Equipe[];
  onSelectWinner?: (confrontoId: string, vencedorId: string) => void;
  readOnly?: boolean;
}

// Mapear IDs de equipes para nomes e cores
function enrichConfrontos(confrontos: Confronto[], equipes: Equipe[]): ConfrontoComEquipes[] {
  const equipeMap = new Map(equipes.map(e => [e.id, e]));
  
  return confrontos.map(c => ({
    ...c,
    equipe1_nome: c.equipe1_id ? equipeMap.get(c.equipe1_id)?.nome : undefined,
    equipe2_nome: c.equipe2_id ? equipeMap.get(c.equipe2_id)?.nome : undefined,
    equipe1_cor: c.equipe1_id ? (equipeMap.get(c.equipe1_id)?.corPulseira || (typeof equipeMap.get(c.equipe1_id)?.cor === 'number' ? `hsl(var(--team-${equipeMap.get(c.equipe1_id)?.cor}))` : undefined)) : undefined,
    equipe2_cor: c.equipe2_id ? (equipeMap.get(c.equipe2_id)?.corPulseira || (typeof equipeMap.get(c.equipe2_id)?.cor === 'number' ? `hsl(var(--team-${equipeMap.get(c.equipe2_id)?.cor}))` : undefined)) : undefined,
    equipe1_imagem: c.equipe1_id ? equipeMap.get(c.equipe1_id)?.imagemUrl : undefined,
    equipe2_imagem: c.equipe2_id ? equipeMap.get(c.equipe2_id)?.imagemUrl : undefined,
    vencedor_nome: c.vencedor_id ? equipeMap.get(c.vencedor_id)?.nome : undefined,
  }));
}

// Card de um confronto
function MatchCard({ 
  confronto, 
  onSelectWinner, 
  readOnly 
}: { 
  confronto: ConfrontoComEquipes; 
  onSelectWinner?: (vencedorId: string) => void;
  readOnly?: boolean;
}) {
  const canSelect = !readOnly && !confronto.vencedor_id && confronto.equipe1_id && confronto.equipe2_id;
  
  return (
    <div className="bg-card border border-border rounded-lg p-3 min-w-[180px] shadow-md">
      {/* Equipe 1 */}
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded transition-all",
          confronto.vencedor_id === confronto.equipe1_id && "bg-success/20 ring-2 ring-success",
          confronto.vencedor_id && confronto.vencedor_id !== confronto.equipe1_id && "opacity-50",
          canSelect && "hover:bg-primary/10 cursor-pointer"
        )}
        onClick={() => canSelect && confronto.equipe1_id && onSelectWinner?.(confronto.equipe1_id)}
      >
        {confronto.equipe1_imagem ? (
          <div
            className="h-6 w-6 rounded-full overflow-hidden border-2 flex-shrink-0"
            style={{ borderColor: confronto.equipe1_cor || 'hsl(var(--border))' }}
          >
            <img
              src={confronto.equipe1_imagem}
              alt={confronto.equipe1_nome || 'Equipe'}
              className="h-full w-full object-cover"
            />
          </div>
        ) : confronto.equipe1_cor ? (
          <div 
            className="w-4 h-4 rounded-full ring-2 ring-border flex-shrink-0" 
            style={{ backgroundColor: confronto.equipe1_cor }} 
          />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className={cn(
          "text-sm font-medium truncate",
          confronto.equipe1_nome ? "text-foreground" : "text-muted-foreground italic"
        )}>
          {confronto.equipe1_nome || 'Aguardando...'}
        </span>
        {confronto.vencedor_id === confronto.equipe1_id && (
          <Trophy className="w-4 h-4 text-warning ml-auto" />
        )}
      </div>
      
      <div className="h-px bg-border my-1" />
      
      {/* Equipe 2 */}
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded transition-all",
          confronto.vencedor_id === confronto.equipe2_id && "bg-success/20 ring-2 ring-success",
          confronto.vencedor_id && confronto.vencedor_id !== confronto.equipe2_id && "opacity-50",
          canSelect && "hover:bg-primary/10 cursor-pointer"
        )}
        onClick={() => canSelect && confronto.equipe2_id && onSelectWinner?.(confronto.equipe2_id)}
      >
        {confronto.equipe2_imagem ? (
          <div
            className="h-6 w-6 rounded-full overflow-hidden border-2 flex-shrink-0"
            style={{ borderColor: confronto.equipe2_cor || 'hsl(var(--border))' }}
          >
            <img
              src={confronto.equipe2_imagem}
              alt={confronto.equipe2_nome || 'Equipe'}
              className="h-full w-full object-cover"
            />
          </div>
        ) : confronto.equipe2_cor ? (
          <div 
            className="w-4 h-4 rounded-full ring-2 ring-border flex-shrink-0" 
            style={{ backgroundColor: confronto.equipe2_cor }} 
          />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className={cn(
          "text-sm font-medium truncate",
          confronto.equipe2_nome ? "text-foreground" : "text-muted-foreground italic"
        )}>
          {confronto.equipe2_nome || 'Aguardando...'}
        </span>
        {confronto.vencedor_id === confronto.equipe2_id && (
          <Trophy className="w-4 h-4 text-warning ml-auto" />
        )}
      </div>
    </div>
  );
}

// Coluna de fase
function PhaseColumn({ 
  title, 
  icon: Icon,
  confrontos, 
  onSelectWinner,
  readOnly,
  className
}: { 
  title: string; 
  icon: React.ElementType;
  confrontos: ConfrontoComEquipes[];
  onSelectWinner?: (confrontoId: string, vencedorId: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <div className="flex flex-col gap-8 justify-center flex-1">
        {confrontos.map(c => (
          <MatchCard 
            key={c.id} 
            confronto={c} 
            onSelectWinner={(vencedorId) => onSelectWinner?.(c.id, vencedorId)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

export function TournamentBracket({ confrontos, equipes, onSelectWinner, readOnly }: TournamentBracketProps) {
  const enriched = enrichConfrontos(confrontos, equipes);
  
  const quartas = enriched.filter(c => c.fase === 'quartas').sort((a, b) => a.ordem - b.ordem);
  const semifinal = enriched.filter(c => c.fase === 'semifinal').sort((a, b) => a.ordem - b.ordem);
  const terceiro = enriched.filter(c => c.fase === 'terceiro_lugar');
  const final = enriched.filter(c => c.fase === 'final');
  
  if (confrontos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum confronto sorteado ainda</p>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max p-4">
        {/* Quartas de Final */}
        <PhaseColumn 
          title="Quartas" 
          icon={Circle}
          confrontos={quartas}
          onSelectWinner={onSelectWinner}
          readOnly={readOnly}
        />
        
        {/* Conexões visuais */}
        <div className="flex flex-col justify-center gap-8 py-12">
          <div className="w-8 border-t-2 border-border" />
          <div className="w-8 border-t-2 border-border" />
          <div className="w-8 border-t-2 border-border" />
          <div className="w-8 border-t-2 border-border" />
        </div>
        
        {/* Semifinal */}
        <PhaseColumn 
          title="Semifinal" 
          icon={Medal}
          confrontos={semifinal}
          onSelectWinner={onSelectWinner}
          readOnly={readOnly}
          className="py-16"
        />
        
        {/* Conexões visuais */}
        <div className="flex flex-col justify-center gap-32">
          <div className="w-8 border-t-2 border-border" />
          <div className="w-8 border-t-2 border-border" />
        </div>
        
        {/* Final e 3º lugar */}
        <div className="flex flex-col gap-8 justify-center">
          <PhaseColumn 
            title="Final" 
            icon={Trophy}
            confrontos={final}
            onSelectWinner={onSelectWinner}
            readOnly={readOnly}
          />
          
          <PhaseColumn 
            title="3º Lugar" 
            icon={Award}
            confrontos={terceiro}
            onSelectWinner={onSelectWinner}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
