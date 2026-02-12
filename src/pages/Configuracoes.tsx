import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useApiConfig, useDatabase, useOnlineStatus, useSystemConfig } from '@/hooks/useDatabase';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, Database, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchEventos, syncInscritos, testApiConnection } from '@/lib/apiSync';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Configuracoes = () => {
  const { config, saveConfig, loading: configLoading } = useApiConfig();
  const { config: systemConfig, saveConfig: saveSystemConfig, loading: systemLoading } = useSystemConfig();

  const { inscritosCount, reinitialize } = useDatabase();
  const isOnline = useOnlineStatus();
  
  const [syncing, setSyncing] = useState(false);
  const [minEquipes, setMinEquipes] = useState('');
  const [testing, setTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [eventId, setEventId] = useState('');
  const [eventos, setEventos] = useState<Array<{ id: string; name: string }>>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Array<'PAID' | 'PENDING' | 'CANCELLED'>>(['PAID', 'PENDING', 'CANCELLED']);
  const [resetToken, setResetToken] = useState('');
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);

  const RESET_CONFIRM_PHRASE = 'ZERAR TUDO';

  useEffect(() => {
    if (systemConfig) {
      setMinEquipes(String(systemConfig.minEquipes));
    }
  }, [systemConfig]);

  useEffect(() => {
    if (config?.eventId) {
      setEventId(config.eventId);
    }
    if (config?.syncStatuses && config.syncStatuses.length > 0) {
      setSyncStatuses(config.syncStatuses);
    }
  }, [config]);

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

  const handleTestConnection = async () => {
    setTesting(true);
    setSyncStatus('idle');
    setSyncMessage('');

    const result = await testApiConnection();
    
    if (result.success) {
      setSyncStatus('success');
      setSyncMessage('Conexão com MySQL bem sucedida!');
    } else {
      setSyncStatus('error');
      setSyncMessage(result.error || 'Erro ao conectar');
    }
    
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    
    try {
      const result = await syncInscritos(eventId || undefined, syncStatuses);
      
      if (result.success) {
        await reinitialize();
        setSyncStatus('success');
        setSyncMessage(`${result.count} participantes sincronizados e numerados de 1 a ${result.count}!`);
        
        // Atualizar config local
        await saveConfig({
          baseUrl: 'mysql-database',
          token: '',
          lastSync: new Date().toISOString(),
          eventId: eventId || undefined,
          syncStatuses,
        });
      } else {
        setSyncStatus('error');
        setSyncMessage(result.error || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      setSyncStatus('error');
      setSyncMessage('Erro inesperado na sincronização');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveEventId = async () => {
    await saveConfig({
      baseUrl: config?.baseUrl || 'mysql-database',
      token: config?.token || '',
      lastSync: config?.lastSync,
      eventId: eventId || undefined,
      syncStatuses,
    });
    toast.success('Filtros de sincronização salvos.');
  };

  const toggleStatus = (status: 'PAID' | 'PENDING' | 'CANCELLED') => {
    setSyncStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((item) => item !== status);
      }
      return [...prev, status];
    });
  };


  const handleSaveSystemConfig = async () => {
    const value = Number(minEquipes);
    if (!Number.isFinite(value) || value < 1) {
      toast.error('Informe um numero minimo valido');
      return;
    }
    await saveSystemConfig({ minEquipes: Math.floor(value) });
    toast.success('Configuracao atualizada com sucesso');
  };

  const handleResetData = async () => {
    if (resetting) return;

    const normalizedPhrase = resetPhrase.trim().toUpperCase();
    if (normalizedPhrase !== RESET_CONFIRM_PHRASE) {
      toast.error(`Digite "${RESET_CONFIRM_PHRASE}" para confirmar.`);
      return;
    }
    if (!resetToken.trim()) {
      toast.error('Informe o token de reset.');
      return;
    }

    if (!confirm('ATENCAO: Isso vai apagar TODOS os dados do sistema. Esta acao NAO pode ser desfeita. Deseja continuar?')) {
      return;
    }
    if (!confirm('Ultima confirmacao: todo o sistema sera zerado. Confirmar exclusao total?')) {
      return;
    }

    try {
      setResetting(true);
      const { error } = await supabase.functions.invoke('admin-reset', {
        body: { confirm: RESET_CONFIRM_PHRASE },
        headers: { 'x-reset-token': resetToken.trim() },
      });

      if (error) {
        throw new Error(error.message);
      }

      localStorage.removeItem('apiConfig');
      localStorage.removeItem('systemConfig');

      toast.success('Sistema zerado com sucesso. Voce sera desconectado.');
      await supabase.auth.signOut();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Erro ao resetar sistema:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao resetar sistema');
    } finally {
      setResetting(false);
    }
  };

  if (configLoading || systemLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
        <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-display-sm text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Configure a conexão com a API e sincronização</p>
        </div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-5 w-5 text-success" />
                ) : (
                  <WifiOff className="h-5 w-5 text-destructive" />
                )}
                Status de Conexão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-lg font-semibold ${isOnline ? 'text-success' : 'text-destructive'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isOnline 
                      ? 'Conectado à internet. Sincronização disponível.' 
                      : 'Sem conexão. Usando dados locais.'}
                  </p>
                </div>
                <div className={`h-4 w-4 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Database Connection Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Banco de Dados Externo
              </CardTitle>
              <CardDescription>
                Conexão configurada com o banco MySQL para sincronização de inscritos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">MySQL Configurado</p>
                    <p className="text-sm text-muted-foreground">Credenciais armazenadas com segurança</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Evento para sincronizar (opcional)</Label>
                <div className="flex gap-2">
                  <Select value={eventId || 'all'} onValueChange={(value) => setEventId(value === 'all' ? '' : value)}>
                    <SelectTrigger className="w-full" disabled={eventosLoading}>
                      <SelectValue placeholder={eventosLoading ? 'Carregando eventos...' : 'Todos'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {eventos.map((evento) => (
                        <SelectItem key={evento.id} value={evento.id}>{evento.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleSaveEventId}>
                    Salvar Filtros
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se informado, a sincronização buscará apenas as inscrições desse evento.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status para sincronizar</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={syncStatuses.includes('PAID')}
                      onCheckedChange={() => toggleStatus('PAID')}
                    />
                    Pagos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={syncStatuses.includes('PENDING')}
                      onCheckedChange={() => toggleStatus('PENDING')}
                    />
                    Pendentes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={syncStatuses.includes('CANCELLED')}
                      onCheckedChange={() => toggleStatus('CANCELLED')}
                    />
                    Cancelados
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se nenhum status for selecionado, todos serão sincronizados.
                </p>
              </div>
              <Button 
                onClick={handleTestConnection} 
                disabled={testing} 
                variant="outline"
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando conexão...
                  </>
                ) : (
                  'Testar Conexão'
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>


        {/* System Rules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Regras do Sistema
              </CardTitle>
              <CardDescription>
                Defina o numero minimo de equipes para liberar pontuacao
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min-equipes">Numero minimo de equipes</Label>
                <Input
                  id="min-equipes"
                  type="number"
                  min="1"
                  value={minEquipes}
                  onChange={(e) => setMinEquipes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enquanto houver menos equipes que este valor, lancamentos e descontos de pontos ficam bloqueados.
                </p>
              </div>
              <Button onClick={handleSaveSystemConfig} variant="outline" className="w-full">
                Salvar Configuracao
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Synchronization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Sincronização
              </CardTitle>
              <CardDescription>
                Sincronize os dados dos inscritos com o servidor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Inscritos no Cache</p>
                    <p className="text-sm text-muted-foreground">Dados armazenados localmente</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">{inscritosCount}</p>
              </div>

              {config?.lastSync && (
                <div className="text-sm text-muted-foreground">
                  Última sincronização: {new Date(config.lastSync).toLocaleString('pt-BR')}
                </div>
              )}

              <Button 
                onClick={handleSync} 
                disabled={syncing || !isOnline}
                variant="outline" 
                className="w-full"
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar Agora
                  </>
                )}
              </Button>

              {syncStatus === 'success' && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{syncMessage || 'Sincronização concluída com sucesso!'}</span>
                </div>
              )}

              {syncStatus === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{syncMessage || 'Erro na sincronização. Tente novamente.'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Reset Data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
              <CardDescription>
                Acoes irreversiveis que apagam dados do sistema (nao remove tabelas)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-token">Token de reset (admin)</Label>
                <Input
                  id="reset-token"
                  type="password"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Informe o token de reset"
                />
                <p className="text-xs text-muted-foreground">
                  Configure `SYSTEM_RESET_TOKEN` nas secrets das funcoes do Supabase.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Digite {RESET_CONFIRM_PHRASE} para confirmar</Label>
                <Input
                  id="reset-confirm"
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value)}
                  placeholder={RESET_CONFIRM_PHRASE}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleResetData}
                className="w-full"
                disabled={resetting || !resetToken.trim() || resetPhrase.trim().toUpperCase() !== RESET_CONFIRM_PHRASE}
              >
                {resetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetando sistema...
                  </>
                ) : (
                  'Resetar Todos os Dados'
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
