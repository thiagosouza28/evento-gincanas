export type IntegrationRouteMatch =
  | {
      matched: false;
    }
  | {
      matched: true;
      id: string | null;
      activate: boolean;
    };

export function matchIntegrationRoute(pathname: string): IntegrationRouteMatch {
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  const index = segments.lastIndexOf("integrations");
  if (index < 0) {
    return { matched: false };
  }

  const remaining = segments.slice(index + 1);
  if (remaining.length === 0) {
    return {
      matched: true,
      id: null,
      activate: false,
    };
  }

  if (remaining.length === 1) {
    return {
      matched: true,
      id: remaining[0],
      activate: false,
    };
  }

  if (remaining.length === 2 && remaining[1] === "activate") {
    return {
      matched: true,
      id: remaining[0],
      activate: true,
    };
  }

  return { matched: false };
}
