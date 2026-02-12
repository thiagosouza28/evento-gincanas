import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, FileSpreadsheet, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Evento } from '@/types';

const RelatoriosAdmin = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadEventos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('eventos').select('*').order('nome');
    if (error) {
      toast.error('Erro ao carregar eventos');
    } else {
      const mapped = (data || []).map((row) => ({
        id: row.id,
        nome: row.nome,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        local: row.local,
        status: row.status as Evento['status'],
      }));
      setEventos(mapped);
      if (!selectedEventId && mapped.length > 0) {
        setSelectedEventId(mapped[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEventos();
  }, []);

  const downloadReport = async (format: 'pdf' | 'xlsx') => {
    if (!selectedEventId) {
      toast.error('Selecione um evento');
      return;
    }
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/admin/reports/event/${selectedEventId}?format=${format}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `relatorio-${selectedEventId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error('Erro ao baixar relatório');
    } finally {
      setDownloading(false);
    }
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
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground">Baixe relatórios em PDF ou Excel</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Relatório por Evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {eventos.map((evento) => (
                    <SelectItem key={evento.id} value={evento.id}>
                      {evento.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => downloadReport('pdf')} disabled={downloading} className="gap-2">
                <FileDown className="h-4 w-4" />
                Baixar PDF
              </Button>
              <Button onClick={() => downloadReport('xlsx')} disabled={downloading} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Baixar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RelatoriosAdmin;
