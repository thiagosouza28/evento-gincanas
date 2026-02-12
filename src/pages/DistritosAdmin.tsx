import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MapPin, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Distrito } from '@/types';

const DistritosAdmin = () => {
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Distrito | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Distrito | null>(null);
  const [form, setForm] = useState({ nome: '', codigo: '' });

  const loadDistritos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('distritos').select('*').order('nome');
    if (error) {
      toast.error('Erro ao carregar distritos');
    } else {
      setDistritos(
        (data || []).map((row) => ({
          id: row.id,
          nome: row.nome,
          codigo: row.codigo,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDistritos();
  }, []);

  const resetForm = () => {
    setForm({ nome: '', codigo: '' });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (distrito: Distrito) => {
    setEditing(distrito);
    setForm({ nome: distrito.nome, codigo: distrito.codigo || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do distrito');
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from('distritos')
        .update({ nome: form.nome.trim(), codigo: form.codigo || null })
        .eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar distrito');
        return;
      }
      toast.success('Distrito atualizado');
    } else {
      const { error } = await supabase
        .from('distritos')
        .insert({ nome: form.nome.trim(), codigo: form.codigo || null });
      if (error) {
        toast.error('Erro ao criar distrito');
        return;
      }
      toast.success('Distrito criado');
    }
    setDialogOpen(false);
    resetForm();
    await loadDistritos();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('distritos').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir distrito');
      return;
    }
    toast.success('Distrito excluído');
    setDeleteTarget(null);
    await loadDistritos();
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
            <MapPin className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Distritos</h1>
              <p className="text-muted-foreground">Gerencie os distritos cadastrados</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Distrito
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Distritos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {distritos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum distrito cadastrado.</p>
            )}
            {distritos.map((distrito) => (
              <div
                key={distrito.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
              >
                <div>
                  <p className="font-semibold text-foreground">{distrito.nome}</p>
                  <p className="text-xs text-muted-foreground">Código: {distrito.codigo || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(distrito)} className="gap-1">
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(distrito)} className="gap-1">
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
            <DialogTitle>{editing ? 'Editar Distrito' : 'Novo Distrito'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={form.codigo} onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))} />
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
            <AlertDialogTitle>Excluir distrito?</AlertDialogTitle>
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

export default DistritosAdmin;
