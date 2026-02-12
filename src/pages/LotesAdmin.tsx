import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrencyBR, parseCurrencyBR } from '@/lib/masks';
import type { Lote, Evento } from '@/types';

const LotesAdmin = () => {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lote | null>(null);
  const [form, setForm] = useState({
    eventoId: '',
    nome: '',
    valor: '',
    inicio: '',
    fim: '',
    status: 'ativo' as Lote['status'],
  });

  const loadData = async () => {
    setLoading(true);
    const [lotesRes, eventosRes] = await Promise.all([
      supabase.from('lotes').select('*').order('inicio', { ascending: false }),
      supabase.from('eventos').select('*').order('nome'),
    ]);
    if (lotesRes.error || eventosRes.error) {
      toast.error('Erro ao carregar lotes');
    } else {
      setLotes(
        (lotesRes.data || []).map((row) => ({
          id: row.id,
          eventoId: row.evento_id,
          nome: row.nome,
          valor: Number(row.valor),
          inicio: row.inicio,
          fim: row.fim,
          status: (row.status as Lote['status']) || 'ativo',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
      setEventos(
        (eventosRes.data || []).map((row) => ({
          id: row.id,
          nome: row.nome,
          dataInicio: row.data_inicio,
          dataFim: row.data_fim,
          local: row.local,
          status: (row.status as Evento['status']) || 'ativo',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({ eventoId: '', nome: '', valor: '', inicio: '', fim: '', status: 'ativo' });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (lote: Lote) => {
    setEditing(lote);
    setForm({
      eventoId: lote.eventoId,
      nome: lote.nome,
      valor: formatCurrencyBR(lote.valor, false),
      inicio: lote.inicio,
      fim: lote.fim,
      status: lote.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const valorNumber = parseCurrencyBR(form.valor);
    if (!form.nome.trim()) {
      toast.error('Informe o nome do lote');
      return;
    }
    if (!form.eventoId) {
      toast.error('Selecione um evento');
      return;
    }
    if (!form.valor || valorNumber <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!form.inicio || !form.fim) {
      toast.error('Informe o período do lote');
      return;
    }

    const payload = {
      evento_id: form.eventoId,
      nome: form.nome.trim(),
      valor: valorNumber,
      inicio: form.inicio,
      fim: form.fim,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('lotes').update(payload).eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar lote');
        return;
      }
      toast.success('Lote atualizado');
    } else {
      const { error } = await supabase.from('lotes').insert(payload);
      if (error) {
        toast.error('Erro ao criar lote');
        return;
      }
      toast.success('Lote criado');
    }
    setDialogOpen(false);
    resetForm();
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('lotes').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir lote');
      return;
    }
    toast.success('Lote excluído');
    setDeleteTarget(null);
    await loadData();
  };

  const eventoNome = (id: string) => eventos.find((e) => e.id === id)?.nome || '-';

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Lotes</h1>
              <p className="text-muted-foreground">Gerencie lotes e valores por evento</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lote
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Lotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lotes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum lote cadastrado.</p>
            )}
            {lotes.map((lote) => (
              <div
                key={lote.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
              >
                <div>
                  <p className="font-semibold text-foreground">{lote.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Evento: {eventoNome(lote.eventoId)} • {lote.inicio} até {lote.fim}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Valor: {formatCurrencyBR(lote.valor)} • Status: {lote.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(lote)} className="gap-1">
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(lote)} className="gap-1">
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Lote' : 'Novo Lote'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Evento</Label>
              <Select value={form.eventoId || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, eventoId: value === 'none' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {eventos.map((evento) => (
                    <SelectItem key={evento.id} value={evento.id}>
                      {evento.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Valor</Label>
                <CurrencyInput
                  placeholder="0,00"
                  value={form.valor}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, valor: value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as Lote['status'] }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.inicio} onChange={(e) => setForm((prev) => ({ ...prev, inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.fim} onChange={(e) => setForm((prev) => ({ ...prev, fim: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote?</AlertDialogTitle>
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

export default LotesAdmin;
