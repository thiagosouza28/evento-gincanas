import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ClipboardList, Pencil, Trash2, FileText, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyBR, maskCpf, maskPhone, stripNonDigits } from '@/lib/masks';
import { toast } from 'sonner';
import { calcularIdade } from '@/types';
import { estornarPagamento, gerarComprovanteInscricao, getAdminInscricaoStatus } from '@/lib/inscricoesAdminApi';
import { useAuth } from '@/contexts/AuthContext';

interface PagamentoRow {
  id: string;
  status: string;
  payment_method: string | null;
  comprovante_url: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

interface ParticipanteRow {
  id: string;
  evento_id: string;
  nome: string;
  cpf: string;
  nascimento: string | null;
  genero: string | null;
  telefone: string | null;
  distrito_id: string | null;
  igreja_id: string | null;
  created_at: string;
  inscricoes?: {
    id: string;
    status: string;
    whatsapp: string | null;
    total: number;
    created_at: string;
    eventos?: { nome: string } | null;
    pagamentos?: PagamentoRow[] | null;
  } | null;
  distritos?: { nome: string } | null;
  igrejas?: { nome: string } | null;
}

interface LoteRow {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  evento_id: string;
  eventos?: { nome: string } | null;
}

type AgeFilter = 'all' | 'lte9' | 'gte10';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

const statusMeta: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'PENDENTE', variant: 'warning' },
  PAID: { label: 'PAGO', variant: 'success' },
  CONFIRMED: { label: 'CONFIRMADO', variant: 'secondary' },
  CANCELLED: { label: 'CANCELADO', variant: 'destructive' },
  REFUNDED: { label: 'ESTORNADO', variant: 'outline' },
  MANUAL: { label: 'MANUAL', variant: 'default' },
};

const getStatusMeta = (status: string | null | undefined) => {
  const normalized = String(status || 'PENDING').trim().toUpperCase();
  return statusMeta[normalized] || { label: normalized || 'PENDENTE', variant: 'outline' as const };
};

