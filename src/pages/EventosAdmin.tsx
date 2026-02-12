import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Pencil, Trash2, Loader2, Link as LinkIcon, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Evento } from '@/types';

const EventosAdmin = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Evento | null>(null);
  const [form, setForm] = useState({
    nome: '',
    dataInicio: '',
    dataFim: '',
    local: '',
    slug: '',
    status: 'ativo' as Evento['status'],
  });

  const loadEventos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .order('data_inicio', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar eventos');
    } else {
      setEventos(
        (data || []).map((row) => ({
          id: row.id,
          nome: row.nome,
          dataInicio: row.data_inicio,
          dataFim: row.data_fim,
          local: row.local,
          slug: row.slug,
          status: (row.status as Evento['status']) || 'ativo',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEventos();
  }, []);

  const resetForm = () => {
    setForm({ nome: '', dataInicio: '', dataFim: '', local: '', slug: '', status: 'ativo' });
    setEditing(null);
  };

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const generateRandomSlug = (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (evento: Evento) => {
    setEditing(evento);
    setForm({
      nome: evento.nome,
      dataInicio: evento.dataInicio || '',
      dataFim: evento.dataFim || '',
      local: evento.local || '',
      slug: evento.slug || '',
      status: evento.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do evento');
      return;
    }
    if (editing) {
      const { error } = await supabase
        .from('eventos')
        .update({
          nome: form.nome.trim(),
          data_inicio: form.dataInicio || null,
          data_fim: form.dataFim || null,
          local: form.local || null,
          slug: form.slug?.trim() || slugify(form.nome),
          status: form.status,
        })
        .eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar evento');
        return;
      }
      toast.success('Evento atualizado');
    } else {
      const { error } = await supabase.from('eventos').insert({
        nome: form.nome.trim(),
        data_inicio: form.dataInicio || null,
        data_fim: form.dataFim || null,
        local: form.local || null,
        slug: form.slug?.trim() || slugify(form.nome),
        status: form.status,
      });
      if (error) {
        toast.error('Erro ao criar evento');
        return;
      }
      toast.success('Evento criado');
    }
    setDialogOpen(false);
    resetForm();
    await loadEventos();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('eventos').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir evento');
      return;
    }
    toast.success('Evento excluído');
    setDeleteTarget(null);
    await loadEventos();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
              <p className="text-muted-foreground">Gerencie eventos ativos e inativos</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Evento
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento cadastrado.</p>
            )}
    {eventos.map((evento) => (
      <div
        key={evento.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
      >
        <div>
          <p className="font-semibold text-foreground">{evento.nome}</p>
          <p className="text-xs text-muted-foreground">
            {evento.dataInicio || '-'} até {evento.dataFim || '-'} • {evento.local || 'Local não informado'}
          </p>
          <p className="text-xs text-muted-foreground">Status: {evento.status}</p>
          {evento.slug && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              {window.location.origin}/inscricao/{evento.slug}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {evento.slug && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={async () => {
                const link = `${window.location.origin}/inscricao/${evento.slug}`;
                await navigator.clipboard.writeText(link);
                toast.success('Link copiado');
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar link
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openEdit(evento)} className="gap-1">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(evento)} className="gap-1">
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
            <DialogTitle>{editing ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Link personalizado</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="ex: retiro-espiritual-2026"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, slug: generateRandomSlug() }))
                  }
                >
                  Gerar link
                </Button>
              </div>
              {form.slug && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Link: {window.location.origin}/inscricao/{form.slug}
                </p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={form.dataInicio} onChange={(e) => setForm((prev) => ({ ...prev, dataInicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={form.dataFim} onChange={(e) => setForm((prev) => ({ ...prev, dataFim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => setForm((prev) => ({ ...prev, local: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as Evento['status'] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
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

export default EventosAdmin;
