type RaceSummaryInput = {
  year: number | null;
  total_time: string | null;
  race_version?: number | null;
};

type TimedRaceSummary = {
  year: number;
  time: string;
};

export type RacesTopSummary = {
  yearsRan: number;
  latestRaceWithTime: TimedRaceSummary | null;
  currentRaceVersion: number | null;
  bestCurrentCourseTime: TimedRaceSummary | null;
};

export function getRacesTopSummary(races: RaceSummaryInput[]): RacesTopSummary {
  const raceYears = races.filter((race) => typeof race.year === "number");
  const currentRaceVersion = getCurrentRaceVersion(raceYears);
  const timedRaces = raceYears.flatMap((race) => {
    if (!race.total_time || typeof race.year !== "number") {
      return [];
    }

    return [{ year: race.year, time: race.total_time, raceVersion: race.race_version ?? 1 }];
  });
  const latestRaceWithTime = timedRaces.reduce<TimedRaceSummary | null>(
    (latest, race) =>
      latest === null || race.year > latest.year
        ? { year: race.year, time: race.time }
        : latest,
    null
  );
  const currentCourseTimedRaces = timedRaces.filter(
    (race) => currentRaceVersion !== null && race.raceVersion === currentRaceVersion
  );
  const bestCurrentCourseTime = currentCourseTimedRaces.reduce<TimedRaceSummary | null>(
    (best, race) =>
      best === null || compareRaceTimes(race.time, best.time) < 0
        ? { year: race.year, time: race.time }
        : best,
    null
  );

  return {
    yearsRan: raceYears.length,
    latestRaceWithTime,
    currentRaceVersion,
    bestCurrentCourseTime,
  };
}

function getCurrentRaceVersion(races: RaceSummaryInput[]) {
  const versions = races
    .map((race) => race.race_version ?? 1)
    .filter((version): version is number => Number.isFinite(version));

  return versions.length > 0 ? Math.max(...versions) : null;
}

function compareRaceTimes(left: string, right: string) {
  return parseRaceTimeSeconds(left) - parseRaceTimeSeconds(right);
}

function parseRaceTimeSeconds(time: string) {
  const parts = time
    .replace(/^\d+ days?\s*/i, "")
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part))) {
    return Number.POSITIVE_INFINITY;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return Number.POSITIVE_INFINITY;
}
