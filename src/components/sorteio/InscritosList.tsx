import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, ArrowUpDown } from 'lucide-react';
import type { Inscrito } from '@/types';

interface InscritosListProps {
  inscritos: Map<number, Inscrito>;
  sorteados: Set<number>;
}

type SortOption = 'numero-asc' | 'numero-desc' | 'nome-asc' | 'nome-desc';

const DEFAULT_PHOTO = '/placeholder.svg';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PAID: { label: 'Pago', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  MANUAL: { label: 'Manual', variant: 'outline' },
};

// Sanitiza o status de pagamento para evitar dados corrompidos
// Os dados podem vir com encoding incorreto do MySQL, então sanitizamos rigorosamente
function getValidStatus(status: string | undefined | null): string {
  if (!status || typeof status !== 'string') return 'PENDING';
  
  // Limpar caracteres não-ASCII e especiais
  const cleanStatus = status.replace(/[^\x20-\x7E]/g, '').toUpperCase().trim();
  
  // Verificar se contém padrões reconhecíveis
  if (cleanStatus.includes('PAID') || cleanStatus.includes('PAGO')) return 'PAID';
  if (cleanStatus.includes('CANCEL')) return 'CANCELLED';
  if (cleanStatus.includes('MANUAL')) return 'MANUAL';
  if (cleanStatus.includes('PENDING') || cleanStatus.includes('PEND')) return 'PENDING';
  
  // Se não reconhecer, verificar match exato após limpeza
  if (['PAID', 'PENDING', 'CANCELLED', 'MANUAL'].includes(cleanStatus)) {
    return cleanStatus;
  }
  
  return 'PENDING';
}

// Sanitiza o status de sorteio para exibição
function getSorteioLabel(isSorteado: boolean): { label: string; className: string } {
  if (isSorteado) {
    return { label: 'Sorteado', className: 'bg-success/20 text-success' };
  }
  return { label: 'Pendente', className: '' };
}

export function InscritosList({ inscritos, sorteados }: InscritosListProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('numero-asc');

  const inscritosFiltrados = useMemo(() => {
    let lista = Array.from(inscritos.values());
    
    // Filtrar por busca
    if (search) {
      const termo = search.toLowerCase();
      lista = lista.filter(i => 
        i.nome.toLowerCase().includes(termo) ||
        i.numero.toString().includes(termo) ||
        i.igreja.toLowerCase().includes(termo) ||
        i.distrito.toLowerCase().includes(termo)
      );
    }
    
    // Ordenar
    lista.sort((a, b) => {
      switch (sortBy) {
        case 'numero-asc':
          return a.numero - b.numero;
        case 'numero-desc':
          return b.numero - a.numero;
        case 'nome-asc':
          return a.nome.localeCompare(b.nome, 'pt-BR');
        case 'nome-desc':
          return b.nome.localeCompare(a.nome, 'pt-BR');
        default:
          return 0;
      }
    });
    
    return lista;
  }, [inscritos, search, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, número, igreja ou distrito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="numero-asc">Nº (primeiro → último)</SelectItem>
              <SelectItem value="numero-desc">Nº (último → primeiro)</SelectItem>
              <SelectItem value="nome-asc">Nome (A → Z)</SelectItem>
              <SelectItem value="nome-desc">Nome (Z → A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-20">Idade</TableHead>
              <TableHead>Igreja</TableHead>
              <TableHead>Distrito</TableHead>
              <TableHead className="w-24">Pagamento</TableHead>
              <TableHead className="w-24">Sorteio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inscritosFiltrados.map((inscrito) => (
              <TableRow key={inscrito.numero} className={inscrito.isManual ? 'bg-accent/20' : ''}>
                <TableCell>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={inscrito.fotoUrl || DEFAULT_PHOTO} alt={inscrito.nome} />
                    <AvatarFallback className="bg-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-mono font-bold">{inscrito.numero}</TableCell>
                <TableCell className="font-medium">
                  {inscrito.nome}
                  {inscrito.isManual && (
                    <Badge variant="outline" className="ml-2 text-xs">Manual</Badge>
                  )}
                </TableCell>
                <TableCell>{inscrito.idade}</TableCell>
                <TableCell>{inscrito.igreja}</TableCell>
                <TableCell>{inscrito.distrito}</TableCell>
                <TableCell>
                  {(() => {
                    const validStatus = getValidStatus(inscrito.statusPagamento);
                    return (
                      <Badge variant={statusLabels[validStatus].variant}>
                        {statusLabels[validStatus].label}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const sorteio = getSorteioLabel(sorteados.has(inscrito.numero));
                    return (
                      <Badge variant={sorteados.has(inscrito.numero) ? 'secondary' : 'outline'} className={sorteio.className}>
                        {sorteio.label}
                      </Badge>
                    );
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {inscritosFiltrados.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum inscrito encontrado
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Exibindo {inscritosFiltrados.length} de {inscritos.size} inscritos
      </p>
    </div>
  );
}
