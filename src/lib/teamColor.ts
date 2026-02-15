import type { Equipe } from '@/types';

type TeamColorSource =
  | Pick<Equipe, 'cor' | 'corPulseira'>
  | { cor?: number | null; corPulseira?: string | null }
  | null
  | undefined;

const DEFAULT_TEAM_COLOR = '#22c55e';

export function getTeamColor(team: TeamColorSource, fallback = DEFAULT_TEAM_COLOR): string {
  const customColor = team?.corPulseira?.trim();
  if (customColor) {
    return customColor;
  }

  if (typeof team?.cor === 'number' && Number.isFinite(team.cor)) {
    return `hsl(var(--team-${team.cor}))`;
  }

  return fallback;
}

export function getTeamColorAlpha(
  team: TeamColorSource,
  alpha = 0.2,
  fallback = DEFAULT_TEAM_COLOR,
): string {
  const color = getTeamColor(team, fallback);
  const percent = Math.round(Math.min(1, Math.max(0, alpha)) * 100);
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
