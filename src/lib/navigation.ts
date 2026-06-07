export type PrimaryNavId = "dashboard" | "team" | "legs" | "races" | "search" | "photos" | "profile";

const nestedRouteParents: Record<string, PrimaryNavId> = {
  runners: "team",
  runs: "team",
  "historical-results-search": "search",
};

const directRouteIds = new Set<PrimaryNavId>([
  "dashboard",
  "team",
  "legs",
  "races",
  "search",
  "photos",
  "profile",
]);

export const getActiveNavId = (pathname: string): PrimaryNavId => {
  const firstSegment = pathname.replace(/^\/+/, "").split("/")[0] || "";

  if (!firstSegment || firstSegment === "dashboard") {
    return "dashboard";
  }

  if (firstSegment in nestedRouteParents) {
    return nestedRouteParents[firstSegment];
  }

  if (directRouteIds.has(firstSegment as PrimaryNavId)) {
    return firstSegment as PrimaryNavId;
  }

  return "dashboard";
};
