export type PrimaryNavId = "races" | "legs" | "runners" | "photos" | "search" | "profile";

const nestedRouteParents: Record<string, PrimaryNavId> = {
  dashboard: "races",
  history: "races",
  runners: "runners",
  runs: "races",
  team: "runners",
  "historical-results-search": "search",
};

const directRouteIds = new Set<PrimaryNavId>([
  "races",
  "legs",
  "runners",
  "photos",
  "search",
  "profile",
]);

export const getActiveNavId = (pathname: string): PrimaryNavId => {
  const firstSegment = pathname.replace(/^\/+/, "").split("/")[0] || "";

  if (!firstSegment) {
    return "races";
  }

  if (firstSegment in nestedRouteParents) {
    return nestedRouteParents[firstSegment];
  }

  if (directRouteIds.has(firstSegment as PrimaryNavId)) {
    return firstSegment as PrimaryNavId;
  }

  return "races";
};
