import { useState, useRef, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useEquipes, useEquipesComParticipantes, useGincanas, useSorteios, useInscritos } from '@/hooks/useDatabase';
import { useEventoNome } from '@/hooks/useEventoNome';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Edit2, Loader2, User, FileDown, Trash2, Plus, Upload, X, ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Equipe, Inscrito } from '@/types';
import { generateTeamParticipantsPDF, generateAllTeamsPDF } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createId } from '@/lib/id';

const Equipes = () => {
  const { gincanaAtiva } = useGincanas();
  const { equipes, loading, reload } = useEquipesComParticipantes(gincanaAtiva?.id);
  const { saveEquipe, deleteEquipe } = useEquipes();
  const { sorteios, removerParticipantesDaEquipe, transferirParticipantesDeEquipe } = useSorteios();
  const { getInscrito } = useInscritos();
  const { eventoNome } = useEventoNome();
  const [selectedEquipe, setSelectedEquipe] = useState<Equipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', numero: '', lider: '', vice: '', corPulseira: '', imagemUrl: '' });
  const [createForm, setCreateForm] = useState({ nome: '', numero: '', lider: '', vice: '', corPulseira: '', imagemUrl: '' });
  const [uploadingCreate, setUploadingCreate] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const [participantsDialogTeamId, setParticipantsDialogTeamId] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [transferTargetTeamId, setTransferTargetTeamId] = useState<string>('');
  const [participantsActionLoading, setParticipantsActionLoading] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const getNextTeamNumber = () => {
    const used = new Set(equipes.map((e) => e.numero).filter((n) => Number.isFinite(n)));
    let numero = 1;
    while (used.has(numero)) {
      numero += 1;
    }
    return numero;
  };

  const isNumeroDuplicado = (numero: number, equipeId?: string) =>
    equipes.some((e) => e.numero === numero && e.id !== equipeId);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${createId()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('equipes-imagens')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Erro ao fazer upload da imagem');
        return null;
      }

      const { data } = supabase.storage
        .from('equipes-imagens')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    }
  };

  const handleCreateImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingCreate(true);
    const url = await uploadImage(file);
    if (url) {
      setCreateForm({ ...createForm, imagemUrl: url });
      toast.success('Imagem enviada com sucesso!');
    }
    setUploadingCreate(false);
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingEdit(true);
    const url = await uploadImage(file);
    if (url) {
      setEditForm({ ...editForm, imagemUrl: url });
      toast.success('Imagem enviada com sucesso!');
    }
    setUploadingEdit(false);
  };

  const handleEdit = (equipe: Equipe) => {
    setSelectedEquipe(equipe);
    setEditForm({ 
      nome: equipe.nome, 
      numero: String(equipe.numero),
      lider: equipe.lider, 
      vice: equipe.vice, 
      corPulseira: equipe.corPulseira || '',
      imagemUrl: equipe.imagemUrl || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedEquipe) return;

    const numero = Number(editForm.numero);
    if (!Number.isInteger(numero) || numero <= 0) {
      toast.error('O número da equipe é obrigatório');
      return;
    }
    if (isNumeroDuplicado(numero, selectedEquipe.id)) {
      toast.error('Já existe uma equipe com este número');
      return;
    }
    
    const updatedEquipe: Equipe = {
      ...selectedEquipe,
      nome: editForm.nome,
      numero,
      lider: editForm.lider,
      vice: editForm.vice,
      corPulseira: editForm.corPulseira || undefined,
      imagemUrl: editForm.imagemUrl || undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveEquipe(updatedEquipe);
    reload();
    setIsEditing(false);
    setSelectedEquipe(null);
    toast.success('Equipe atualizada com sucesso!');
  };

  const handleCreate = async () => {
    if (!createForm.nome.trim()) {
      toast.error('O nome da equipe é obrigatório');
      return;
    }

    const numero = Number(createForm.numero);
    if (!Number.isInteger(numero) || numero <= 0) {
      toast.error('O número da equipe é obrigatório');
      return;
    }
    if (isNumeroDuplicado(numero)) {
      toast.error('Já existe uma equipe com este número');
      return;
    }

    const newEquipe: Equipe = {
      id: createId(),
      nome: createForm.nome.trim(),
      numero,
      lider: createForm.lider.trim(),
      vice: createForm.vice.trim(),
      cor: (equipes.length % 8) + 1,
      corPulseira: createForm.corPulseira || undefined,
      imagemUrl: createForm.imagemUrl || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveEquipe(newEquipe);
    reload();
    setIsCreating(false);
    setCreateForm({ nome: '', numero: '', lider: '', vice: '', corPulseira: '', imagemUrl: '' });
    toast.success('Equipe criada com sucesso!');
  };

  const handleDeleteEquipe = async (equipeId: string) => {
    await deleteEquipe(equipeId);
    reload();
    toast.success('Equipe excluída com sucesso!');
  };

  const getParticipantesEquipe = (equipeId: string): Inscrito[] => {
    const numeros = new Set<number>();
    const participantes: Inscrito[] = [];

    for (const sorteio of sorteios) {
      if (sorteio.equipeId !== equipeId) continue;
      if (numeros.has(sorteio.numeroInscrito)) continue;
      const inscrito = getInscrito(sorteio.numeroInscrito);
      if (!inscrito) continue;
      numeros.add(sorteio.numeroInscrito);
      participantes.push(inscrito);
    }

    return participantes.sort((a, b) => a.numero - b.numero);
  };

  const participantsDialogTeam = useMemo(
    () => equipes.find((e) => e.id === participantsDialogTeamId) || null,
    [equipes, participantsDialogTeamId],
  );

  const participantesDialogList = useMemo(
    () => (participantsDialogTeam ? getParticipantesEquipe(participantsDialogTeam.id) : []),
    [participantsDialogTeam, sorteios, getInscrito],
  );

  const participantesDialogNumeros = useMemo(
    () => participantesDialogList.map((p) => p.numero),
    [participantesDialogList],
  );

  const allSelected =
    participantesDialogNumeros.length > 0 &&
    selectedParticipants.length === participantesDialogNumeros.length;

  useEffect(() => {
    if (!participantsDialogTeam) {
      setSelectedParticipants([]);
      setTransferTargetTeamId('');
      return;
    }

    setSelectedParticipants((prev) =>
      prev.filter((numero) => participantesDialogNumeros.includes(numero)),
    );
  }, [participantsDialogTeam, participantesDialogNumeros]);

  const handleOpenParticipantsDialog = (equipeId: string) => {
    setParticipantsDialogTeamId(equipeId);
    setSelectedParticipants([]);
    setTransferTargetTeamId('');
  };

  const handleToggleParticipant = (numero: number, checked: boolean | 'indeterminate') => {
    setSelectedParticipants((prev) => {
      const exists = prev.includes(numero);
      if (checked && !exists) return [...prev, numero];
      if (!checked && exists) return prev.filter((n) => n !== numero);
      return prev;
    });
  };

  const handleToggleAllParticipants = (checked: boolean | 'indeterminate') => {
    if (checked) {
      setSelectedParticipants(participantesDialogNumeros);
      return;
    }
    setSelectedParticipants([]);
  };

  const handleRemoveParticipants = async (numeros: number[]) => {
    if (!participantsDialogTeam) return;
    const numerosValidos = Array.from(new Set(numeros));
    if (numerosValidos.length === 0) return;

    setParticipantsActionLoading(true);
    try {
      const removidos = await removerParticipantesDaEquipe(participantsDialogTeam.id, numerosValidos);
      await reload();
      setSelectedParticipants((prev) => prev.filter((numero) => !numerosValidos.includes(numero)));
      toast.success(
        removidos === 1
          ? 'Participante removido da equipe.'
          : `${removidos} participantes removidos da equipe.`,
      );
    } catch (error) {
      console.error('Erro ao remover participantes da equipe:', error);
      toast.error('Erro ao remover participantes da equipe.');
    } finally {
      setParticipantsActionLoading(false);
    }
  };

  const handleTransferParticipants = async () => {
    if (!participantsDialogTeam) return;
    if (!transferTargetTeamId) {
      toast.error('Selecione a equipe de destino.');
      return;
    }
    if (selectedParticipants.length === 0) {
      toast.error('Selecione participantes para transferir.');
      return;
    }

    const equipeDestino = equipes.find((e) => e.id === transferTargetTeamId);

    setParticipantsActionLoading(true);
    try {
      const transferidos = await transferirParticipantesDeEquipe(
        participantsDialogTeam.id,
        transferTargetTeamId,
        selectedParticipants,
      );
      await reload();
      setSelectedParticipants([]);
      toast.success(
        transferidos === 1
          ? `1 participante transferido para ${equipeDestino?.nome || 'a equipe de destino'}.`
          : `${transferidos} participantes transferidos para ${equipeDestino?.nome || 'a equipe de destino'}.`,
      );
    } catch (error) {
      console.error('Erro ao transferir participantes:', error);
      toast.error('Erro ao transferir participantes.');
    } finally {
      setParticipantsActionLoading(false);
    }
  };

  const pdfBranding = eventoNome || gincanaAtiva?.nome
    ? {
        eventName: eventoNome || gincanaAtiva?.nome,
        subtitle: eventoNome ? gincanaAtiva?.nome : undefined,
        logoUrl: '/icon.png',
      }
    : undefined;

  const handleDownloadPDF = async (equipe: typeof equipes[0]) => {
    const participantes = getParticipantesEquipe(equipe.id);
    toast.info('Gerando PDF...');
    await generateTeamParticipantsPDF(equipe, participantes, pdfBranding);
    toast.success('PDF gerado com sucesso!');
  };

  const handleDownloadAllPDF = async () => {
    toast.info('Gerando PDF de todas as equipes...');
    await generateAllTeamsPDF(equipes, getParticipantesEquipe, pdfBranding);
    toast.success('PDF gerado com sucesso!');
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
            <h1 className="text-display-sm text-foreground">Gestão de Equipes</h1>
            <p className="text-muted-foreground">Gerencie as equipes da gincana</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadAllPDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
            <Dialog
              open={isCreating}
              onOpenChange={(open) => {
                setIsCreating(open);
                if (open) {
                  setCreateForm({ nome: '', numero: String(getNextTeamNumber()), lider: '', vice: '', corPulseira: '', imagemUrl: '' });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Equipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Equipe</DialogTitle>
                  <DialogDescription>Preencha os dados para criar uma equipe.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="create-nome">Nome da Equipe *</Label>
                    <Input
                      id="create-nome"
                      value={createForm.nome}
                      onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                      placeholder="Ex: Equipe Azul"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-numero">Número da Equipe *</Label>
                    <Input
                      id="create-numero"
                      type="number"
                      min="1"
                      value={createForm.numero}
                      onChange={(e) => setCreateForm({ ...createForm, numero: e.target.value })}
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-lider">Líder</Label>
                    <Input
                      id="create-lider"
                      value={createForm.lider}
                      onChange={(e) => setCreateForm({ ...createForm, lider: e.target.value })}
                      placeholder="Nome do líder"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-vice">Vice-Líder</Label>
                    <Input
                      id="create-vice"
                      value={createForm.vice}
                      onChange={(e) => setCreateForm({ ...createForm, vice: e.target.value })}
                      placeholder="Nome do vice-líder"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-corPulseira">Cor da Pulseira</Label>
                    <div className="flex gap-2">
                      <Input
                        id="create-corPulseira"
                        type="color"
                        value={createForm.corPulseira || '#3b82f6'}
                        onChange={(e) => setCreateForm({ ...createForm, corPulseira: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        placeholder="#3B82F6"
                        value={createForm.corPulseira}
                        onChange={(e) => setCreateForm({ ...createForm, corPulseira: e.target.value })}
                        className="flex-1 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Imagem/Logo da Equipe</Label>
                    <div className="space-y-2">
                      <input
                        ref={createFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCreateImageUpload}
                        className="hidden"
                      />
                      {createForm.imagemUrl ? (
                        <div className="relative w-24 h-24 rounded-lg border border-border overflow-hidden">
                          <img 
                            src={createForm.imagemUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => e.currentTarget.src = '/placeholder.svg'}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => setCreateForm({ ...createForm, imagemUrl: '' })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-24 border-dashed flex flex-col gap-2"
                          onClick={() => createFileInputRef.current?.click()}
                          disabled={uploadingCreate}
                        >
                          {uploadingCreate ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-6 w-6" />
                              <span className="text-sm">Clique para enviar imagem</span>
                            </>
                          )}
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">Formatos: JPG, PNG, GIF. Máximo 5MB</p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsCreating(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate}>
                      Cadastrar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {equipes.map((equipe, index) => (
            <motion.div
              key={equipe.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="glass overflow-hidden"
                style={{ borderColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
              >
                <div 
                  className="h-2"
                  style={{ backgroundColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {/* Imagem da Equipe */}
                    <Avatar className="h-14 w-14 border-2 flex-shrink-0" style={{ borderColor: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}>
                      <AvatarImage 
                        src={equipe.imagemUrl} 
                        alt={equipe.nome} 
                        className="object-cover"
                      />
                      <AvatarFallback 
                        className="text-lg font-bold"
                        style={{ 
                          backgroundColor: `${equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`}20`,
                          color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))`
                        }}
                      >
                        {equipe.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle 
                            className="text-lg truncate"
                            style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}
                          >
                            {equipe.nome}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">Num. {equipe.numero}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(equipe)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir equipe?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a equipe <strong>{equipe.nome}</strong>? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEquipe(equipe.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Líder:</span>
                      <span className="font-medium">{equipe.lider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vice:</span>
                      <span className="font-medium">{equipe.vice}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm">Participantes</span>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: equipe.corPulseira || `hsl(var(--team-${equipe.cor}))` }}>
                      {equipe.participantes}
                    </span>
                  </div>

                  {equipe.corPulseira && (
                    <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                      <span className="text-sm">Cor Pulseira</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-5 w-5 rounded-full border border-border"
                          style={{ backgroundColor: equipe.corPulseira }}
                        />
                        <span className="text-xs font-mono">{equipe.corPulseira}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                    <span className="text-sm">Pontuação</span>
                    <span className="text-xl font-bold text-primary">
                      {equipe.pontuacaoTotal} pts
                    </span>
                  </div>

                  {/* Participantes Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      size="sm"
                      onClick={() => handleOpenParticipantsDialog(equipe.id)}
                    >
                      Gerenciar Participantes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadPDF(equipe)}
                      title="Baixar PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Manage Participants Dialog */}
        <Dialog
          open={Boolean(participantsDialogTeam)}
          onOpenChange={(open) => {
            if (!open) {
              setParticipantsDialogTeamId(null);
              setSelectedParticipants([]);
              setTransferTargetTeamId('');
            }
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle
                style={{
                  color:
                    participantsDialogTeam?.corPulseira ||
                    (participantsDialogTeam ? `hsl(var(--team-${participantsDialogTeam.cor}))` : undefined),
                }}
              >
                {participantsDialogTeam
                  ? `${participantsDialogTeam.nome} - Participantes`
                  : 'Participantes da equipe'}
              </DialogTitle>
              <DialogDescription>
                Exclua participantes da equipe (um a um ou em lote) e transfira selecionados para outra equipe.
              </DialogDescription>
            </DialogHeader>

            {!participantsDialogTeam ? (
              <p className="py-6 text-center text-muted-foreground">Selecione uma equipe para gerenciar.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleToggleAllParticipants}
                      disabled={participantsActionLoading || participantesDialogNumeros.length === 0}
                    />
                    <span className="text-sm">Selecionar todos</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selectedParticipants.length} selecionado(s)
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label>Transferir selecionados para</Label>
                    <Select
                      value={transferTargetTeamId}
                      onValueChange={setTransferTargetTeamId}
                    >
                      <SelectTrigger
                        disabled={participantsActionLoading || selectedParticipants.length === 0}
                      >
                        <SelectValue placeholder="Selecione a equipe de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipes
                          .filter((eq) => eq.id !== participantsDialogTeam.id)
                          .map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleTransferParticipants}
                      disabled={
                        participantsActionLoading ||
                        selectedParticipants.length === 0 ||
                        !transferTargetTeamId
                      }
                      className="gap-2"
                    >
                      {participantsActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-4 w-4" />
                      )}
                      Transferir
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          disabled={participantsActionLoading || selectedParticipants.length === 0}
                          className="gap-2"
                        >
                          {participantsActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Excluir Selecionados
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir participantes selecionados?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação vai remover {selectedParticipants.length} participante(s) da equipe{' '}
                            <strong>{participantsDialogTeam.nome}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveParticipants(selectedParticipants)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="space-y-2">
                  {participantesDialogList.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      Nenhum participante sorteado nesta equipe.
                    </p>
                  ) : (
                    participantesDialogList.map((inscrito) => (
                      <div
                        key={inscrito.numero}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <Checkbox
                          checked={selectedParticipants.includes(inscrito.numero)}
                          onCheckedChange={(checked) =>
                            handleToggleParticipant(inscrito.numero, checked)
                          }
                          disabled={participantsActionLoading}
                        />
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarImage src={inscrito.fotoUrl} alt={inscrito.nome} />
                          <AvatarFallback>
                            <User className="h-4 w-4 text-muted-foreground" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{inscrito.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            Num. {inscrito.numero} - {inscrito.igreja}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={participantsActionLoading}
                              title="Remover participante desta equipe"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir participante da equipe?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {inscrito.nome} (Num. {inscrito.numero}) será removido(a) da equipe{' '}
                                <strong>{participantsDialogTeam.nome}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveParticipants([inscrito.numero])}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Equipe</DialogTitle>
              <DialogDescription>Atualize os dados da equipe selecionada.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Equipe</Label>
                <Input
                  id="nome"
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-numero">Número da Equipe *</Label>
                <Input
                  id="edit-numero"
                  type="number"
                  min="1"
                  value={editForm.numero}
                  onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lider">Líder</Label>
                <Input
                  id="lider"
                  value={editForm.lider}
                  onChange={(e) => setEditForm({ ...editForm, lider: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vice">Vice-Líder</Label>
                <Input
                  id="vice"
                  value={editForm.vice}
                  onChange={(e) => setEditForm({ ...editForm, vice: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="corPulseira">Cor da Pulseira</Label>
                <div className="flex gap-2">
                  <Input
                    id="corPulseira"
                    type="color"
                    value={editForm.corPulseira || '#ff0000'}
                    onChange={(e) => setEditForm({ ...editForm, corPulseira: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    placeholder="#FF0000"
                    value={editForm.corPulseira}
                    onChange={(e) => setEditForm({ ...editForm, corPulseira: e.target.value })}
                    className="flex-1 font-mono"
                  />
                  {editForm.corPulseira && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditForm({ ...editForm, corPulseira: '' })}
                      type="button"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Deixe vazio para usar a cor padrão da equipe</p>
              </div>
              <div>
                <Label>Imagem/Logo da Equipe</Label>
                <div className="space-y-2">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                  {editForm.imagemUrl ? (
                    <div className="relative w-24 h-24 rounded-lg border border-border overflow-hidden">
                      <img 
                        src={editForm.imagemUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => e.currentTarget.src = '/placeholder.svg'}
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editFileInputRef.current?.click()}
                          disabled={uploadingEdit}
                        >
                          {uploadingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditForm({ ...editForm, imagemUrl: '' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-24 border-dashed flex flex-col gap-2"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={uploadingEdit}
                    >
                      {uploadingEdit ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6" />
                          <span className="text-sm">Clique para enviar imagem</span>
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Formatos: JPG, PNG, GIF. Máximo 5MB</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Equipes;
