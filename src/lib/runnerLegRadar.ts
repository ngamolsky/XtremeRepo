type LegDefinitionLike = {
  number: number | null;
  version: number | null;
};

type RunnerResultLike = {
  leg_number: number | null;
  leg_version: number | null;
};

export type LatestLegRadarDatum = {
  leg: string;
  legNumber: number;
  count: number;
};

export type LatestLegRadarData = {
  version: number | null;
  maxCount: number;
  data: LatestLegRadarDatum[];
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

export const buildLatestLegRadarData = (
  results: RunnerResultLike[],
  legDefinitions: LegDefinitionLike[]
): LatestLegRadarData => {
  const latestVersion =
    latestVersionFromLegDefinitions(legDefinitions) ?? latestVersionFromResults(results);

  if (latestVersion === null) {
    return { version: null, maxCount: 0, data: [] };
  }

  const latestLegNumbers = new Set(
    legDefinitions
      .filter((definition) => definition.version === latestVersion)
      .map((definition) => definition.number)
      .filter(isFiniteNumber)
  );

  if (latestLegNumbers.size === 0) {
    results
      .filter((result) => result.leg_version === latestVersion)
      .map((result) => result.leg_number)
      .filter(isFiniteNumber)
      .forEach((legNumber) => latestLegNumbers.add(legNumber));
  }

  const counts = new Map<number, number>();
  results.forEach((result) => {
    if (
      result.leg_version !== latestVersion ||
      !isFiniteNumber(result.leg_number) ||
      !latestLegNumbers.has(result.leg_number)
    ) {
      return;
    }

    counts.set(result.leg_number, (counts.get(result.leg_number) ?? 0) + 1);
  });

  const data = [...latestLegNumbers]
    .sort((a, b) => a - b)
    .map((legNumber) => ({
      leg: `Leg ${legNumber}`,
      legNumber,
      count: counts.get(legNumber) ?? 0,
    }));

  return {
    version: latestVersion,
    maxCount: data.reduce((max, datum) => Math.max(max, datum.count), 0),
    data,
  };
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
