import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { calcularIdade } from '@/types';
import type { Inscrito } from '@/types';
import { useInscritos } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddInscritoFormProps {
  onSuccess: () => void;
}

type DistritoOption = {
  id: string;
  nome: string;
};

type IgrejaOption = {
  value: string;
  id: string | null;
  nome: string;
  distritoId: string | null;
  distritoNome: string;
  total: number;
};

type IgrejaRow = {
  id: string;
  nome: string;
  distrito_id: string | null;
  distritos?: { nome?: string | null } | Array<{ nome?: string | null }> | null;
  participantes?: Array<{ count: number }>;
};

const NONE_IGREJA_VALUE = '__none__';
const NEW_IGREJA_VALUE = '__new__';
const NONE_DISTRITO_VALUE = '__none__';

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const resolveDistritoNome = (distritos: IgrejaRow['distritos']): string => {
  if (!distritos) return '';
  if (Array.isArray(distritos)) {
    return distritos[0]?.nome || '';
  }
  return distritos.nome || '';
};

const mapIgrejaRow = (row: IgrejaRow, total: number): IgrejaOption => ({
  value: row.id,
  id: row.id,
  nome: row.nome,
  distritoId: row.distrito_id,
  distritoNome: resolveDistritoNome(row.distritos),
  total,
});

