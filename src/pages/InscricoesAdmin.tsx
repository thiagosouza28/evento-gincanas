import { useEffect, useMemo, useState } from 'react';
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
import { Loader2, ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyBR, maskCpf, maskPhone, stripNonDigits } from '@/lib/masks';
import { toast } from 'sonner';
import { calcularIdade } from '@/types';

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
    status: string;
    whatsapp: string | null;
    total: number;
    created_at: string;
    eventos?: { nome: string } | null;
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

const statusVariant = (status: string) => {
  if (status === 'PAID') return 'default';
  if (status === 'PENDING') return 'secondary';
  if (status === 'CANCELLED') return 'destructive';
  return 'outline';
};

const InscricoesAdmin = () => {
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
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
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    nascimento: '',
    genero: '',
    telefone: '',
    distritoId: '',
    igrejaId: '',
  });

  const loadParticipantes = async () => {
    setLoading(true);
    const [participantesRes, distritosRes, igrejasRes, lotesRes] = await Promise.all([
      supabase
        .from('participantes')
        .select('*, inscricoes(status, whatsapp, total, created_at, eventos(nome)), distritos(nome), igrejas(nome)')
        .order('created_at', { ascending: false }),
      supabase.from('distritos').select('id, nome').order('nome'),
      supabase.from('igrejas').select('id, nome').order('nome'),
      supabase.from('lotes').select('id, nome, inicio, fim, evento_id, eventos(nome)').order('inicio', { ascending: false }),
    ]);

    if (participantesRes.error) {
      toast.error('Erro ao carregar inscritos');
    } else {
      setParticipantes((participantesRes.data || []) as ParticipanteRow[]);
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
    setLoading(false);
  };

  useEffect(() => {
    loadParticipantes();
  }, []);

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
      toast.error('CPF inválido');
      return;
    }
    const telefoneDigits = form.telefone ? stripNonDigits(form.telefone) : '';
    if (form.telefone && telefoneDigits.length < 10) {
      toast.error('Telefone inválido');
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
    await loadParticipantes();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('participantes').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir inscrito');
      return;
    }
    toast.success('Inscrito excluído');
    setDeleteTarget(null);
    await loadParticipantes();
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
            <p className="text-sm text-muted-foreground mt-1">
              {participantes.length} inscrições carregadas
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
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipantes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      Nenhum inscrito encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filteredParticipantes.map((participante) => (
                  <TableRow key={participante.id}>
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
                      <Badge variant={statusVariant(participante.inscricoes?.status || 'PENDING')}>
                        {participante.inscricoes?.status || 'PENDING'}
                      </Badge>
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
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(participante)} className="gap-1">
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(participante)} className="gap-1">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-sm text-muted-foreground">
              Exibindo {filteredParticipantes.length} de {participantes.length} inscrições
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
                <Label>Gênero</Label>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir inscrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
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
