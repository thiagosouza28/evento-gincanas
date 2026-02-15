import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  key: string;
  id?: string | null;
  nome: string;
  distrito?: string | null;
  total: number;
  cadastrada: boolean;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const IgrejasInscritasAdmin = () => {
  const [igrejas, setIgrejas] = useState<IgrejaAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

    const addAggregate = (
      nome: string,
      distrito: string | null | undefined,
      total: number,
      igrejaId?: string | null,
    ) => {
      if (!nome) return;
      const key = normalize(nome);
      const current = aggregate.get(key) || {
        key,
        id: null,
        nome,
        distrito: distrito || null,
        total: 0,
        cadastrada: false,
      };

      current.total += total;
      if (!current.distrito && distrito) {
        current.distrito = distrito;
      }
      if (!current.id && igrejaId) {
        current.id = igrejaId;
        current.cadastrada = true;
        current.nome = nome;
      }

      aggregate.set(key, current);
    };

    ((igrejasRes.data || []) as IgrejaInscricaoRow[]).forEach((row) => {
      const count = row.participantes?.[0]?.count || 0;
      if (count > 0) {
        addAggregate(row.nome, row.distritos?.nome || null, count, row.id);
      }
    });

    (inscritosRes.data || []).forEach((row) => {
      if (!row.igreja) return;
      addAggregate(row.igreja, row.distrito || null, 1);
    });

    const merged = Array.from(aggregate.values()).filter((row) => row.total > 0);
    merged.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    setIgrejas(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadIgrejas();
  }, []);

  const handleCadastrarIgreja = async (igreja: IgrejaAggregate) => {
    setSavingKey(igreja.key);

    try {
      const { data: existente, error: buscaError } = await supabase
        .from('igrejas')
        .select('id')
        .ilike('nome', igreja.nome)
        .limit(1);

      if (buscaError) {
        throw buscaError;
      }

      if (existente && existente.length > 0) {
        const igrejaId = existente[0].id;
        setIgrejas((prev) =>
          prev.map((item) =>
            item.key === igreja.key ? { ...item, id: igrejaId, cadastrada: true } : item,
          ),
        );
        toast.success('Igreja ja cadastrada na lista de igrejas');
        return;
      }

      let distritoId: string | null = null;
      if (igreja.distrito?.trim()) {
        const { data: distritoData } = await supabase
          .from('distritos')
          .select('id')
          .ilike('nome', igreja.distrito.trim())
          .limit(1);
        distritoId = distritoData?.[0]?.id || null;
      }

      const { data: novaIgreja, error: insertError } = await supabase
        .from('igrejas')
        .insert({
          nome: igreja.nome,
          distrito_id: distritoId,
        })
        .select('id')
        .single();

      if (insertError || !novaIgreja) {
        throw insertError || new Error('Erro ao cadastrar igreja');
      }

      setIgrejas((prev) =>
        prev.map((item) =>
          item.key === igreja.key ? { ...item, id: novaIgreja.id, cadastrada: true } : item,
        ),
      );
      toast.success('Igreja cadastrada na lista de igrejas');
    } catch (error) {
      toast.error('Erro ao cadastrar igreja');
    } finally {
      setSavingKey(null);
    }
  };

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
            <h1 className="text-2xl font-bold text-foreground">Igrejas com inscricoes</h1>
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
                  <TableHead className="w-[180px]">Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIgrejas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma igreja com inscricoes encontrada.
                    </TableCell>
                  </TableRow>
                )}
                {filteredIgrejas.map((igreja) => (
                  <TableRow key={igreja.key}>
                    <TableCell>{igreja.nome}</TableCell>
                    <TableCell>{igreja.distrito || '-'}</TableCell>
                    <TableCell>{igreja.total}</TableCell>
                    <TableCell>
                      {igreja.cadastrada ? (
                        <span className="text-xs font-medium text-emerald-600">Cadastrada</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCadastrarIgreja(igreja)}
                          disabled={savingKey === igreja.key}
                        >
                          {savingKey === igreja.key ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cadastrando...
                            </>
                          ) : (
                            'Cadastrar na lista'
                          )}
                        </Button>
                      )}
                    </TableCell>
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
