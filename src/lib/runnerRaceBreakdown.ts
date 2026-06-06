import type { Tables } from "../types/database.types";

type OfficialResult = Tables<"v_results_with_pace">;
type SelfRecordedObservation = Tables<"v_leg_result_observations_with_pace">;

export type RunnerRaceEntry = {
  assumedMetrics: {
    pace: boolean;
    distance: boolean;
    elevationGain: boolean;
  };
  distance: number | null;
  elevationGain: number | null;
  key: string;
  label: string;
  legNumber: number | null;
  legVersion: number | null;
  pace: number | null;
  sourceLabel: string | null;
  sourceTags: string[];
  sourceType: string | null;
  time: string | null;
  timeLabel: string;
};

export type RunnerRaceBreakdown = {
  official: RunnerRaceEntry[];
  provisional: RunnerRaceEntry[];
  year: number;
};

export function buildRunnerRaceBreakdown(
  runnerName: string,
  officialResults: OfficialResult[],
  observations: SelfRecordedObservation[]
): RunnerRaceBreakdown[] {
  const officialByYear = new Map<number, RunnerRaceEntry[]>();
  const provisionalByYear = new Map<number, RunnerRaceEntry[]>();
  const years = new Set<number>();

  officialResults.forEach((result) => {
    if (result.runner_name !== runnerName || typeof result.year !== "number") {
      return;
    }

    const yearEntries = officialByYear.get(result.year) ?? [];
    yearEntries.push(toOfficialEntry(result));
    officialByYear.set(result.year, yearEntries);
    years.add(result.year);
  });

  observations.forEach((observation) => {
    if (
      observation.runner_name !== runnerName ||
      typeof observation.year !== "number" ||
      !hasSelfRecordedData(observation)
    ) {
      return;
    }

    const yearEntries = provisionalByYear.get(observation.year) ?? [];
    yearEntries.push(toProvisionalEntry(observation));
    provisionalByYear.set(observation.year, yearEntries);
    years.add(observation.year);
  });

  return Array.from(years)
    .sort((a, b) => b - a)
    .map((year) => ({
      official: (officialByYear.get(year) ?? []).sort(sortEntries),
      provisional: (provisionalByYear.get(year) ?? []).sort(sortEntries),
      year,
    }));
}

function toOfficialEntry(result: OfficialResult): RunnerRaceEntry {
  return {
    assumedMetrics: {
      pace: false,
      distance: false,
      elevationGain: false,
    },
    distance: result.distance,
    elevationGain: result.elevation_gain,
    key: `official-${result.year}-${result.leg_number}-${result.leg_version}`,
    label: formatLegLabel(result.leg_number, result.leg_version),
    legNumber: result.leg_number,
    legVersion: result.leg_version,
    pace: result.pace,
    sourceLabel: null,
    sourceTags: [],
    sourceType: result.source_type ?? "official",
    time: result.lap_time,
    timeLabel: "Lap",
  };
}

function toProvisionalEntry(observation: SelfRecordedObservation): RunnerRaceEntry {
  const time =
    observation.primary_time ??
    observation.lap_time ??
    observation.elapsed_time ??
    observation.moving_time;
  const distance = observation.observed_distance ?? observation.display_distance ?? observation.canonical_distance;
  const elevationGain =
    observation.observed_elevation_gain ??
    observation.display_elevation_gain ??
    observation.canonical_elevation_gain;
  const pace =
    observation.observed_distance && observation.pace
      ? observation.pace
      : getAssumedPace(time, distance);

  return {
    assumedMetrics: {
      pace: !observation.observed_distance && pace !== null,
      distance: observation.observed_distance === null && distance !== null,
      elevationGain: observation.observed_elevation_gain === null && elevationGain !== null,
    },
    distance,
    elevationGain,
    key: `provisional-${observation.id ?? `${observation.year}-${observation.leg_number}-${observation.leg_version}`}`,
    label: formatLegLabel(observation.leg_number, observation.leg_version),
    legNumber: observation.leg_number,
    legVersion: observation.leg_version,
    pace,
    sourceLabel: observation.source_label,
    sourceTags: observation.source_tags ?? [],
    sourceType: observation.source_type,
    time,
    timeLabel: formatObservationTimeLabel(observation.primary_time_type),
  };
}

function formatLegLabel(legNumber: number | null, legVersion: number | null) {
  if (legNumber === null) {
    return "Unknown leg";
  }

  return legVersion === null ? `Leg ${legNumber}` : `Leg ${legNumber} (v${legVersion})`;
}

function hasSelfRecordedData(observation: SelfRecordedObservation) {
  return Boolean(
    observation.primary_time ||
      observation.lap_time ||
      observation.elapsed_time ||
      observation.moving_time ||
      observation.observed_distance ||
      observation.observed_elevation_gain ||
      observation.source_label ||
      (observation.source_tags && observation.source_tags.length > 0)
  );
}

function getAssumedPace(time: string | null | undefined, distance: number | null | undefined) {
  if (!time || !distance || distance <= 0) {
    return null;
  }

  const minutes = parseTimeToMinutes(time);
  return minutes > 0 ? minutes / distance : null;
}

function parseTimeToMinutes(time: string) {
  const parts = time.split(":").map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }

  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }

  return 0;
}

function formatObservationTimeLabel(timeType: string | null | undefined) {
  if (timeType === "moving_time") {
    return "Moving";
  }
  if (timeType === "elapsed_time") {
    return "Elapsed";
  }
  return "Lap";
}

function sortEntries(a: RunnerRaceEntry, b: RunnerRaceEntry) {
  return (
    (a.legNumber ?? Number.MAX_SAFE_INTEGER) -
      (b.legNumber ?? Number.MAX_SAFE_INTEGER) ||
    (a.legVersion ?? 0) - (b.legVersion ?? 0)
  );
}
