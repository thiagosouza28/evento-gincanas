import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Church } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IgrejaInscricaoRow {
  id: string;
  nome: string;
  distritos?: { nome: string } | null;
  participantes?: Array<{ count: number }>;
}

interface IgrejaAggregate {
  nome: string;
  distrito?: string | null;
  total: number;
}

const IgrejasInscritasAdmin = () => {
  const [igrejas, setIgrejas] = useState<IgrejaAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const loadIgrejas = async () => {
    setLoading(true);
    const [igrejasRes, inscritosRes] = await Promise.all([
      supabase
        .from('igrejas')
        .select('id, nome, distritos(nome), participantes:participantes(count)')
        .order('nome'),
      supabase.from('inscritos').select('igreja, distrito'),
    ]);

    if (igrejasRes.error || inscritosRes.error) {
      toast.error('Erro ao carregar igrejas');
      setLoading(false);
      return;
    }

    const aggregate = new Map<string, IgrejaAggregate>();

    const addAggregate = (nome: string, distrito: string | null | undefined, total: number) => {
      if (!nome) return;
      const key = normalize(nome);
      const current = aggregate.get(key) || { nome, distrito: distrito || null, total: 0 };
      current.total += total;
      if (!current.distrito && distrito) {
        current.distrito = distrito;
      }
      aggregate.set(key, current);
    };

    (igrejasRes.data || []).forEach((row) => {
      const count = row.participantes?.[0]?.count || 0;
      if (count > 0) {
        addAggregate(row.nome, row.distritos?.nome || null, count);
      }
    });

    (inscritosRes.data || []).forEach((row) => {
      if (!row.igreja) return;
      addAggregate(row.igreja, row.distrito || null, 1);
    });

    const merged = Array.from(aggregate.values()).filter((row) => row.total > 0);
    merged.sort((a, b) => a.nome.localeCompare(b.nome));
    setIgrejas(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadIgrejas();
  }, []);

  const filteredIgrejas = useMemo(() => {
    if (!searchTerm.trim()) return igrejas;
    const term = normalize(searchTerm);
    return igrejas.filter((igreja) => normalize(igreja.nome).includes(term));
  }, [igrejas, searchTerm]);

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
          <Church className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Igrejas com inscrições</h1>
            <p className="text-muted-foreground">Lista de igrejas com participantes inscritos</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Igrejas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 max-w-sm">
              <Input
                placeholder="Buscar igreja"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Igreja</TableHead>
                  <TableHead>Distrito</TableHead>
                  <TableHead>Inscritos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIgrejas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhuma igreja com inscrições encontrada.
                    </TableCell>
                  </TableRow>
                )}
                {filteredIgrejas.map((igreja) => (
                  <TableRow key={igreja.id}>
                    <TableCell>{igreja.nome}</TableCell>
                    <TableCell>{igreja.distrito || '-'}</TableCell>
                    <TableCell>{igreja.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default IgrejasInscritasAdmin;
