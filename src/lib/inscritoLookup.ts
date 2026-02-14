import type { Inscrito } from '@/types';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type InscritoLookupResult = {
  inscrito?: Inscrito;
  error?: string;
};

export function findInscritoByNumeroOuNome(
  inscritos: Map<number, Inscrito>,
  rawQuery: string,
): InscritoLookupResult {
  const query = rawQuery.trim();
  if (!query) {
    return { error: 'Digite o n\u00famero ou nome do inscrito.' };
  }

  if (/^\d+$/.test(query)) {
    const numero = Number(query);
    const inscrito = inscritos.get(numero);
    if (inscrito) {
      return { inscrito };
    }
    return { error: 'Inscrito n\u00e3o encontrado.' };
  }

  const normalizedQuery = normalizeText(query);
  const inscritosList = Array.from(inscritos.values());

  const exactMatches = inscritosList.filter((i) => normalizeText(i.nome) === normalizedQuery);
  if (exactMatches.length === 1) {
    return { inscrito: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { error: 'Mais de um inscrito encontrado com este nome. Digite o n\u00famero.' };
  }

  const partialMatches = inscritosList.filter((i) => normalizeText(i.nome).includes(normalizedQuery));
  if (partialMatches.length === 1) {
    return { inscrito: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { error: 'Mais de um inscrito encontrado com este nome. Digite o n\u00famero.' };
  }

  return { error: 'Inscrito n\u00e3o encontrado.' };
}
