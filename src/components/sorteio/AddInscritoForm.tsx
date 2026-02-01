import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, Loader2 } from 'lucide-react';
import { calcularIdade } from '@/types';
import type { Inscrito } from '@/types';
import { useInscritos } from '@/hooks/useDatabase';

interface AddInscritoFormProps {
  onSuccess: () => void;
}

export function AddInscritoForm({ onSuccess }: AddInscritoFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { inscritos, saveInscrito } = useInscritos();
  const [formData, setFormData] = useState({
    nome: '',
    dataNascimento: '',
    igreja: '',
    distrito: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || !formData.dataNascimento) {
      return;
    }

    setLoading(true);
    try {
      // Pegar o próximo número disponível
      const count = inscritos.size;
      const nextNumber = count + 1;

      const novoInscrito: Inscrito = {
        numero: nextNumber,
        nome: formData.nome.trim().toUpperCase(),
        dataNascimento: formData.dataNascimento,
        idade: calcularIdade(formData.dataNascimento),
        igreja: formData.igreja.trim() || 'Não informado',
        distrito: formData.distrito.trim() || 'Não informado',
        statusPagamento: 'MANUAL',
        isManual: true,
      };

      await saveInscrito(novoInscrito);
      
      // Reset form
      setFormData({
        nome: '',
        dataNascimento: '',
        igreja: '',
        distrito: '',
      });
      
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Erro ao adicionar inscrito:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="igreja">Igreja</Label>
            <Input
              id="igreja"
              placeholder="Nome da igreja"
              value={formData.igreja}
              onChange={(e) => setFormData(prev => ({ ...prev, igreja: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="distrito">Distrito</Label>
            <Input
              id="distrito"
              placeholder="Nome do distrito"
              value={formData.distrito}
              onChange={(e) => setFormData(prev => ({ ...prev, distrito: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.nome || !formData.dataNascimento}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
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
