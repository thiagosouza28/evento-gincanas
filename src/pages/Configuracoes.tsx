import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiConfig, useDatabase, useOnlineStatus } from '@/hooks/useDatabase';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import * as db from '@/lib/database';
import { syncInscritos, testApiConnection } from '@/lib/apiSync';

const Configuracoes = () => {
  const { config, saveConfig, loading: configLoading } = useApiConfig();
  const { inscritosCount, reinitialize } = useDatabase();
  const isOnline = useOnlineStatus();
  
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

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
      const result = await syncInscritos();
      
      if (result.success) {
        await reinitialize();
        setSyncStatus('success');
        setSyncMessage(`${result.count} participantes sincronizados e numerados de 1 a ${result.count}!`);
        
        // Atualizar config local
        await saveConfig({
          baseUrl: 'mysql-database',
          token: '',
          lastSync: new Date().toISOString(),
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

  const handleResetData = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados do sistema (inscritos, equipes, sorteios, gincanas, pontuações). Esta ação NÃO pode ser desfeita. Deseja continuar?')) {
      return;
    }
    
    // Segunda confirmação para segurança
    if (!confirm('Última confirmação: Todos os dados serão perdidos permanentemente. Confirmar exclusão?')) {
      return;
    }
    
    try {
      // Deletar completamente o banco de dados IndexedDB
      const dbInstance = await db.getDB();
      await dbInstance.clear('inscritos');
      await dbInstance.clear('equipes');
      await dbInstance.clear('sorteios');
      await dbInstance.clear('gincanas');
      await dbInstance.clear('pontuacoes');
      await dbInstance.clear('syncQueue');
      await dbInstance.clear('config');
      
      // Fechar conexão e deletar o banco completamente
      dbInstance.close();
      await indexedDB.deleteDatabase('gincana-db');
      
      alert('✅ Todos os dados foram apagados com sucesso!');
      window.location.reload();
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      alert('Erro ao limpar dados. Tente novamente.');
    }
  };

  if (configLoading) {
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
                Ações irreversíveis que afetam todos os dados do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleResetData}
                className="w-full"
              >
                Resetar Todos os Dados
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
