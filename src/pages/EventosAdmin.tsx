import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Pencil, Trash2, Loader2, Link as LinkIcon, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Evento, FormaPagamentoEvento } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const PAYMENT_METHOD_OPTIONS: Array<{
  value: FormaPagamentoEvento;
  label: string;
  description: string;
}> = [
  { value: 'pix', label: 'PIX', description: 'Pagamento instantaneo via QR Code / copia e cola.' },
  { value: 'manual', label: 'Manual', description: 'Pagamento presencial/externo sem PIX automatico.' },
];

const DEFAULT_PAYMENT_METHODS: FormaPagamentoEvento[] = ['pix'];
const DEFAULT_SEGURO_VALOR = 15;

const normalizePaymentMethods = (methods: unknown): FormaPagamentoEvento[] => {
  const valid = new Set<FormaPagamentoEvento>(['pix', 'manual']);
  const list = Array.isArray(methods) ? methods : [];
  const normalized = list
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is FormaPagamentoEvento => valid.has(item as FormaPagamentoEvento));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...DEFAULT_PAYMENT_METHODS];
};

const normalizeSeguroValor = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SEGURO_VALOR;
  }
  return Number(parsed.toFixed(2));
};

const paymentMethodLabel = (method: string) => {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label || method;
};

const EventosAdmin = () => {
  const { user } = useAuth();
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
    formasPagamento: [...DEFAULT_PAYMENT_METHODS] as FormaPagamentoEvento[],
    seguroValor: String(DEFAULT_SEGURO_VALOR),
    seguroObrigatorio: false,
    status: 'ativo' as Evento['status'],
  });

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

  const getEventLink = (identifier: string) => `${window.location.origin}/inscricao/${identifier}`;

  const ensureUniqueSlug = async (baseValue: string, excludeEventId?: string) => {
    const base = slugify(baseValue) || generateRandomSlug();
    let candidate = base;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      let query = supabase.from('eventos').select('id').eq('slug', candidate).limit(1);
      if (excludeEventId) {
        query = query.neq('id', excludeEventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        return candidate;
      }

      candidate = `${base}-${generateRandomSlug(4)}`;
    }

    return `${base}-${Date.now().toString(36).slice(-6)}`;
  };

  const loadEventos = async () => {
    if (!user?.id) {
      setEventos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('owner_id', user.id)
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
          formasPagamento: normalizePaymentMethods(row.formas_pagamento),
          seguroValor: normalizeSeguroValor(row.seguro_valor),
          seguroObrigatorio: Boolean(row.seguro_obrigatorio),
          ownerId: row.owner_id,
          status: (row.status as Evento['status']) || 'ativo',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEventos();
  }, [user?.id]);

  const resetForm = () => {
    setForm({
      nome: '',
      dataInicio: '',
      dataFim: '',
      local: '',
      slug: '',
      formasPagamento: [...DEFAULT_PAYMENT_METHODS],
      seguroValor: String(DEFAULT_SEGURO_VALOR),
      seguroObrigatorio: false,
      status: 'ativo',
    });
    setEditing(null);
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
      slug: evento.slug || slugify(evento.nome),
      formasPagamento: normalizePaymentMethods(evento.formasPagamento),
      seguroValor: String(normalizeSeguroValor(evento.seguroValor)),
      seguroObrigatorio: Boolean(evento.seguroObrigatorio),
      status: evento.status,
    });
    setDialogOpen(true);
  };

  const togglePaymentMethod = (method: FormaPagamentoEvento, checked: boolean) => {
    setForm((prev) => {
      const current = new Set(prev.formasPagamento);
      if (checked) {
        current.add(method);
      } else {
        current.delete(method);
      }
      const next = Array.from(current);
      return {
        ...prev,
        formasPagamento: next.length > 0 ? (next as FormaPagamentoEvento[]) : [...DEFAULT_PAYMENT_METHODS],
      };
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome do evento');
      return;
    }

    if (!user?.id) {
      toast.error('Usuario nao autenticado');
      return;
    }
    if (!form.formasPagamento || form.formasPagamento.length === 0) {
      toast.error('Selecione ao menos uma forma de pagamento');
      return;
    }
    const seguroValorInput = Number(String(form.seguroValor).replace(',', '.'));
    if (!Number.isFinite(seguroValorInput) || seguroValorInput < 0) {
      toast.error('Informe um valor de seguro valido (zero ou maior)');
      return;
    }
    const seguroValor = Number(seguroValorInput.toFixed(2));

    try {
      const rawSlug = form.slug?.trim() || slugify(form.nome);
      const finalSlug = await ensureUniqueSlug(rawSlug, editing?.id);

      if (editing) {
        const { error } = await supabase
          .from('eventos')
          .update({
            nome: form.nome.trim(),
            data_inicio: form.dataInicio || null,
            data_fim: form.dataFim || null,
            local: form.local || null,
            slug: finalSlug,
            formas_pagamento: form.formasPagamento,
            seguro_valor: seguroValor,
            seguro_obrigatorio: form.seguroObrigatorio,
            status: form.status,
          })
          .eq('id', editing.id)
          .eq('owner_id', user.id);

        if (error) {
          if (error.code === '23505') {
            toast.error('Esse link de evento ja existe. Gere outro link.');
            return;
          }
          throw error;
        }

        toast.success('Evento atualizado');
      } else {
        const { error } = await supabase.from('eventos').insert({
          nome: form.nome.trim(),
          data_inicio: form.dataInicio || null,
          data_fim: form.dataFim || null,
          local: form.local || null,
          slug: finalSlug,
          formas_pagamento: form.formasPagamento,
          seguro_valor: seguroValor,
          seguro_obrigatorio: form.seguroObrigatorio,
          status: form.status,
          owner_id: user.id,
        });

        if (error) {
          if (error.code === '23505') {
            toast.error('Esse link de evento ja existe. Gere outro link.');
            return;
          }
          throw error;
        }

        toast.success('Evento criado');
      }

      setDialogOpen(false);
      resetForm();
      await loadEventos();
    } catch (error) {
      toast.error('Erro ao salvar evento');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!user?.id) {
      toast.error('Usuario nao autenticado');
      return;
    }

    const { error } = await supabase
      .from('eventos')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('owner_id', user.id);

    if (error) {
      toast.error('Erro ao excluir evento');
      return;
    }

    toast.success('Evento excluido');
    setDeleteTarget(null);
    await loadEventos();
  };

  const slugPreview = slugify(form.slug || form.nome);

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

            {eventos.map((evento) => {
              const eventIdentifier = evento.slug || evento.id;
              const eventLink = getEventLink(eventIdentifier);

              return (
                <div
                  key={evento.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4"
                >
                  <div>
                    <p className="font-semibold text-foreground">{evento.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {evento.dataInicio || '-'} ate {evento.dataFim || '-'} - {evento.local || 'Local nao informado'}
                    </p>
                    <p className="text-xs text-muted-foreground">Status: {evento.status}</p>
                    <p className="text-xs text-muted-foreground">
                      Pagamento: {normalizePaymentMethods(evento.formasPagamento).map(paymentMethodLabel).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Seguro: {evento.seguroObrigatorio ? 'Obrigatorio' : 'Opcional'} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(normalizeSeguroValor(evento.seguroValor))})
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <LinkIcon className="h-3 w-3" />
                      {eventLink}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={async () => {
                        await navigator.clipboard.writeText(eventLink);
                        toast.success('Link copiado');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </Button>
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
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
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
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  placeholder="ex: retiro-espiritual-2026"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, slug: slugify(prev.nome) || generateRandomSlug() }))
                  }
                >
                  Gerar link
                </Button>
              </div>
              {slugPreview && (
                <p className="mt-1 text-xs text-muted-foreground">Link: {getEventLink(slugPreview)}</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Data inicio</Label>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, dataInicio: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={form.dataFim}
                  onChange={(e) => setForm((prev) => ({ ...prev, dataFim: e.target.value }))}
                />
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
            <div className="space-y-2">
              <Label>Formas de pagamento aceitas</Label>
              <div className="space-y-2 rounded-lg border border-border p-3">
                {PAYMENT_METHOD_OPTIONS.map((option) => {
                  const checked = form.formasPagamento.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => togglePaymentMethod(option.value, event.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="text-sm">
                        <span className="font-medium text-foreground">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label htmlFor="seguro-valor">Valor adicional do seguro (R$)</Label>
              <Input
                id="seguro-valor"
                type="number"
                min="0"
                step="0.01"
                value={form.seguroValor}
                onChange={(e) => setForm((prev) => ({ ...prev, seguroValor: e.target.value }))}
                placeholder="15,00"
              />
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={form.seguroObrigatorio}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seguroObrigatorio: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Seguro obrigatório</span>
                  <span className="block text-xs text-muted-foreground">
                    Quando ativo, todo participante sai com seguro marcado automaticamente.
                  </span>
                </span>
              </label>
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

export default EventosAdmin;

