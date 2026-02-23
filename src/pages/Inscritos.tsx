import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useInscritos, useSorteios } from '@/hooks/useDatabase';
import { Search, Users, Loader2, RefreshCw, FileDown, ChevronDown, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddInscritoForm } from '@/components/sorteio/AddInscritoForm';
import { syncInscricoesToInscritos } from '@/lib/inscricoesSync';
import { generateInscritosPDF } from '@/lib/pdfGenerator';
import { useEventoNome } from '@/hooks/useEventoNome';
import { calcularIdade } from '@/types';
import { toast } from 'sonner';
import type { Inscrito } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_PHOTO = '/placeholder.svg';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  PAID: { label: 'Pago', variant: 'success' },
  CONFIRMED: { label: 'Confirmado', variant: 'secondary' },
  PENDING: { label: 'Pendente', variant: 'warning' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  REFUNDED: { label: 'Estornado', variant: 'outline' },
  MANUAL: { label: 'Manual', variant: 'outline' },
};

const getStatusInfo = (status: string | undefined) => {
  const upperStatus = String(status || '').trim().toUpperCase();
  if (!upperStatus) return statusLabels.PENDING;
  if (statusLabels[upperStatus]) return statusLabels[upperStatus];
  return { label: upperStatus, variant: 'outline' as const };
};

type SortOption = 'numero-asc' | 'numero-desc' | 'nome-asc' | 'nome-desc';
type AgeFilter = 'all' | 'lte9' | 'gte10';
type LoteRow = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  evento_id: string;
  eventos?: { nome: string } | null;
};
type ParticipanteLookup = {
  id: string;
  evento_id: string;
  created_at: string;
  inscricoes?: { created_at?: string | null } | null;
};

