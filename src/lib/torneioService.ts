// Serviço para gerenciamento de torneios eliminatórios
import { supabase } from '@/integrations/supabase/client';
import type { Torneio, Confronto, FaseConfronto, ResultadoTorneio } from '@/types/torneio';

// ============== TORNEIOS ==============

export async function getAllTorneios(): Promise<Torneio[]> {
  const { data, error } = await supabase
    .from('torneios')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []) as Torneio[];
}

export async function getTorneio(id: string): Promise<Torneio | null> {
  const { data, error } = await supabase
    .from('torneios')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data as Torneio | null;
}

export async function getTorneiosByGincana(gincanaId: string): Promise<Torneio[]> {
  const { data, error } = await supabase
    .from('torneios')
    .select('*')
    .eq('gincana_id', gincanaId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []) as Torneio[];
}

export async function createTorneio(torneio: Omit<Torneio, 'id' | 'created_at' | 'updated_at'>): Promise<Torneio> {
  const { data, error } = await supabase
    .from('torneios')
    .insert(torneio)
    .select()
    .single();
  
  if (error) throw error;
  return data as Torneio;
}

export async function updateTorneio(id: string, updates: Partial<Torneio>): Promise<Torneio> {
  const { data, error } = await supabase
    .from('torneios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Torneio;
}

export async function deleteTorneio(id: string): Promise<void> {
  const { error } = await supabase
    .from('torneios')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============== CONFRONTOS ==============

export async function getConfrontosByTorneio(torneioId: string): Promise<Confronto[]> {
  const { data, error } = await supabase
    .from('confrontos')
    .select('*')
    .eq('torneio_id', torneioId)
    .order('fase')
    .order('ordem');
  
  if (error) throw error;
  return (data || []) as Confronto[];
}

export async function createConfronto(confronto: Omit<Confronto, 'id' | 'created_at' | 'updated_at'>): Promise<Confronto> {
  const { data, error } = await supabase
    .from('confrontos')
    .insert(confronto)
    .select()
    .single();
  
  if (error) throw error;
  return data as Confronto;
}

export async function updateConfronto(id: string, updates: Partial<Confronto>): Promise<Confronto> {
  const { data, error } = await supabase
    .from('confrontos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Confronto;
}

export async function deleteConfrontosByTorneio(torneioId: string): Promise<void> {
  const { error } = await supabase
    .from('confrontos')
    .delete()
    .eq('torneio_id', torneioId);
  
  if (error) throw error;
}

// ============== SORTEIO ==============

// Embaralhar array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function getConfrontosAnteriores(torneioId: string): Promise<Array<{ equipe1_id: string | null; equipe2_id: string | null }>> {
  try {
    const { data, error } = await supabase
      .from('confrontos')
      .select('equipe1_id,equipe2_id')
      .neq('torneio_id', torneioId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Erro ao carregar confrontos anteriores:', error);
    return [];
  }
}

function buildMatchupMap(confrontos: Array<{ equipe1_id: string | null; equipe2_id: string | null }>) {
  const map = new Map<string, Set<string>>();
  const addPair = (a: string, b: string) => {
    const set = map.get(a) || new Set<string>();
    set.add(b);
    map.set(a, set);
  };

  for (const c of confrontos) {
    if (c.equipe1_id && c.equipe2_id) {
      addPair(c.equipe1_id, c.equipe2_id);
      addPair(c.equipe2_id, c.equipe1_id);
    }
  }

  return map;
}

// Iniciar sorteio passo a passo - cria a estrutura vazia
export async function iniciarSorteioPasso(torneioId: string): Promise<Confronto[]> {
  // Limpar confrontos existentes
  await deleteConfrontosByTorneio(torneioId);
  
  // Criar todos os confrontos vazios
  const todosConfrontos: Omit<Confronto, 'id' | 'created_at' | 'updated_at'>[] = [
    // Quartas de final (4 jogos)
    { torneio_id: torneioId, fase: 'quartas', ordem: 1, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 2, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 3, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 4, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    // Semifinais (2 jogos)
    { torneio_id: torneioId, fase: 'semifinal', ordem: 1, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    { torneio_id: torneioId, fase: 'semifinal', ordem: 2, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    // Terceiro lugar
    { torneio_id: torneioId, fase: 'terceiro_lugar', ordem: 1, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    // Final
    { torneio_id: torneioId, fase: 'final', ordem: 1, equipe1_id: null, equipe2_id: null, vencedor_id: null },
  ];
  
  const { data, error } = await supabase
    .from('confrontos')
    .insert(todosConfrontos)
    .select();
  
  if (error) throw error;
  
  // Atualizar status do torneio
  await updateTorneio(torneioId, { status: 'em_andamento' });
  
  return (data || []) as Confronto[];
}

// Sortear próximo confronto - sorteia uma equipe para a próxima posição vazia
export async function sortearProximaEquipe(
  torneioId: string,
  confrontos: Confronto[],
  equipesIds: string[]
): Promise<{ confronto: Confronto; equipeId: string } | null> {
  // Encontrar equipes já sorteadas nas quartas
  const quartas = confrontos.filter(c => c.fase === 'quartas').sort((a, b) => a.ordem - b.ordem);
  const equipesJaSorteadas = new Set<string>();
  
  quartas.forEach(c => {
    if (c.equipe1_id) equipesJaSorteadas.add(c.equipe1_id);
    if (c.equipe2_id) equipesJaSorteadas.add(c.equipe2_id);
  });
  
  // Encontrar equipes disponíveis
  const equipesDisponiveis = equipesIds.filter(id => !equipesJaSorteadas.has(id));
  
  if (equipesDisponiveis.length === 0) {
    return null; // Sorteio completo
  }
  
  // Encontrar próxima posição vazia
  let confrontoAlvo: Confronto | null = null;
  let posicao: 'equipe1' | 'equipe2' | null = null;
  
  for (const c of quartas) {
    if (!c.equipe1_id) {
      confrontoAlvo = c;
      posicao = 'equipe1';
      break;
    }
    if (!c.equipe2_id) {
      confrontoAlvo = c;
      posicao = 'equipe2';
      break;
    }
  }
  
  if (!confrontoAlvo || !posicao) {
    return null; // Todas as posições preenchidas
  }
  
  // Sortear aleatoriamente uma equipe disponível
  let pool = equipesDisponiveis;

  if (posicao === 'equipe2' && confrontoAlvo.equipe1_id) {
    const confrontosAnteriores = await getConfrontosAnteriores(torneioId);
    const matchupMap = buildMatchupMap(confrontosAnteriores);
    const jaConfrontou = matchupMap.get(confrontoAlvo.equipe1_id) || new Set<string>();
    const semRepetir = equipesDisponiveis.filter(id => !jaConfrontou.has(id));
    if (semRepetir.length > 0) {
      pool = semRepetir;
    }
  }

  const equipeSorteada = pool[Math.floor(Math.random() * pool.length)];
  
  // Atualizar o confronto
  const updates = posicao === 'equipe1' 
    ? { equipe1_id: equipeSorteada }
    : { equipe2_id: equipeSorteada };
    
  const confrontoAtualizado = await updateConfronto(confrontoAlvo.id, updates);
  
  return { confronto: confrontoAtualizado, equipeId: equipeSorteada };
}

// Verificar se o sorteio das quartas está completo
export function isSorteioQuartasCompleto(confrontos: Confronto[]): boolean {
  const quartas = confrontos.filter(c => c.fase === 'quartas');
  return quartas.every(c => c.equipe1_id && c.equipe2_id);
}

// Obter próximo número do sorteio (1-8)
export function getProximoNumeroSorteio(confrontos: Confronto[]): number {
  const quartas = confrontos.filter(c => c.fase === 'quartas').sort((a, b) => a.ordem - b.ordem);
  let count = 0;
  
  for (const c of quartas) {
    if (c.equipe1_id) count++;
    if (c.equipe2_id) count++;
  }
  
  return count + 1;
}

// Sortear confrontos iniciais para 8 equipes (modo automático/legado)
export async function sortearConfrontos(torneioId: string, equipesIds: string[]): Promise<Confronto[]> {
  if (equipesIds.length !== 8) {
    throw new Error('O sorteio requer exatamente 8 equipes');
  }
  
  // Limpar confrontos existentes
  await deleteConfrontosByTorneio(torneioId);
  
  // Embaralhar equipes e evitar confrontos repetidos
  const confrontosAnteriores = await getConfrontosAnteriores(torneioId);
  const matchupMap = buildMatchupMap(confrontosAnteriores);
  const embaralhadas = shuffleArray(equipesIds);
  const restantes = [...embaralhadas];
  const pares: Array<[string, string]> = [];

  while (restantes.length >= 2) {
    const equipeA = restantes.shift() as string;
    let idx = restantes.findIndex(equipeB => !matchupMap.get(equipeA)?.has(equipeB));
    if (idx === -1) {
      idx = 0; // sem alternativas, aceita repetição
    }
    const equipeB = restantes.splice(idx, 1)[0];
    pares.push([equipeA, equipeB]);
  }
  
  // Criar confrontos das quartas de final (4 jogos)
  const confrontosQuartas: Omit<Confronto, 'id' | 'created_at' | 'updated_at'>[] = [
    { torneio_id: torneioId, fase: 'quartas', ordem: 1, equipe1_id: pares[0][0], equipe2_id: pares[0][1], vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 2, equipe1_id: pares[1][0], equipe2_id: pares[1][1], vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 3, equipe1_id: pares[2][0], equipe2_id: pares[2][1], vencedor_id: null },
    { torneio_id: torneioId, fase: 'quartas', ordem: 4, equipe1_id: pares[3][0], equipe2_id: pares[3][1], vencedor_id: null },
  ];
  
  // Criar confrontos da semifinal (vazios, serão preenchidos após quartas)
  const confrontosSemifinal: Omit<Confronto, 'id' | 'created_at' | 'updated_at'>[] = [
    { torneio_id: torneioId, fase: 'semifinal', ordem: 1, equipe1_id: null, equipe2_id: null, vencedor_id: null },
    { torneio_id: torneioId, fase: 'semifinal', ordem: 2, equipe1_id: null, equipe2_id: null, vencedor_id: null },
  ];
  
  // Criar confronto de 3º lugar (vazio)
  const confrontoTerceiroLugar: Omit<Confronto, 'id' | 'created_at' | 'updated_at'> = {
    torneio_id: torneioId,
    fase: 'terceiro_lugar',
    ordem: 1,
    equipe1_id: null,
    equipe2_id: null,
    vencedor_id: null,
  };
  
  // Criar confronto da final (vazio)
  const confrontoFinal: Omit<Confronto, 'id' | 'created_at' | 'updated_at'> = {
    torneio_id: torneioId,
    fase: 'final',
    ordem: 1,
    equipe1_id: null,
    equipe2_id: null,
    vencedor_id: null,
  };
  
  // Inserir todos os confrontos
  const todosConfrontos = [
    ...confrontosQuartas,
    ...confrontosSemifinal,
    confrontoTerceiroLugar,
    confrontoFinal,
  ];
  
  const { data, error } = await supabase
    .from('confrontos')
    .insert(todosConfrontos)
    .select();
  
  if (error) throw error;
  
  // Atualizar status do torneio
  await updateTorneio(torneioId, { status: 'em_andamento' });
  
  return (data || []) as Confronto[];
}

// ============== PROGRESSÃO ==============

// Registrar vencedor e atualizar próxima fase
export async function registrarVencedor(
  confrontoId: string, 
  vencedorId: string,
  confrontos: Confronto[]
): Promise<void> {
  // Atualizar o confronto com o vencedor
  const confrontoAtual = confrontos.find(c => c.id === confrontoId);
  if (!confrontoAtual) throw new Error('Confronto não encontrado');
  
  await updateConfronto(confrontoId, { vencedor_id: vencedorId });
  
  // Determinar perdedor
  const perdedorId = confrontoAtual.equipe1_id === vencedorId 
    ? confrontoAtual.equipe2_id 
    : confrontoAtual.equipe1_id;
  
  // Atualizar próxima fase baseado na fase atual
  if (confrontoAtual.fase === 'quartas') {
    // Vencedores das quartas vão para semifinal
    const semifinais = confrontos.filter(c => c.fase === 'semifinal').sort((a, b) => a.ordem - b.ordem);
    
    if (confrontoAtual.ordem <= 2) {
      // Confrontos 1 e 2 alimentam semifinal 1
      const semi1 = semifinais[0];
      if (semi1) {
        if (confrontoAtual.ordem === 1) {
          await updateConfronto(semi1.id, { equipe1_id: vencedorId });
        } else {
          await updateConfronto(semi1.id, { equipe2_id: vencedorId });
        }
      }
    } else {
      // Confrontos 3 e 4 alimentam semifinal 2
      const semi2 = semifinais[1];
      if (semi2) {
        if (confrontoAtual.ordem === 3) {
          await updateConfronto(semi2.id, { equipe1_id: vencedorId });
        } else {
          await updateConfronto(semi2.id, { equipe2_id: vencedorId });
        }
      }
    }
  } else if (confrontoAtual.fase === 'semifinal') {
    // Vencedor vai para final, perdedor vai para disputa de 3º
    const final = confrontos.find(c => c.fase === 'final');
    const terceiro = confrontos.find(c => c.fase === 'terceiro_lugar');
    
    if (final) {
      if (confrontoAtual.ordem === 1) {
        await updateConfronto(final.id, { equipe1_id: vencedorId });
      } else {
        await updateConfronto(final.id, { equipe2_id: vencedorId });
      }
    }
    
    if (terceiro && perdedorId) {
      if (confrontoAtual.ordem === 1) {
        await updateConfronto(terceiro.id, { equipe1_id: perdedorId });
      } else {
        await updateConfronto(terceiro.id, { equipe2_id: perdedorId });
      }
    }
  }
}

// ============== RESULTADOS ==============

// Obter resultado final do torneio
export function calcularResultado(confrontos: Confronto[]): ResultadoTorneio {
  const final = confrontos.find(c => c.fase === 'final');
  const terceiro = confrontos.find(c => c.fase === 'terceiro_lugar');
  
  let primeiro: string | null = null;
  let segundo: string | null = null;
  let terceiroPosto: string | null = null;
  let quarto: string | null = null;
  
  if (final?.vencedor_id) {
    primeiro = final.vencedor_id;
    segundo = final.equipe1_id === final.vencedor_id ? final.equipe2_id : final.equipe1_id;
  }
  
  if (terceiro?.vencedor_id) {
    terceiroPosto = terceiro.vencedor_id;
    quarto = terceiro.equipe1_id === terceiro.vencedor_id ? terceiro.equipe2_id : terceiro.equipe1_id;
  }
  
  return {
    primeiro,
    segundo,
    terceiro: terceiroPosto,
    quarto,
  };
}

// Verificar se torneio está finalizado
export function isTorneioFinalizado(confrontos: Confronto[]): boolean {
  const final = confrontos.find(c => c.fase === 'final');
  const terceiro = confrontos.find(c => c.fase === 'terceiro_lugar');
  
  return !!(final?.vencedor_id && terceiro?.vencedor_id);
}

// ============== REALTIME ==============

export function subscribeTorneioUpdates(
  torneioId: string,
  onUpdate: (confrontos: Confronto[]) => void
) {
  const channel = supabase
    .channel(`torneio-${torneioId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'confrontos',
        filter: `torneio_id=eq.${torneioId}`,
      },
      async () => {
        // Recarregar todos os confrontos quando houver mudança
        const confrontos = await getConfrontosByTorneio(torneioId);
        onUpdate(confrontos);
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}
