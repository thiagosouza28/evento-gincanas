import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useInscritos, useSorteios, useApiConfig } from '@/hooks/useDatabase';
import { Search, Users, Loader2, RefreshCw, FileDown, ChevronDown, Pencil, Trash2, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddInscritoForm } from '@/components/sorteio/AddInscritoForm';
import { syncInscritos, fetchEventos } from '@/lib/apiSync';
import { generateInscritosPDF } from '@/lib/pdfGenerator';
import { calcularIdade } from '@/types';
import { toast } from 'sonner';
import type { Inscrito } from '@/types';

const DEFAULT_PHOTO = '/placeholder.svg';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PAID: { label: 'Pago', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  MANUAL: { label: 'Manual', variant: 'outline' },
};

// Helper to get valid status
const getValidStatus = (status: string | undefined): string => {
  if (!status) return 'PENDING';
  const upperStatus = status.toUpperCase();
  if (['PAID', 'PENDING', 'CANCELLED', 'MANUAL'].includes(upperStatus)) {
    return upperStatus;
  }
  return 'PENDING';
};

type SortOption = 'numero-asc' | 'numero-desc' | 'nome-asc' | 'nome-desc';

const Inscritos = () => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('numero-asc');
  const [syncing, setSyncing] = useState(false);
  const [eventos, setEventos] = useState<Array<{ id: string; name: string }>>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  
  // Modal de edição
  const [editingInscrito, setEditingInscrito] = useState<Inscrito | null>(null);
  const [editForm, setEditForm] = useState({
    nome: '',
    dataNascimento: '',
    igreja: '',
    distrito: '',
  });
  const [saving, setSaving] = useState(false);
  
  const { inscritos, loading: inscritosLoading, reload: reloadInscritos, saveInscrito, deleteInscrito } = useInscritos();
  const { sorteios } = useSorteios();
  const { config, saveConfig } = useApiConfig();
  
  const sorteadosSet = useMemo(() => new Set(sorteios.map(s => s.numeroInscrito)), [sorteios]);

  useEffect(() => {
    if (config?.eventId) {
      setSelectedEventId(config.eventId);
    } else {
      setSelectedEventId('all');
    }
  }, [config?.eventId]);

  useEffect(() => {
    let active = true;
    const loadEventos = async () => {
      setEventosLoading(true);
      const list = await fetchEventos();
      if (active) {
        setEventos(list);
        setEventosLoading(false);
      }
    };
    loadEventos();
    return () => {
      active = false;
    };
  }, []);

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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncInscritos();
      if (result.success) {
        toast.success(`${result.count} inscritos sincronizados`);
        reloadInscritos();
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      toast.error('Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleEventChange = async (value: string) => {
    setSelectedEventId(value);
    const eventId = value === 'all' ? undefined : value;
    await saveConfig({
      baseUrl: config?.baseUrl || 'mysql-database',
      token: config?.token || '',
      lastSync: config?.lastSync,
      eventId,
      syncStatuses: config?.syncStatuses,
    });
    toast.success(eventId ? 'Evento selecionado para sincronização.' : 'Sincronização sem filtro de evento.');
  };

  // Lista de igrejas únicas
  const igrejasUnicas = useMemo(() => {
    const igrejas = new Set<string>();
    Array.from(inscritos.values()).forEach(i => {
      if (i.igreja && i.igreja !== 'Não informado') {
        igrejas.add(i.igreja);
      }
    });
    return Array.from(igrejas).sort();
  }, [inscritos]);

  const handleExportPDF = (tipo: 'todos' | 'sorteados' | 'nao-sorteados', igreja?: string) => {
    let lista = Array.from(inscritos.values());
    
    // Filtrar por igreja se especificado
    if (igreja) {
      lista = lista.filter(i => i.igreja === igreja);
    }
    
    const titulo = igreja ? `Inscritos - ${igreja}` : 'Lista Completa de Inscritos';
    
    switch (tipo) {
      case 'todos':
        generateInscritosPDF(lista, titulo, { sorteados: sorteadosSet });
        toast.success(`PDF gerado com sucesso! ${igreja ? `(${lista.length} de ${igreja})` : ''}`);
        break;
      case 'sorteados':
        generateInscritosPDF(lista, igreja ? `Sorteados - ${igreja}` : 'Inscritos Sorteados', { 
          sorteados: sorteadosSet, 
          apenasSorteados: true 
        });
        toast.success('PDF de sorteados gerado!');
        break;
      case 'nao-sorteados':
        generateInscritosPDF(lista, igreja ? `Pendentes - ${igreja}` : 'Inscritos Pendentes de Sorteio', { 
          sorteados: sorteadosSet, 
          apenasNaoSorteados: true 
        });
        toast.success('PDF de pendentes gerado!');
        break;
    }
  };

  const handleEditClick = (inscrito: Inscrito) => {
    setEditingInscrito(inscrito);
    setEditForm({
      nome: inscrito.nome,
      dataNascimento: inscrito.dataNascimento,
      igreja: inscrito.igreja,
      distrito: inscrito.distrito,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingInscrito) return;
    
    setSaving(true);
    try {
      const updated: Inscrito = {
        ...editingInscrito,
        nome: editForm.nome.trim().toUpperCase(),
        dataNascimento: editForm.dataNascimento,
        idade: calcularIdade(editForm.dataNascimento),
        igreja: editForm.igreja.trim() || 'Não informado',
        distrito: editForm.distrito.trim() || 'Não informado',
      };
      
      await saveInscrito(updated);
      toast.success('Inscrito atualizado!');
      setEditingInscrito(null);
      reloadInscritos();
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inscrito: Inscrito) => {
    try {
      await deleteInscrito(inscrito.numero);
      toast.success(`${inscrito.nome} foi removido`);
      reloadInscritos();
    } catch (error) {
      toast.error('Erro ao excluir inscrito');
    }
  };

  if (inscritosLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-lg text-muted-foreground">Carregando inscritos...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
        <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-display-sm text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Lista de Inscritos
            </h1>
            <p className="text-muted-foreground mt-1">
              {inscritos.size} inscritos carregados
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Evento:</span>
              <Select value={selectedEventId} onValueChange={handleEventChange}>
                <SelectTrigger className="w-[220px]" disabled={eventosLoading}>
                  <SelectValue placeholder={eventosLoading ? 'Carregando...' : 'Todos'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {eventos.map((evento) => (
                    <SelectItem key={evento.id} value={evento.id}>{evento.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                <DropdownMenuItem onClick={() => handleExportPDF('todos')}>
                  📋 Todos os Inscritos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('sorteados')}>
                  ✅ Apenas Sorteados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF('nao-sorteados')}>
                  ⏳ Pendentes de Sorteio
                </DropdownMenuItem>
                
                {igrejasUnicas.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Por Igreja
                    </div>
                    {igrejasUnicas.map((igreja) => (
                      <DropdownMenuItem key={igreja} onClick={() => handleExportPDF('todos', igreja)}>
                        🏛️ {igreja}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
            <AddInscritoForm onSuccess={reloadInscritos} />
          </div>
        </div>

        {/* Search and Sort */}
        <Card className="glass">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Foto</TableHead>
                    <TableHead className="w-20">Nº</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Idade</TableHead>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Distrito</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inscritosFiltrados.map((inscrito) => (
                    <TableRow key={inscrito.numero} className={inscrito.isManual ? 'bg-accent/20' : ''}>
                      <TableCell>
                        <img
                          src={inscrito.fotoUrl || DEFAULT_PHOTO}
                          alt={inscrito.nome}
                          className="h-12 w-12 rounded-full object-cover border-2 border-border"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_PHOTO;
                          }}
                        />
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(inscrito)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir inscrito?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir {inscrito.nome}? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(inscrito)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {inscritosFiltrados.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum inscrito encontrado
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Exibindo {inscritosFiltrados.length} de {inscritos.size} inscritos
        </p>
      </div>

      {/* Modal de Edição */}
      <Dialog open={!!editingInscrito} onOpenChange={(open) => !open && setEditingInscrito(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Inscrito #{editingInscrito?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome Completo</Label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nascimento">Data de Nascimento</Label>
              <Input
                id="edit-nascimento"
                type="date"
                value={editForm.dataNascimento}
                onChange={(e) => setEditForm(prev => ({ ...prev, dataNascimento: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-igreja">Igreja</Label>
              <Input
                id="edit-igreja"
                value={editForm.igreja}
                onChange={(e) => setEditForm(prev => ({ ...prev, igreja: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-distrito">Distrito</Label>
              <Input
                id="edit-distrito"
                value={editForm.distrito}
                onChange={(e) => setEditForm(prev => ({ ...prev, distrito: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInscrito(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.nome || !editForm.dataNascimento}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Inscritos;
