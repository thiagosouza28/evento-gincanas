import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  activatePaymentIntegration,
  createPaymentIntegration,
  deletePaymentIntegration,
  listPaymentIntegrations,
  updatePaymentIntegration,
} from '@/lib/paymentIntegrationsApi';
import type { PaymentIntegration } from '@/types';
import { CheckCircle2, CreditCard, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_OPTIONS = ['mercadopago', 'stripe', 'asaas'];

type IntegrationFormState = {
  provider: string;
  accessToken: string;
  publicKey: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  isActive: boolean;
};

const EMPTY_FORM: IntegrationFormState = {
  provider: 'mercadopago',
  accessToken: '',
  publicKey: '',
  clientId: '',
  clientSecret: '',
  webhookSecret: '',
  isActive: false,
};

function toFormState(integration?: PaymentIntegration | null): IntegrationFormState {
  if (!integration) return { ...EMPTY_FORM };
  return {
    provider: integration.provider || 'mercadopago',
    accessToken: integration.accessToken || '',
    publicKey: integration.publicKey || '',
    clientId: integration.clientId || '',
    clientSecret: integration.clientSecret || '',
    webhookSecret: integration.webhookSecret || '',
    isActive: integration.isActive,
  };
}

export function PaymentIntegrationsSection() {
  const [integrations, setIntegrations] = useState<PaymentIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentIntegration | null>(null);
  const [form, setForm] = useState<IntegrationFormState>(EMPTY_FORM);

  const activeIntegrationId = useMemo(
    () => integrations.find((integration) => integration.isActive)?.id || null,
    [integrations]
  );

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await listPaymentIntegrations();
      setIntegrations(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar integrações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (integration: PaymentIntegration) => {
    setEditing(integration);
    setForm(toFormState(integration));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.provider.trim()) {
      toast.error('Selecione o provedor');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        provider: form.provider.trim().toLowerCase(),
        access_token: form.accessToken || null,
        public_key: form.publicKey || null,
        client_id: form.clientId || null,
        client_secret: form.clientSecret || null,
        webhook_secret: form.webhookSecret || null,
        is_active: form.isActive,
      };

      if (editing) {
        await updatePaymentIntegration(editing.id, payload);
        toast.success('Integração atualizada');
      } else {
        await createPaymentIntegration(payload);
        toast.success('Integração criada');
      }

      setDialogOpen(false);
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      await loadIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar integração');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (integration: PaymentIntegration) => {
    if (integration.id === activeIntegrationId) {
      return;
    }
    try {
      await activatePaymentIntegration(integration.id);
      toast.success('Integração ativada');
      await loadIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ativar integração');
    }
  };

  const handleDelete = async (integration: PaymentIntegration) => {
    const confirmed = window.confirm(
      `Excluir a integração ${integration.provider}? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      await deletePaymentIntegration(integration.id);
      toast.success('Integração removida');
      await loadIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover integração');
    }
  };

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Integração de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Integração de Pagamento
            </CardTitle>
            <CardDescription>
              Configure provedores por usuário e ative apenas uma integração por vez.
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada.</p>
          )}
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{integration.provider}</p>
                  {integration.isActive ? (
                    <Badge className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Criado em {new Date(integration.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!integration.isActive && (
                  <Button variant="outline" size="sm" onClick={() => handleActivate(integration)}>
                    Ativar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(integration)}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(integration)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm({ ...EMPTY_FORM });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Integração' : 'Nova Integração'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(value) => setForm((prev) => ({ ...prev, provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input
                value={form.accessToken}
                onChange={(e) => setForm((prev) => ({ ...prev, accessToken: e.target.value }))}
                placeholder="Token privado"
              />
            </div>

            <div className="space-y-2">
              <Label>Public Key</Label>
              <Input
                value={form.publicKey}
                onChange={(e) => setForm((prev) => ({ ...prev, publicKey: e.target.value }))}
                placeholder="Chave pública"
              />
            </div>

            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={form.clientId}
                onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                placeholder="Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm((prev) => ({ ...prev, clientSecret: e.target.value }))}
                placeholder="Client Secret"
              />
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input
                value={form.webhookSecret}
                onChange={(e) => setForm((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                placeholder="Segredo para validar webhook"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">Ativar integração</p>
                <p className="text-xs text-muted-foreground">
                  Ao ativar esta integração, as demais serão desativadas automaticamente.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
