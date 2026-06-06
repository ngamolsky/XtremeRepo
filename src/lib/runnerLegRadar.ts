type LegDefinitionLike = {
  number: number | null;
  version: number | null;
};

type RunnerResultLike = {
  leg_number: number | null;
  leg_version: number | null;
};

export type LegRadarSelection = number | "all";

export type LatestLegRadarDatum = {
  leg: string;
  legNumber: number;
  count: number;
};

export type LatestLegRadarData = {
  version: LegRadarSelection | null;
  maxCount: number;
  data: LatestLegRadarDatum[];
};

export type LegRadarVersionOption = {
  label: string;
  value: LegRadarSelection;
};

export type RadarPoint = {
  x: number;
  y: number;
};

const isFiniteNumber = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value);

const latestVersionFromLegDefinitions = (legDefinitions: LegDefinitionLike[]) => {
  const versions = legDefinitions
    .map((definition) => definition.version)
    .filter(isFiniteNumber);

  return versions.length > 0 ? Math.max(...versions) : null;
};

const latestVersionFromResults = (results: RunnerResultLike[]) => {
  const versions = results
    .map((result) => result.leg_version)
    .filter(isFiniteNumber);

  return versions.length > 0 ? Math.max(...versions) : null;
};

const latestAvailableVersion = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[]
) => latestVersionFromLegDefinitions(legDefinitions) ?? latestVersionFromResults(results);

const versionNumbers = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[]
) =>
  [...new Set([
    ...legDefinitions.map((definition) => definition.version).filter(isFiniteNumber),
    ...results.map((result) => result.leg_version).filter(isFiniteNumber),
  ])].sort((a, b) => b - a);

export const buildLegRadarVersionOptions = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[]
): LegRadarVersionOption[] => [
  { label: "All versions", value: "all" },
  ...versionNumbers(results, legDefinitions).map((version) => ({
    label: `v${version}`,
    value: version,
  })),
];

const legNumbersForSelection = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[],
  selection: LegRadarSelection
) => {
  const fromDefinitions = legDefinitions
    .filter((definition) => selection === "all" || definition.version === selection)
    .map((definition) => definition.number)
    .filter(isFiniteNumber);
  const legNumbers = new Set(fromDefinitions);

  if (legNumbers.size === 0) {
    results
      .filter((result) => selection === "all" || result.leg_version === selection)
      .map((result) => result.leg_number)
      .filter(isFiniteNumber)
      .forEach((legNumber) => legNumbers.add(legNumber));
  }

  return legNumbers;
};

export const buildLegRadarData = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[],
  selection: LegRadarSelection
): LatestLegRadarData => {
  const legNumbers = legNumbersForSelection(results, legDefinitions, selection);

  if (legNumbers.size === 0) {
    return { version: selection, maxCount: 0, data: [] };
  }

  const counts = new Map<number, number>();
  results.forEach((result) => {
    if (
      (selection === "all" && !isFiniteNumber(result.leg_version)) ||
      (selection !== "all" && result.leg_version !== selection) ||
      !isFiniteNumber(result.leg_number) ||
      !legNumbers.has(result.leg_number)
    ) {
      return;
    }

    counts.set(result.leg_number, (counts.get(result.leg_number) ?? 0) + 1);
  });

  const data = [...legNumbers]
    .sort((a, b) => a - b)
    .map((legNumber) => ({
      leg: `Leg ${legNumber}`,
      legNumber,
      count: counts.get(legNumber) ?? 0,
    }));

  return {
    version: selection,
    maxCount: data.reduce((max, datum) => Math.max(max, datum.count), 0),
    data,
  };
};

export const buildLatestLegRadarData = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[]
): LatestLegRadarData => {
  const latestVersion = latestAvailableVersion(results, legDefinitions);

  if (latestVersion === null) {
    return { version: null, maxCount: 0, data: [] };
  }

  return buildLegRadarData(results, legDefinitions, latestVersion);
};

export const radarPointForIndex = (
  index: number,
  total: number,
  radiusRatio: number,
  centerX: number,
  centerY: number,
  radius: number
): RadarPoint => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    x: centerX + Math.cos(angle) * radius * radiusRatio,
    y: centerY + Math.sin(angle) * radius * radiusRatio,
  };
};

export const formatRadarPoints = (points: RadarPoint[]) =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
