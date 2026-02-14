import type { Inscrito } from '@/types';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function tokenizeName(value: string): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenizeQuery(value: string): string[] {
  return tokenizeName(value).filter((token) => !STOPWORDS.has(token));
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

  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) {
    return { error: 'Digite o n\u00famero ou nome do inscrito.' };
  }

  const partialMatches = inscritosList.filter((i) => {
    const normalizedName = normalizeText(i.nome);
    if (normalizedName.includes(normalizedQuery)) {
      return true;
    }

    const nameTokens = tokenizeName(i.nome);
    return queryTokens.every((queryToken) =>
      nameTokens.some((nameToken) => nameToken.startsWith(queryToken)),
    );
  });

  if (partialMatches.length === 1) {
    return { inscrito: partialMatches[0] };
  }
  if (partialMatches.length > 1) {
    return { error: 'Mais de um inscrito encontrado. Digite mais nome/sobrenome ou o n\u00famero.' };
  }

  return { error: 'Inscrito n\u00e3o encontrado.' };
}
