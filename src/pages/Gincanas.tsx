import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useGincanas } from '@/hooks/useDatabase';
import { Trophy, Plus, Loader2, Trash2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Gincana, CategoriaGincana } from '@/types';
import { toast } from 'sonner';
import { createId } from '@/lib/id';

const categoriaLabels: Record<CategoriaGincana, string> = {
  adulto: 'Adulto',
  adulto_mulher: 'Adulto Mulher',
  adulto_homem: 'Adulto Homem',
  criancas: 'Crianças',
};

const Gincanas = () => {
  const { gincanas, loading, saveGincana, deleteGincana, reload } = useGincanas();
  const [isCreating, setIsCreating] = useState(false);
  const [newGincana, setNewGincana] = useState({ nome: '', categoria: '' as CategoriaGincana | '' });

  const handleCreate = async () => {
    if (!newGincana.nome || !newGincana.categoria) return;

    const gincana: Gincana = {
      id: createId(),
      nome: newGincana.nome,
      categoria: newGincana.categoria,
      ativa: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveGincana(gincana);
    setNewGincana({ nome: '', categoria: '' });
    setIsCreating(false);
  };

  const handleDeleteGincana = async (id: string) => {
    await deleteGincana(id);
    reload();
    toast.success('Gincana excluída com sucesso!');
  };

  if (loading) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-foreground">Gincanas</h1>
            <p className="text-muted-foreground">Gerencie os eventos e gincanas</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Gincana
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Gincana</DialogTitle>
                <DialogDescription>Defina o nome e a categoria da gincana.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome da Modalidade</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Futebol, Vôlei, Queimada..."
                    value={newGincana.nome}
                    onChange={(e) => setNewGincana({ ...newGincana, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={newGincana.categoria}
                    onValueChange={(v) => setNewGincana({ ...newGincana, categoria: v as CategoriaGincana })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adulto">Adulto</SelectItem>
                      <SelectItem value="adulto_mulher">Adulto Mulher</SelectItem>
                      <SelectItem value="adulto_homem">Adulto Homem</SelectItem>
                      <SelectItem value="criancas">Crianças</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={!newGincana.nome || !newGincana.categoria}>
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        {/* All Gincanas */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Todas as Gincanas</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gincanas.map((gincana, index) => (
              <motion.div
                key={gincana.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="glass">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{gincana.nome}</CardTitle>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir gincana?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a gincana <strong>{gincana.nome}</strong>? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGincana(gincana.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{categoriaLabels[gincana.categoria] || gincana.categoria}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {gincanas.length === 0 && (
          <Card className="glass">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma gincana cadastrada</p>
              <Button className="mt-4" onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Gincana
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default Gincanas;