export function AddInscritoForm({ onSuccess }: AddInscritoFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingIgrejas, setLoadingIgrejas] = useState(false);
  const [igrejas, setIgrejas] = useState<IgrejaOption[]>([]);
  const [distritos, setDistritos] = useState<DistritoOption[]>([]);
  const [selectedIgrejaId, setSelectedIgrejaId] = useState<string>(NONE_IGREJA_VALUE);
  const [newIgrejaNome, setNewIgrejaNome] = useState('');
  const [newIgrejaDistritoId, setNewIgrejaDistritoId] = useState<string>(NONE_DISTRITO_VALUE);
  const { inscritos, saveInscrito } = useInscritos();
  const [formData, setFormData] = useState({
    nome: '',
    dataNascimento: '',
    distrito: '',
  });

  const igrejasOrdenadas = useMemo(() => {
    return [...igrejas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [igrejas]);

  const resetForm = useCallback(() => {
    setFormData({
      nome: '',
      dataNascimento: '',
      distrito: '',
    });
    setSelectedIgrejaId(NONE_IGREJA_VALUE);
    setNewIgrejaNome('');
    setNewIgrejaDistritoId(NONE_DISTRITO_VALUE);
  }, []);

  const loadIgrejasAndDistritos = useCallback(async () => {
    setLoadingIgrejas(true);

    try {
      const [igrejasRes, inscritosRes, distritosRes] = await Promise.all([
        supabase
          .from('igrejas')
          .select('id, nome, distrito_id, distritos(nome), participantes:participantes(count)')
          .order('nome'),
        supabase.from('inscritos').select('igreja, distrito'),
        supabase.from('distritos').select('id, nome').order('nome'),
      ]);

      if (igrejasRes.error || inscritosRes.error || distritosRes.error) {
        toast.error('Erro ao carregar igrejas e distritos');
        return;
      }

      setDistritos(
        (distritosRes.data || []).map((row) => ({
          id: row.id,
          nome: row.nome,
        })),
      );

      const aggregate = new Map<string, IgrejaOption>();

      const addAggregate = (params: {
        nome: string;
        distritoNome?: string | null;
        distritoId?: string | null;
        id?: string | null;
        total: number;
      }) => {
        const nome = params.nome?.trim();
        if (!nome) return;
        const normalized = normalizeText(nome);
        const fallbackValue = `inscrito:${normalized}`;
        const existing = aggregate.get(normalized);

        if (!existing) {
          aggregate.set(normalized, {
            value: params.id || fallbackValue,
            id: params.id || null,
            nome,
            distritoId: params.distritoId || null,
            distritoNome: params.distritoNome || '',
            total: Math.max(0, params.total),
          });
          return;
        }

        existing.total += Math.max(0, params.total);
        if (!existing.distritoNome && params.distritoNome) {
          existing.distritoNome = params.distritoNome;
        }
        if (!existing.distritoId && params.distritoId) {
          existing.distritoId = params.distritoId;
        }
        if (!existing.id && params.id) {
          existing.id = params.id;
          existing.value = params.id;
          existing.nome = nome;
        }
      };

      ((igrejasRes.data || []) as IgrejaRow[]).forEach((row) => {
        const count = row.participantes?.[0]?.count || 0;
        if (count > 0) {
          const mapped = mapIgrejaRow(row, count);
          addAggregate({
            nome: mapped.nome,
            distritoNome: mapped.distritoNome,
            distritoId: mapped.distritoId,
            id: mapped.id,
            total: mapped.total,
          });
        }
      });

      (inscritosRes.data || []).forEach((row) => {
        if (!row.igreja) return;
        addAggregate({
          nome: row.igreja,
          distritoNome: row.distrito || '',
          total: 1,
        });
      });

      setIgrejas(
        Array.from(aggregate.values())
          .filter((igreja) => igreja.total > 0)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
    } finally {
      setLoadingIgrejas(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadIgrejasAndDistritos();
  }, [open, loadIgrejasAndDistritos]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleIgrejaChange = (value: string) => {
    setSelectedIgrejaId(value);

    if (value !== NEW_IGREJA_VALUE) {
      setNewIgrejaNome('');
      setNewIgrejaDistritoId(NONE_DISTRITO_VALUE);
    }

    if (value === NEW_IGREJA_VALUE || value === NONE_IGREJA_VALUE) {
      return;
    }

    const igrejaSelecionada = igrejas.find((igreja) => igreja.value === value);
    if (igrejaSelecionada?.distritoNome) {
      setFormData((prev) => ({ ...prev, distrito: igrejaSelecionada.distritoNome }));
    }
  };

  const handleNewIgrejaDistritoChange = (value: string) => {
    setNewIgrejaDistritoId(value);

    if (value === NONE_DISTRITO_VALUE) {
      return;
    }

    const distritoSelecionado = distritos.find((distrito) => distrito.id === value);
    if (distritoSelecionado?.nome) {
      setFormData((prev) => ({ ...prev, distrito: distritoSelecionado.nome }));
    }
  };

  const getDistritoIdFromNome = (nome?: string) => {
    if (!nome?.trim()) return null;
    const match = distritos.find((distrito) => normalizeText(distrito.nome) === normalizeText(nome));
    return match?.id || null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.dataNascimento) {
      toast.error('Preencha nome e data de nascimento');
      return;
    }

    setLoading(true);

    try {
      let igrejaNome = '';
      let distritoNome = formData.distrito.trim();

      if (selectedIgrejaId === NEW_IGREJA_VALUE) {
        const nomeNovaIgreja = newIgrejaNome.trim();

        if (!nomeNovaIgreja) {
          toast.error('Informe o nome da nova igreja');
          return;
        }

        const igrejaExistente = igrejasOrdenadas.find(
          (igreja) => !!igreja.id && normalizeText(igreja.nome) === normalizeText(nomeNovaIgreja),
        );

        if (igrejaExistente) {
          igrejaNome = igrejaExistente.nome;
          setSelectedIgrejaId(igrejaExistente.value);
          if (!distritoNome && igrejaExistente.distritoNome) {
            distritoNome = igrejaExistente.distritoNome;
          }
          toast.info('Igreja ja cadastrada. O sistema usou o cadastro existente.');
        } else {
          const distritoId = newIgrejaDistritoId === NONE_DISTRITO_VALUE ? null : newIgrejaDistritoId;

          const { data: igrejaCriada, error: igrejaError } = await supabase
            .from('igrejas')
            .insert({
              nome: nomeNovaIgreja,
              distrito_id: distritoId,
            })
            .select('id, nome, distrito_id, distritos(nome)')
            .single();

          if (igrejaError || !igrejaCriada) {
            throw igrejaError || new Error('Erro ao cadastrar igreja');
          }

          const novaIgreja = mapIgrejaRow(igrejaCriada as IgrejaRow, 1);

          setIgrejas((prev) => {
            const normalizedNome = normalizeText(novaIgreja.nome);
            const next = prev.filter(
              (igreja) =>
                igreja.value !== novaIgreja.value &&
                !(normalizeText(igreja.nome) === normalizedNome && !igreja.id),
            );
            next.push(novaIgreja);
            return next.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          });

          setSelectedIgrejaId(novaIgreja.value);
          igrejaNome = novaIgreja.nome;

          if (!distritoNome && novaIgreja.distritoNome) {
            distritoNome = novaIgreja.distritoNome;
          }
        }
      } else if (selectedIgrejaId !== NONE_IGREJA_VALUE) {
        const igrejaSelecionada = igrejas.find((igreja) => igreja.value === selectedIgrejaId);
        if (igrejaSelecionada) {
          igrejaNome = igrejaSelecionada.nome;
          if (!distritoNome && igrejaSelecionada.distritoNome) {
            distritoNome = igrejaSelecionada.distritoNome;
          }

          if (!igrejaSelecionada.id) {
            const distritoId = igrejaSelecionada.distritoId || getDistritoIdFromNome(distritoNome || igrejaSelecionada.distritoNome);

            const { data: igrejaCriada, error: igrejaError } = await supabase
              .from('igrejas')
              .insert({
                nome: igrejaSelecionada.nome,
                distrito_id: distritoId,
              })
              .select('id, nome, distrito_id, distritos(nome)')
              .single();

            if (igrejaError || !igrejaCriada) {
              throw igrejaError || new Error('Erro ao cadastrar igreja');
            }

            const novaIgreja = mapIgrejaRow(igrejaCriada as IgrejaRow, Math.max(igrejaSelecionada.total, 1));

            setIgrejas((prev) =>
              prev
                .map((igreja) => (igreja.value === igrejaSelecionada.value ? novaIgreja : igreja))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
            );

            setSelectedIgrejaId(novaIgreja.value);
            igrejaNome = novaIgreja.nome;

            if (!distritoNome && novaIgreja.distritoNome) {
              distritoNome = novaIgreja.distritoNome;
            }

            toast.success('Igreja cadastrada na lista de igrejas');
          }
        }
      }

      // Evita conflito de numero quando existem inscritos removidos.
      const numerosExistentes = Array.from(inscritos.keys());
      const nextNumber = numerosExistentes.length > 0 ? Math.max(...numerosExistentes) + 1 : 1;

      const novoInscrito: Inscrito = {
        numero: nextNumber,
        nome: formData.nome.trim().toUpperCase(),
        dataNascimento: formData.dataNascimento,
        idade: calcularIdade(formData.dataNascimento),
        igreja: igrejaNome || 'Nao informado',
        distrito: distritoNome || 'Nao informado',
        statusPagamento: 'MANUAL',
        isManual: true,
        numeroPulseira: String(nextNumber),
      };

      await saveInscrito(novoInscrito);
      toast.success('Inscrito adicionado');

      resetForm();
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao adicionar inscrito:', error);
      toast.error('Erro ao adicionar inscrito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Adicionar Inscrito
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Inscrito</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              placeholder="Digite o nome completo"
              value={formData.nome}
              onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData((prev) => ({ ...prev, dataNascimento: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="igreja-select">Igreja</Label>
            <Select value={selectedIgrejaId} onValueChange={handleIgrejaChange}>
              <SelectTrigger id="igreja-select" disabled={loading || loadingIgrejas}>
                <SelectValue placeholder={loadingIgrejas ? 'Carregando igrejas...' : 'Selecione a igreja'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_IGREJA_VALUE}>Nao informar igreja</SelectItem>
                {igrejasOrdenadas.map((igreja) => (
                  <SelectItem key={igreja.value} value={igreja.value}>
                    {igreja.nome}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_IGREJA_VALUE}>+ Cadastrar nova igreja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedIgrejaId === NEW_IGREJA_VALUE && (
            <div className="space-y-4 rounded-md border border-border/60 p-3">
              <div className="space-y-2">
                <Label htmlFor="nova-igreja">Nome da nova igreja *</Label>
                <Input
                  id="nova-igreja"
                  placeholder="Digite o nome da igreja"
                  value={newIgrejaNome}
                  onChange={(e) => setNewIgrejaNome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Distrito da nova igreja</Label>
                <Select value={newIgrejaDistritoId} onValueChange={handleNewIgrejaDistritoChange}>
                  <SelectTrigger disabled={loading || loadingIgrejas}>
                    <SelectValue placeholder="Selecione o distrito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_DISTRITO_VALUE}>Sem distrito</SelectItem>
                    {distritos.map((distrito) => (
                      <SelectItem key={distrito.id} value={distrito.id}>
                        {distrito.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="distrito">Distrito</Label>
            <Input
              id="distrito"
              placeholder="Nome do distrito"
              value={formData.distrito}
              onChange={(e) => setFormData((prev) => ({ ...prev, distrito: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              O distrito e preenchido automaticamente quando a igreja possui cadastro.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.nome ||
                !formData.dataNascimento ||
                (selectedIgrejaId === NEW_IGREJA_VALUE && !newIgrejaNome.trim())
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {selectedIgrejaId === NEW_IGREJA_VALUE ? 'Salvando e cadastrando igreja...' : 'Salvando...'}
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