const Inscritos = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('numero-asc');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [selectedLote, setSelectedLote] = useState<string>('all');
  const [syncingInscricoes, setSyncingInscricoes] = useState(false);
  const [activeEventoInscricoes, setActiveEventoInscricoes] = useState<{ id: string; name: string } | null>(null);
  const [activeEventoInscricoesLoading, setActiveEventoInscricoesLoading] = useState(false);
  const [lotes, setLotes] = useState<LoteRow[]>([]);
  const [participantesLookup, setParticipantesLookup] = useState<Map<string, ParticipanteLookup>>(new Map());

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
  const { eventoNome } = useEventoNome();

  const sorteadosSet = useMemo(() => new Set(sorteios.map(s => s.numeroInscrito)), [sorteios]);

  useEffect(() => {
    let active = true;
    const loadEventoAtivo = async () => {
      if (!user?.id) {
        if (active) {
          setActiveEventoInscricoes(null);
          setActiveEventoInscricoesLoading(false);
        }
        return;
      }
      setActiveEventoInscricoesLoading(true);
      const { data, error } = await supabase
        .from('eventos')
        .select('id, nome')
        .eq('owner_id', user.id)
        .eq('status', 'ativo')
        .order('data_inicio', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && active) {
        const first = (data || [])[0];
        setActiveEventoInscricoes(first ? { id: first.id, name: first.nome } : null);
      }
      if (active) {
        setActiveEventoInscricoesLoading(false);
      }
    };
    loadEventoAtivo();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const loadLotes = async () => {
      if (!activeEventoInscricoes?.id) {
        if (active) setLotes([]);
        return;
      }

      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome, inicio, fim, evento_id, eventos(nome)')
        .eq('evento_id', activeEventoInscricoes.id)
        .order('inicio', { ascending: false });
      if (!error && active) {
        setLotes((data || []) as LoteRow[]);
      }
    };
    loadLotes();
    return () => {
      active = false;
    };
  }, [activeEventoInscricoes?.id]);

  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const participanteIds = Array.from(inscritos.values())
      .map((inscrito) => inscrito.numeroOriginal)
      .filter((id): id is string => typeof id === 'string' && uuidRegex.test(id));

    const hasMissingLote = Array.from(inscritos.values()).some((inscrito) => !inscrito.loteId);
    if (!hasMissingLote) {
      setParticipantesLookup(new Map());
      return;
    }

    if (participanteIds.length === 0) {
      setParticipantesLookup(new Map());
      return;
    }

    let active = true;
    const loadParticipantes = async () => {
      const map = new Map<string, ParticipanteLookup>();
      const chunkSize = 500;

      for (let i = 0; i < participanteIds.length; i += chunkSize) {
        const chunk = participanteIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('participantes')
          .select('id, evento_id, created_at, inscricoes(created_at)')
          .in('id', chunk);

        if (error) {
          toast.error('Erro ao carregar inscricoes');
          break;
        }

        (data || []).forEach((row) => {
          map.set(row.id, row as ParticipanteLookup);
        });
      }

      if (active) {
        setParticipantesLookup(map);
      }
    };

    loadParticipantes();

    return () => {
      active = false;
    };
  }, [inscritos]);

  const lotesByEvento = useMemo(() => {
    const map = new Map<string, LoteRow[]>();
    lotes.forEach((lote) => {
      const list = map.get(lote.evento_id) || [];
      list.push(lote);
      map.set(lote.evento_id, list);
    });
    map.forEach((list) => list.sort((a, b) => a.inicio.localeCompare(b.inicio)));
    return map;
  }, [lotes]);

  const lotesById = useMemo(() => {
    return new Map(lotes.map((lote) => [lote.id, lote]));
  }, [lotes]);

  const externalLotes = useMemo(() => {
    const map = new Map<string, { key: string; nome: string }>();
    inscritos.forEach((inscrito) => {
      const key = inscrito.loteExternoId || inscrito.loteExternoNome;
      if (!key) return;
      const nome = inscrito.loteExternoNome || key;
      map.set(key, { key, nome });
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [inscritos]);

  const getDateKey = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  const getLoteForInscrito = (inscrito: Inscrito) => {
    if (inscrito.loteId) {
      return lotesById.get(inscrito.loteId) || null;
    }
    const participanteId = inscrito.numeroOriginal;
    if (!participanteId) return null;
    const participante = participantesLookup.get(participanteId);
    if (!participante) return null;
    const lotesEvento = lotesByEvento.get(participante.evento_id);
    if (!lotesEvento || lotesEvento.length === 0) return null;
    const dataBase = getDateKey(participante.inscricoes?.created_at || participante.created_at);
    if (!dataBase) return null;
    return lotesEvento.find((lote) => dataBase >= lote.inicio && dataBase <= lote.fim) || null;
  };

  const getLoteLabel = (inscrito: Inscrito) => {
    const localLote = getLoteForInscrito(inscrito);
    if (localLote) return localLote.nome;
    if (inscrito.loteExternoNome) return `${inscrito.loteExternoNome} (externo)`;
    if (inscrito.loteExternoId) return `Lote ${inscrito.loteExternoId} (externo)`;
    return '-';
  };

  const getEventoIdForInscrito = (inscrito: Inscrito) => {
    if (inscrito.loteId) {
      return lotesById.get(inscrito.loteId)?.evento_id || null;
    }
    const participanteId = inscrito.numeroOriginal;
    if (participanteId) {
      return participantesLookup.get(participanteId)?.evento_id || null;
    }
    return null;
  };

  const inscritosEventoAtivo = useMemo(() => {
    const activeEventId = activeEventoInscricoes?.id;
    const lista = Array.from(inscritos.values());
    if (!activeEventId) return lista;
    return lista.filter((inscrito) => getEventoIdForInscrito(inscrito) === activeEventId);
  }, [inscritos, activeEventoInscricoes?.id, lotesById, participantesLookup]);

  const inscritosFiltrados = useMemo(() => {
    let lista = [...inscritosEventoAtivo];

    if (search) {
      const termo = search.toLowerCase();
      lista = lista.filter(i =>
        i.nome.toLowerCase().includes(termo) ||
        i.numero.toString().includes(termo) ||
        i.igreja.toLowerCase().includes(termo) ||
        i.distrito.toLowerCase().includes(termo),
      );
    }

    if (ageFilter !== 'all') {
      lista = lista.filter((i) => {
        const idadeCalculada = i.dataNascimento
          ? calcularIdade(i.dataNascimento)
          : (Number.isFinite(i.idade) ? i.idade : null);
        if (idadeCalculada === null) return false;
        if (!i.dataNascimento && idadeCalculada === 0) return false;
        return ageFilter === 'lte9' ? idadeCalculada <= 9 : idadeCalculada >= 10;
      });
    }

    if (selectedLote !== 'all') {
      lista = lista.filter((inscrito) => {
        if (selectedLote.startsWith('external:')) {
          const externalKey = selectedLote.replace('external:', '');
          return inscrito.loteExternoId === externalKey || inscrito.loteExternoNome === externalKey;
        }
        const lote = getLoteForInscrito(inscrito);
        return lote?.id === selectedLote;
      });
    }

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
  }, [inscritosEventoAtivo, search, sortBy, ageFilter, selectedLote, lotesByEvento, lotesById, participantesLookup]);

  const handleSyncInscricoes = async () => {
    setSyncingInscricoes(true);
    try {
      const eventId = activeEventoInscricoes?.id;
      if (!eventId) {
        toast.error('Nenhum evento ativo encontrado');
        return;
      }
      const result = await syncInscricoesToInscritos(eventId);
      if (result.success) {
        toast.success(`${result.count} inscritos sincronizados`);
        await reloadInscritos();
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch (error) {
      toast.error('Erro ao sincronizar inscricoes');
    } finally {
      setSyncingInscricoes(false);
    }
  };

  useEffect(() => {
    if (!activeEventoInscricoes?.id || !user?.id) return;
    let active = true;
    const autoSync = async () => {
      setSyncingInscricoes(true);
      try {
        const result = await syncInscricoesToInscritos(activeEventoInscricoes.id);
        if (!active) return;
        if (result.success) {
          await reloadInscritos();
          if (result.count > 0) {
            toast.success(`${result.count} inscricoes do link sincronizadas`);
          }
        } else if (result.error) {
          toast.error(`Erro ao sincronizar inscricoes: ${result.error}`);
        }
      } finally {
        if (active) {
          setSyncingInscricoes(false);
        }
      }
    };
    autoSync();
    return () => {
      active = false;
    };
  }, [activeEventoInscricoes?.id, user?.id, reloadInscritos]);

  const igrejasUnicas = useMemo(() => {
    const igrejas = new Set<string>();
    inscritosEventoAtivo.forEach(i => {
      if (i.igreja && i.igreja !== 'Nao informado') {
        igrejas.add(i.igreja);
      }
    });
    return Array.from(igrejas).sort();
  }, [inscritosEventoAtivo]);

  const handleExportPDF = async (tipo: 'todos' | 'sorteados' | 'nao-sorteados', igreja?: string) => {
    let lista = [...inscritosEventoAtivo];

    if (igreja) {
      lista = lista.filter(i => i.igreja === igreja);
    }

    const titulo = igreja ? `Inscritos - ${igreja}` : 'Lista Completa de Inscritos';
    const pdfBranding = eventoNome
      ? { eventName: eventoNome, logoUrl: '/icon.png' }
      : undefined;

    switch (tipo) {
      case 'todos':
        await generateInscritosPDF(lista, titulo, { sorteados: sorteadosSet }, pdfBranding);
        toast.success(`PDF gerado com sucesso! ${igreja ? `(${lista.length} de ${igreja})` : ''}`);
        break;
      case 'sorteados':
        await generateInscritosPDF(lista, igreja ? `Sorteados - ${igreja}` : 'Inscritos Sorteados', {
          sorteados: sorteadosSet,
          apenasSorteados: true,
        }, pdfBranding);
        toast.success('PDF de sorteados gerado!');
        break;
      case 'nao-sorteados':
        await generateInscritosPDF(lista, igreja ? `Pendentes - ${igreja}` : 'Inscritos Pendentes de Sorteio', {
          sorteados: sorteadosSet,
          apenasNaoSorteados: true,
        }, pdfBranding);
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
        igreja: editForm.igreja.trim() || 'Nao informado',
        distrito: editForm.distrito.trim() || 'Nao informado',
      };

      await saveInscrito(updated);
      toast.success('Inscrito atualizado!');
      setEditingInscrito(null);
    } catch (error) {
      toast.error(error instanceof Error ? `Erro ao salvar: ${error.message}` : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inscrito: Inscrito) => {
    try {
      await deleteInscrito(inscrito);
      toast.success(`${inscrito.nome} foi removido`);
    } catch (error) {
      toast.error(error instanceof Error ? `Erro ao excluir: ${error.message}` : 'Erro ao excluir inscrito');
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
      <div className="space-y-6">
        <Card className="glass">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="card-eyebrow">Inscricoes</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[1.2rem] font-extrabold tracking-[-0.01em] text-foreground">
                    Lista de Inscritos
                  </h1>
                  <span className="tag-pill pill-accent">
                    {inscritosEventoAtivo.length} cadastrados
                  </span>
                </div>
                <p className="card-desc">
                  Gerencie inscricoes, sincronize dados e exporte relatorios sem alterar regras existentes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <FileDown className="h-4 w-4" />
                      Exportar PDF
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                    <DropdownMenuItem onClick={() => handleExportPDF('todos')}>
                      Todos os inscritos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPDF('sorteados')}>
                      Apenas Sorteados
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportPDF('nao-sorteados')}>
                      Pendentes de Sorteio
                    </DropdownMenuItem>
                    {igrejasUnicas.length > 0 && (
                      <>
                        <div className="my-1 border-t border-border" />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Por Igreja
                        </div>
                        {igrejasUnicas.map((igreja) => (
                          <DropdownMenuItem key={igreja} onClick={() => handleExportPDF('todos', igreja)}>
                            {igreja}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSyncInscricoes}
                  disabled={syncingInscricoes}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncingInscricoes ? 'animate-spin' : ''}`} />
                  {syncingInscricoes ? 'Atualizando...' : 'Atualizar'}
                </Button>
                <AddInscritoForm onSuccess={reloadInscritos} />
              </div>
            </div>

            <hr className="divider" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <Label>Evento ativo (filtro fixo)</Label>
                <Input
                  value={
                    activeEventoInscricoesLoading
                      ? 'Carregando evento ativo...'
                      : (activeEventoInscricoes?.name || 'Nenhum evento ativo')
                  }
                  readOnly
                />
              </div>

              <div className="field">
                <Label>Ordenacao</Label>
                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Ordenar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numero-asc">Nº (primeiro -&gt; ultimo)</SelectItem>
                      <SelectItem value="numero-desc">Nº (ultimo -&gt; primeiro)</SelectItem>
                      <SelectItem value="nome-asc">Nome (A -&gt; Z)</SelectItem>
                      <SelectItem value="nome-desc">Nome (Z -&gt; A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="field">
                <Label>Lote</Label>
                <Select value={selectedLote} onValueChange={setSelectedLote}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os lotes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os lotes</SelectItem>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.nome}
                        {lote.eventos?.nome ? ` - ${lote.eventos.nome}` : ''}
                      </SelectItem>
                    ))}
                    {externalLotes.map((lote) => (
                      <SelectItem key={`external-${lote.key}`} value={`external:${lote.key}`}>
                        {lote.nome} (externo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="field">
                <Label>Idade</Label>
                <Select value={ageFilter} onValueChange={(value) => setAgeFilter(value as AgeFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as idades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as idades</SelectItem>
                    <SelectItem value="lte9">9 anos ou menos</SelectItem>
                    <SelectItem value="gte10">10 anos ou mais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="field">
              <Label>Buscar inscrito</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, numero, igreja ou distrito..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-display text-[1.2rem] font-extrabold tracking-[-0.01em] text-foreground">
                  Inscritos
                </h2>
                <span className="tag-pill pill-accent">{inscritosFiltrados.length} listados</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exibindo {inscritosFiltrados.length} de {inscritosEventoAtivo.length} inscritos do evento ativo
              </p>
            </div>

            <div className="flex flex-col gap-[0.7rem]">
              {inscritosFiltrados.length === 0 && (
                <div className="alert alert-err show">
                  Nenhum inscrito encontrado com os filtros atuais.
                </div>
              )}

              {inscritosFiltrados.map((inscrito) => {
                const info = getStatusInfo(inscrito.statusPagamento);
                const sorteado = sorteadosSet.has(inscrito.numero);

                return (
                  <article key={inscrito.numero} className="list-card">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <img
                        src={inscrito.fotoUrl || DEFAULT_PHOTO}
                        alt={inscrito.nome}
                        className="h-11 w-11 rounded-[10px] border border-border object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_PHOTO;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="item-title truncate">{inscrito.nome}</p>
                        <p className="item-meta truncate">
                          Nº {inscrito.numero} • {inscrito.igreja} • {inscrito.distrito}
                        </p>
                        <p className="item-meta truncate">
                          Lote: {getLoteLabel(inscrito)} • Idade: {inscrito.idade ?? '-'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant={info.variant} className="text-[0.68rem]">
                            {info.label}
                          </Badge>
                          <span className={`tag-pill ${sorteado ? 'pill-success' : 'pill-warn'}`}>
                            {sorteado ? 'Sorteado' : 'Pendente'}
                          </span>
                          {inscrito.isManual && (
                            <Badge variant="outline" className="text-[0.68rem]">
                              Manual
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="total-label">Inscrito</p>
                        <p className="item-value">#{inscrito.numero}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-icon view"
                          onClick={() => handleEditClick(inscrito)}
                          title="Editar inscrito"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button type="button" className="btn-icon" title="Excluir inscrito">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir inscrito?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir {inscrito.nome}? Esta acao nao pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(inscrito)}
                                className="border border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/20"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingInscrito} onOpenChange={(open) => !open && setEditingInscrito(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Inscrito #{editingInscrito?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="field">
              <Label htmlFor="edit-nome">Nome Completo</Label>
              <Input
                id="edit-nome"
                value={editForm.nome}
                onChange={(e) => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="field">
              <Label htmlFor="edit-nascimento">Data de Nascimento</Label>
              <Input
                id="edit-nascimento"
                type="date"
                value={editForm.dataNascimento}
                onChange={(e) => setEditForm(prev => ({ ...prev, dataNascimento: e.target.value }))}
              />
            </div>
            <div className="field">
              <Label htmlFor="edit-igreja">Igreja</Label>
              <Input
                id="edit-igreja"
                value={editForm.igreja}
                onChange={(e) => setEditForm(prev => ({ ...prev, igreja: e.target.value }))}
              />
            </div>
            <div className="field">
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
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.nome.trim()}>
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