const InscricoesAdmin = () => {
  const { user, profile } = useAuth();
  const [activeEvento, setActiveEvento] = useState<{ id: string; nome: string } | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
  const [inscritoNumeroByParticipanteId, setInscritoNumeroByParticipanteId] = useState<Map<string, number>>(new Map());
  const [distritos, setDistritos] = useState<Array<{ id: string; nome: string }>>([]);
  const [igrejas, setIgrejas] = useState<Array<{ id: string; nome: string }>>([]);
  const [lotes, setLotes] = useState<LoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ParticipanteRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ParticipanteRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [selectedLote, setSelectedLote] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [refundTarget, setRefundTarget] = useState<{ participante: ParticipanteRow; pagamentoId: string } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    nascimento: '',
    genero: '',
    telefone: '',
    distritoId: '',
    igrejaId: '',
  });

  const isAdmin = String(profile?.role || 'ADMIN').toUpperCase() === 'ADMIN';

  const withActionLoading = async (key: string, action: () => Promise<void>) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const loadParticipantes = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    if (!user?.id) {
      setParticipantes([]);
      setInscritoNumeroByParticipanteId(new Map());
      setLotes([]);
      setActiveEvento(null);
      if (showSpinner) {
        setLoading(false);
      }
      return;
    }

    try {
      const { data: eventoData, error: eventoError } = await supabase
        .from('eventos')
        .select('id, nome')
        .eq('owner_id', user.id)
        .eq('status', 'ativo')
        .order('data_inicio', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (eventoError) {
        throw eventoError;
      }

      const eventoAtivo = (eventoData || [])[0] as { id: string; nome: string } | undefined;
      if (!eventoAtivo?.id) {
        setActiveEvento(null);
        setParticipantes([]);
        setInscritoNumeroByParticipanteId(new Map());
        setLotes([]);
        return;
      }

      setActiveEvento(eventoAtivo);

      const [participantesRes, distritosRes, igrejasRes, lotesRes] = await Promise.all([
        supabase
          .from('participantes')
          .select('*, inscricoes(id, status, whatsapp, total, created_at, eventos(nome), pagamentos(id, status, payment_method, comprovante_url, transaction_id, paid_at, refunded_at, created_at)), distritos(nome), igrejas(nome)')
          .eq('evento_id', eventoAtivo.id)
          .order('created_at', { ascending: false }),
        supabase.from('distritos').select('id, nome').order('nome'),
        supabase.from('igrejas').select('id, nome').order('nome'),
        supabase
          .from('lotes')
          .select('id, nome, inicio, fim, evento_id, eventos(nome)')
          .eq('evento_id', eventoAtivo.id)
          .order('inicio', { ascending: false }),
      ]);

      if (participantesRes.error) {
        toast.error('Erro ao carregar inscritos');
        setParticipantes([]);
      } else {
        setParticipantes((participantesRes.data || []) as ParticipanteRow[]);
      }

      const participanteIds = (participantesRes.data || [])
        .map((item: { id: string }) => String(item.id))
        .filter(Boolean);

      if (participanteIds.length > 0) {
        const { data: inscritosData, error: inscritosError } = await supabase
          .from('inscritos')
          .select('numero, numero_original')
          .eq('user_id', user.id)
          .in('numero_original', participanteIds);

        if (!inscritosError) {
          const map = new Map<string, number>();
          (inscritosData || []).forEach((row: { numero: number; numero_original: string | null }) => {
            if (row.numero_original) {
              map.set(String(row.numero_original), row.numero);
            }
          });
          setInscritoNumeroByParticipanteId(map);
        } else {
          setInscritoNumeroByParticipanteId(new Map());
        }
      } else {
        setInscritoNumeroByParticipanteId(new Map());
      }

      if (!distritosRes.error) {
        setDistritos((distritosRes.data || []) as Array<{ id: string; nome: string }>);
      }
      if (!igrejasRes.error) {
        setIgrejas((igrejasRes.data || []) as Array<{ id: string; nome: string }>);
      }
      if (!lotesRes.error) {
        setLotes((lotesRes.data || []) as LoteRow[]);
      }
    } catch (error) {
      console.error('Erro ao carregar inscritos admin:', error);
      toast.error('Erro ao carregar inscritos');
      setActiveEvento(null);
      setParticipantes([]);
      setInscritoNumeroByParticipanteId(new Map());
      setLotes([]);
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadParticipantes();
  }, [loadParticipantes]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadParticipantes(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadParticipantes]);

  const normalizeSearch = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const lotesByEvento = useMemo(() => {
    const map = new Map<string, LoteRow[]>();
    lotes.forEach((lote) => {
      const list = map.get(lote.evento_id) || [];
      list.push(lote);
      map.set(lote.evento_id, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => a.inicio.localeCompare(b.inicio));
    });
    return map;
  }, [lotes]);

  const getDateKey = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  const getLoteForParticipante = (participante: ParticipanteRow) => {
    const eventId = participante.evento_id;
    if (!eventId) return null;
    const lotesEvento = lotesByEvento.get(eventId);
    if (!lotesEvento || lotesEvento.length === 0) return null;
    const dataBase = getDateKey(participante.inscricoes?.created_at || participante.created_at);
    if (!dataBase) return null;
    return lotesEvento.find((lote) => dataBase >= lote.inicio && dataBase <= lote.fim) || null;
  };

  const getLatestPagamento = (participante: ParticipanteRow) => {
    const pagamentos = participante.inscricoes?.pagamentos || [];
    if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
      return null;
    }

    return [...pagamentos].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];
  };

  const getNumeroInscrito = (participanteId: string) => {
    const numero = inscritoNumeroByParticipanteId.get(participanteId);
    return Number.isFinite(numero) ? numero : null;
  };

  const filteredParticipantes = participantes.filter((participante) => {
    if (searchTerm.trim()) {
      const term = normalizeSearch(searchTerm);
      const nome = normalizeSearch(participante.nome || '');
      const cpf = (participante.cpf || '').replace(/\D/g, '');
      const searchCpf = term.replace(/\D/g, '');
      if (!nome.includes(term) && !(searchCpf && cpf.includes(searchCpf))) {
        return false;
      }
    }

    if (ageFilter !== 'all') {
      if (!participante.nascimento) return false;
      const idade = calcularIdade(participante.nascimento);
      if (!Number.isFinite(idade)) return false;
      if (ageFilter === 'lte9' && idade > 9) return false;
      if (ageFilter === 'gte10' && idade < 10) return false;
    }

    if (selectedLote !== 'all') {
      const lote = getLoteForParticipante(participante);
      if (!lote || lote.id !== selectedLote) return false;
    }

    return true;
  });

  const resetForm = () => {
    setForm({
      nome: '',
      cpf: '',
      nascimento: '',
      genero: '',
      telefone: '',
      distritoId: '',
      igrejaId: '',
    });
    setEditing(null);
  };

  const openEdit = (participante: ParticipanteRow) => {
    setEditing(participante);
    setForm({
      nome: participante.nome,
      cpf: maskCpf(participante.cpf),
      nascimento: participante.nascimento || '',
      genero: participante.genero || '',
      telefone: participante.telefone ? maskPhone(participante.telefone) : '',
      distritoId: participante.distrito_id || '',
      igrejaId: participante.igreja_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.nome.trim()) {
      toast.error('Informe o nome');
      return;
    }
    if (!form.cpf.trim()) {
      toast.error('Informe o CPF');
      return;
    }

    const cpfDigits = stripNonDigits(form.cpf);
    if (cpfDigits.length !== 11) {
      toast.error('CPF invalido');
      return;
    }
    const telefoneDigits = form.telefone ? stripNonDigits(form.telefone) : '';
    if (form.telefone && telefoneDigits.length < 10) {
      toast.error('Telefone invalido');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      cpf: cpfDigits,
      nascimento: form.nascimento || null,
      genero: form.genero || null,
      telefone: form.telefone ? telefoneDigits : null,
      distrito_id: form.distritoId || null,
      igreja_id: form.igrejaId || null,
    };

    const { error } = await supabase.from('participantes').update(payload).eq('id', editing.id);
    if (error) {
      toast.error('Erro ao atualizar inscrito');
      return;
    }
    toast.success('Inscrito atualizado');
    setDialogOpen(false);
    resetForm();
    await loadParticipantes(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('participantes').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir inscrito');
      return;
    }
    toast.success('Inscrito excluido');
    setDeleteTarget(null);
    await loadParticipantes(false);
  };

  const handleGerarComprovante = async (participante: ParticipanteRow) => {
    const inscricaoId = participante.inscricoes?.id;
    if (!inscricaoId) {
      toast.error('Inscricao nao encontrada para este participante');
      return;
    }

    const loadingKey = `receipt:${inscricaoId}`;
    await withActionLoading(loadingKey, async () => {
      try {
        const result = await gerarComprovanteInscricao(inscricaoId, false);
        if (result.comprovante_url) {
          window.open(result.comprovante_url, '_blank', 'noopener,noreferrer');
        }
        toast.success(result.generated ? 'Comprovante gerado com sucesso' : 'Comprovante existente baixado');
        await loadParticipantes(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao gerar comprovante');
      }
    });
  };

  const handleAbrirEstorno = async (participante: ParticipanteRow) => {
    const inscricaoId = participante.inscricoes?.id;
    if (!inscricaoId) {
      toast.error('Inscricao nao encontrada para este participante');
      return;
    }

    const loadingKey = `refund:lookup:${inscricaoId}`;
    await withActionLoading(loadingKey, async () => {
      try {
        const status = await getAdminInscricaoStatus(inscricaoId);
        if (!status.pagamento?.id) {
          toast.error('Pagamento nao encontrado para esta inscricao');
          return;
        }
        if (status.pagamento.status !== 'PAID') {
          toast.error('Somente pagamentos pagos podem ser estornados');
          return;
        }

        setRefundReason('');
        setRefundTarget({ participante, pagamentoId: status.pagamento.id });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao preparar estorno');
      }
    });
  };

  const handleConfirmarEstorno = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim()) {
      toast.error('Informe o motivo do estorno');
      return;
    }

    const loadingKey = `refund:confirm:${refundTarget.pagamentoId}`;
    await withActionLoading(loadingKey, async () => {
      try {
        await estornarPagamento(refundTarget.pagamentoId, refundReason.trim());
        toast.success('Pagamento estornado com sucesso');
        setRefundTarget(null);
        setRefundReason('');
        await loadParticipantes(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao estornar pagamento');
      }
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inscritos</h1>
            <p className="text-muted-foreground">Lista de inscritos por evento</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {participantes.length} inscricoes carregadas
            </p>
            <p className="text-xs text-muted-foreground">
              Evento ativo: {activeEvento?.nome || 'Nao encontrado'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inscritos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="w-full md:max-w-sm">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <Input
                  placeholder="Buscar por nome ou CPF"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full md:w-64">
                <Label className="text-xs text-muted-foreground">Lote</Label>
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
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-56">
                <Label className="text-xs text-muted-foreground">Idade</Label>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipantes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      Nenhum inscrito encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filteredParticipantes.map((participante) => {
                  const pagamento = getLatestPagamento(participante);
                  const inscricaoStatus = getStatusMeta(participante.inscricoes?.status || 'PENDING');
                  const pagamentoStatus = pagamento ? getStatusMeta(pagamento.status) : null;
                  const inscricaoId = participante.inscricoes?.id || '';
                  const canReceipt = Boolean(pagamento && (pagamento.status === 'PAID' || pagamento.status === 'REFUNDED'));
                  const canRefund = Boolean(isAdmin && pagamento?.status === 'PAID');
                  const receiptLoading = Boolean(actionLoading[`receipt:${inscricaoId}`]);
                  const refundLookupLoading = Boolean(actionLoading[`refund:lookup:${inscricaoId}`]);

                  return (
                    <TableRow key={participante.id}>
                      <TableCell className="font-semibold text-primary">
                        {getNumeroInscrito(participante.id) ?? '-'}
                      </TableCell>
                      <TableCell>{participante.nome}</TableCell>
                      <TableCell>
                        {participante.nascimento
                          ? new Date(participante.nascimento).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell>{participante.igrejas?.nome || '-'}</TableCell>
                      <TableCell>{participante.distritos?.nome || '-'}</TableCell>
                      <TableCell>{participante.inscricoes?.eventos?.nome || '-'}</TableCell>
                      <TableCell>{getLoteForParticipante(participante)?.nome || '-'}</TableCell>
                      <TableCell>{participante.inscricoes?.whatsapp || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {pagamentoStatus ? (
                            <Badge variant={pagamentoStatus.variant}>{pagamentoStatus.label}</Badge>
                          ) : null}
                          <Badge variant={inscricaoStatus.variant}>{inscricaoStatus.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrencyBR(participante.inscricoes?.total || 0)}
                      </TableCell>
                      <TableCell>
                        {participante.inscricoes?.created_at
                          ? new Date(participante.inscricoes.created_at).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(participante)} className="gap-1">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(participante)} className="gap-1">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                          {canReceipt ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleGerarComprovante(participante)}
                              disabled={receiptLoading}
                            >
                              {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                              Gerar comprovante
                            </Button>
                          ) : null}
                          {canRefund ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleAbrirEstorno(participante)}
                              disabled={refundLookupLoading}
                            >
                              {refundLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                              Extornar
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-sm text-muted-foreground">
              Exibindo {filteredParticipantes.length} de {participantes.length} inscricoes
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar inscrito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm((prev) => ({ ...prev, cpf: maskCpf(e.target.value) }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.nascimento} onChange={(e) => setForm((prev) => ({ ...prev, nascimento: e.target.value }))} />
              </div>
              <div>
                <Label>Genero</Label>
                <Input value={form.genero} onChange={(e) => setForm((prev) => ({ ...prev, genero: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Distrito</Label>
                <Select value={form.distritoId || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, distritoId: value === 'none' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem distrito</SelectItem>
                    {distritos.map((distrito) => (
                      <SelectItem key={distrito.id} value={distrito.id}>
                        {distrito.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Igreja</Label>
                <Select value={form.igrejaId || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, igrejaId: value === 'none' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem igreja</SelectItem>
                    {igrejas.map((igreja) => (
                      <SelectItem key={igreja.id} value={igreja.id}>
                        {igreja.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm((prev) => ({ ...prev, telefone: maskPhone(e.target.value) }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extornar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Informe o motivo do estorno para o inscrito {refundTarget?.participante.nome || '-'}.
            </p>
            <div>
              <Label>Motivo do estorno</Label>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ex: Solicitacao da igreja"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRefundTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleConfirmarEstorno}
                disabled={!refundReason.trim() || Boolean(refundTarget && actionLoading[`refund:confirm:${refundTarget.pagamentoId}`])}
              >
                {refundTarget && actionLoading[`refund:confirm:${refundTarget.pagamentoId}`] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Estornando...
                  </>
                ) : (
                  'Confirmar estorno'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir inscrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default InscricoesAdmin;
