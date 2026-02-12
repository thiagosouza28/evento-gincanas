import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Church, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { maskCpf, maskPhone, stripNonDigits } from '@/lib/masks';
import { toast } from 'sonner';
import type { Igreja, Distrito } from '@/types';

const IgrejasAdmin = () => {
  const [igrejas, setIgrejas] = useState<Igreja[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Igreja | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Igreja | null>(null);
  const [form, setForm] = useState({
    nome: '',
    distritoId: '',
    cidade: '',
    contato: '',
    diretorNome: '',
    diretorCpf: '',
    diretorTelefone: '',
    diretorEmail: '',
    diretorCargo: 'Diretor Jovem',
  });

  const loadData = async () => {
    setLoading(true);
    const [igrejasRes, distritosRes] = await Promise.all([
      supabase.from('igrejas').select('*').order('nome'),
      supabase.from('distritos').select('*').order('nome'),
    ]);

    if (igrejasRes.error || distritosRes.error) {
      toast.error('Erro ao carregar dados');
    } else {
      setIgrejas(
        (igrejasRes.data || []).map((row) => ({
          id: row.id,
          nome: row.nome,
          distritoId: row.distrito_id,
          cidade: row.cidade,
          contato: row.contato,
          diretorJovemNome: row.diretor_jovem_nome,
          diretorJovemCpf: row.diretor_jovem_cpf,
          diretorJovemTelefone: row.diretor_jovem_telefone,
          diretorJovemEmail: row.diretor_jovem_email,
          diretorJovemCargo: row.diretor_jovem_cargo,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
      setDistritos(
        (distritosRes.data || []).map((row) => ({
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
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      nome: '',
      distritoId: '',
      cidade: '',
      contato: '',
      diretorNome: '',
      diretorCpf: '',
      diretorTelefone: '',
      diretorEmail: '',
      diretorCargo: 'Diretor Jovem',
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (igreja: Igreja) => {
    setEditing(igreja);
    setForm({
      nome: igreja.nome,
      distritoId: igreja.distritoId || '',
      cidade: igreja.cidade || '',
      contato: igreja.contato || '',
      diretorNome: igreja.diretorJovemNome || '',
      diretorCpf: igreja.diretorJovemCpf ? maskCpf(igreja.diretorJovemCpf) : '',
      diretorTelefone: igreja.diretorJovemTelefone ? maskPhone(igreja.diretorJovemTelefone) : '',
      diretorEmail: igreja.diretorJovemEmail || '',
      diretorCargo: igreja.diretorJovemCargo || 'Diretor Jovem',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da igreja');
      return;
    }
    if (!form.distritoId) {
      toast.error('Informe o distrito');
      return;
    }
    if (!form.diretorNome.trim()) {
      toast.error('Informe o nome do Diretor Jovem');
      return;
    }
    const cpfDigits = stripNonDigits(form.diretorCpf);
    if (cpfDigits.length !== 11) {
      toast.error('Informe o CPF do Diretor Jovem');
      return;
    }
    const telefoneDigits = stripNonDigits(form.diretorTelefone);
    if (telefoneDigits.length < 10) {
      toast.error('Informe o WhatsApp do Diretor Jovem');
      return;
    }
    if (!form.diretorEmail.trim() || !form.diretorEmail.includes('@')) {
      toast.error('Informe o e-mail do Diretor Jovem');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      distrito_id: form.distritoId,
      cidade: form.cidade || null,
      contato: form.contato || null,
      diretor_jovem_nome: form.diretorNome.trim(),
      diretor_jovem_cpf: cpfDigits,
      diretor_jovem_telefone: telefoneDigits,
      diretor_jovem_email: form.diretorEmail.trim(),
      diretor_jovem_cargo: 'Diretor Jovem',
    };

    if (editing) {
      const { error } = await supabase.from('igrejas').update(payload).eq('id', editing.id);
      if (error) {
        toast.error('Erro ao atualizar igreja');
        return;
      }
      toast.success('Igreja atualizada');
    } else {
      const { error } = await supabase.from('igrejas').insert(payload);
      if (error) {
        toast.error('Erro ao criar igreja');
        return;
      }
      toast.success('Igreja criada');
    }
    setDialogOpen(false);
    resetForm();
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('igrejas').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir igreja');
      return;
    }
    toast.success('Igreja excluída');
    setDeleteTarget(null);
    await loadData();
  };

  const distritoName = (id?: string | null) => {
    if (!id) return '-';
    const match = distritos.find((d) => d.id === id);
    return match?.nome || '-';
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
            <Church className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Igrejas</h1>
              <p className="text-muted-foreground">Gerencie igrejas e seus distritos</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Igreja
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Igrejas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {igrejas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma igreja cadastrada.</p>
            )}
            {igrejas.map((igreja) => (
              <div
                key={igreja.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
              >
                <div>
                  <p className="font-semibold text-foreground">{igreja.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Distrito: {distritoName(igreja.distritoId)} • Cidade: {igreja.cidade || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Contato: {igreja.contato || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    Diretor Jovem: {igreja.diretorJovemNome || '-'} • {igreja.diretorJovemTelefone ? maskPhone(igreja.diretorJovemTelefone) : '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(igreja)} className="gap-1">
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(igreja)} className="gap-1">
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
            <DialogTitle>{editing ? 'Editar Igreja' : 'Nova Igreja'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
            </div>
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
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))} />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => setForm((prev) => ({ ...prev, contato: e.target.value }))} />
            </div>
            <div className="border-t border-border pt-3">
              <Label className="text-sm font-semibold">Diretor Jovem</Label>
              <div className="mt-2 grid gap-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={form.diretorNome} onChange={(e) => setForm((prev) => ({ ...prev, diretorNome: e.target.value }))} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={form.diretorCpf} onChange={(e) => setForm((prev) => ({ ...prev, diretorCpf: maskCpf(e.target.value) }))} />
                </div>
                <div>
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={form.diretorTelefone} onChange={(e) => setForm((prev) => ({ ...prev, diretorTelefone: maskPhone(e.target.value) }))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.diretorEmail} onChange={(e) => setForm((prev) => ({ ...prev, diretorEmail: e.target.value }))} />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input value={form.diretorCargo} readOnly />
                </div>
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
            <AlertDialogTitle>Excluir igreja?</AlertDialogTitle>
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

export default IgrejasAdmin;
