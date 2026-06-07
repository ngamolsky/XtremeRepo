import { getGradeAdjustedPace } from "./gradeAdjustedPace";
import type { Tables } from "../types/database.types";

type OfficialResult = Tables<"v_results_with_pace">;
type SelfRecordedObservation = Tables<"v_leg_result_observations_with_pace">;
type YearlySummary = Tables<"v_yearly_summary">;
type LegDefinition = Tables<"leg_definitions">;

const EXPECTED_RELAY_LEGS = 7;

export type DisplayLegResult = {
  kind: "official" | "self_recorded";
  key: string;
  leg_number: number | null;
  leg_version: number | null;
  runner_name: string | null;
  runner_id: string | null;
  lap_time: string | null;
  pace: number | null;
  gradeAdjustedPace: number | null;
  distance: number | null;
  elevation_gain: number | null;
  assumed_metrics: {
    pace: boolean;
    distance: boolean;
    elevationGain: boolean;
  };
  source_type: string | null;
  source_label: string | null;
  officialResult?: OfficialResult;
  observation?: SelfRecordedObservation;
};

export type RaceResultStatus = {
  tone: "official" | "partial" | "pending";
  label: string;
  description: string;
};

export type LiveProjectionLeg = {
  legNumber: number;
  legVersion: number | null;
  minutes: number | null;
  displayTime: string;
  status: "reported" | "estimated" | "missing_estimate";
  sourceLabel: string;
};

export type LiveProjection = {
  reportedLegCount: number;
  estimatedLegCount: number;
  currentRecordedMinutes: number;
  projectedTotalMinutes: number | null;
  displayCurrentRecordedTime: string;
  displayProjectedTotalTime: string;
  legs: LiveProjectionLeg[];
};

export function getDisplayLegResults(
  year: number,
  officialResults: OfficialResult[],
  observations: SelfRecordedObservation[]
): DisplayLegResult[] {
  const officialLegs = officialResults.filter((result) => result.year === year);
  const officialLegNumbers = new Set(
    officialLegs
      .map((result) => result.leg_number)
      .filter((legNumber): legNumber is number => legNumber !== null)
  );
  const latestObservationByLeg = new Map<number, SelfRecordedObservation>();

  observations.forEach((observation) => {
    if (
      observation.year !== year ||
      observation.leg_number === null ||
      officialLegNumbers.has(observation.leg_number) ||
      !hasSelfRecordedData(observation)
    ) {
      return;
    }

    const current = latestObservationByLeg.get(observation.leg_number);
    if (
      !current ||
      getObservationTimestamp(observation) > getObservationTimestamp(current)
    ) {
      latestObservationByLeg.set(observation.leg_number, observation);
    }
  });

  return [
    ...officialLegs.map(toOfficialDisplayLeg),
    ...Array.from(latestObservationByLeg.values()).map(toSelfRecordedDisplayLeg),
  ].sort(sortDisplayLegs);
}

export function getRaceDisplaySummary(
  race: YearlySummary,
  displayLegResults: DisplayLegResult[]
) {
  const officialResultCount = displayLegResults.filter(
    (leg) => leg.kind === "official"
  ).length;
  const selfRecordedResultCount = displayLegResults.filter(
    (leg) => leg.kind === "self_recorded"
  ).length;

  return {
    officialResultCount,
    selfRecordedResultCount,
    status: getRaceResultStatus(officialResultCount, selfRecordedResultCount),
    displayTotalTime: race.total_time?.toString() ?? null,
    displayAveragePace: race.average_pace ?? null,
  };
}

export function getNaiveLiveProjection(
  raceYear: number,
  displayLegResults: DisplayLegResult[],
  officialResults: OfficialResult[],
  legDefinitions: LegDefinition[] = []
): LiveProjection | null {
  const reportedLegByNumber = new Map<number, DisplayLegResult>();

  displayLegResults.forEach((leg) => {
    if (leg.leg_number === null || !leg.lap_time) {
      return;
    }

    const current = reportedLegByNumber.get(leg.leg_number);
    if (!current || leg.kind === "official") {
      reportedLegByNumber.set(leg.leg_number, leg);
    }
  });

  const currentLegVersionByNumber = getCurrentLegVersionByNumber(
    displayLegResults,
    legDefinitions
  );
  const historicalAveragesByLegVersion = getHistoricalAverageMinutesByLegVersion(
    raceYear,
    officialResults
  );
  const legs: LiveProjectionLeg[] = [];
  let currentRecordedMinutes = 0;
  let projectedTotalMinutes = 0;
  let reportedLegCount = 0;
  let estimatedLegCount = 0;

  for (let legNumber = 1; legNumber <= EXPECTED_RELAY_LEGS; legNumber += 1) {
    const reportedLeg = reportedLegByNumber.get(legNumber);
    const reportedMinutes = reportedLeg?.lap_time ? parseTimeToMinutes(reportedLeg.lap_time) : 0;

    if (reportedLeg && reportedMinutes > 0) {
      currentRecordedMinutes += reportedMinutes;
      projectedTotalMinutes += reportedMinutes;
      reportedLegCount += 1;
      legs.push({
        legNumber,
        legVersion: reportedLeg.leg_version,
        minutes: reportedMinutes,
        displayTime: formatDuration(reportedMinutes),
        status: "reported",
        sourceLabel: formatProjectionSource(reportedLeg),
      });
      continue;
    }

    const targetLegVersion = currentLegVersionByNumber.get(legNumber) ?? null;
    const estimatedMinutes =
      targetLegVersion === null
        ? null
        : historicalAveragesByLegVersion.get(formatLegVersionKey(legNumber, targetLegVersion)) ?? null;
    if (estimatedMinutes !== null && targetLegVersion !== null) {
      projectedTotalMinutes += estimatedMinutes;
      estimatedLegCount += 1;
      legs.push({
        legNumber,
        legVersion: targetLegVersion,
        minutes: estimatedMinutes,
        displayTime: formatDuration(estimatedMinutes),
        status: "estimated",
        sourceLabel: `Historical avg for leg ${legNumber} v${targetLegVersion}`,
      });
      continue;
    }

    legs.push({
      legNumber,
      legVersion: currentLegVersionByNumber.get(legNumber) ?? null,
      minutes: null,
      displayTime: "N/A",
      status: "missing_estimate",
      sourceLabel: "No historical average yet",
    });
  }

  if (reportedLegCount === 0) {
    return null;
  }

  const hasMissingEstimate = legs.some((leg) => leg.status === "missing_estimate");
  const totalMinutes = hasMissingEstimate ? null : projectedTotalMinutes;

  return {
    reportedLegCount,
    estimatedLegCount,
    currentRecordedMinutes,
    projectedTotalMinutes: totalMinutes,
    displayCurrentRecordedTime: formatDuration(currentRecordedMinutes),
    displayProjectedTotalTime: totalMinutes === null ? "N/A" : formatDuration(totalMinutes),
    legs,
  };
}

function getRaceResultStatus(
  officialResultCount: number,
  selfRecordedResultCount: number
): RaceResultStatus {
  if (officialResultCount === 0) {
    return {
      tone: "pending",
      label: "Official Results Pending",
      description:
        selfRecordedResultCount > 0
          ? "Showing self recorded data until official results arrive."
          : "Race shell is ready for self recorded race-day data.",
    };
  }

  if (officialResultCount < EXPECTED_RELAY_LEGS || selfRecordedResultCount > 0) {
    return {
      tone: "partial",
      label: "Partial Official Results",
      description: "Official results are partially available.",
    };
  }

  return {
    tone: "official",
    label: "Official Results",
    description: "Showing official race results.",
  };
}

function toOfficialDisplayLeg(result: OfficialResult): DisplayLegResult {
  return {
    kind: "official",
    key: `official-${result.year}-${result.leg_number}`,
    leg_number: result.leg_number,
    leg_version: result.leg_version,
    runner_name: result.runner_name,
    runner_id: result.runner_id,
    lap_time: result.lap_time,
    pace: result.pace,
    gradeAdjustedPace: getGradeAdjustedPace({
      pace: result.pace,
      distanceMiles: result.distance,
      elevationGainFeet: result.elevation_gain,
    }),
    distance: result.distance,
    elevation_gain: result.elevation_gain,
    assumed_metrics: {
      pace: false,
      distance: false,
      elevationGain: false,
    },
    source_type: result.source_type ?? "official",
    source_label: null,
    officialResult: result,
  };
}

function toSelfRecordedDisplayLeg(observation: SelfRecordedObservation): DisplayLegResult {
  const distance = observation.observed_distance ?? observation.display_distance ?? observation.canonical_distance;
  const elevationGain =
    observation.observed_elevation_gain ??
    observation.display_elevation_gain ??
    observation.canonical_elevation_gain;
  const pace =
    observation.observed_distance && observation.pace
      ? observation.pace
      : getAssumedPace(observation.primary_time, distance);

  return {
    kind: "self_recorded",
    key: `self-recorded-${observation.id ?? `${observation.year}-${observation.leg_number}`}`,
    leg_number: observation.leg_number,
    leg_version: observation.leg_version,
    runner_name: observation.runner_name,
    runner_id: observation.runner_id,
    lap_time:
      observation.primary_time ??
      observation.lap_time ??
      observation.elapsed_time ??
      observation.moving_time,
    pace,
    gradeAdjustedPace: getGradeAdjustedPace({
      pace,
      distanceMiles: distance,
      elevationGainFeet: elevationGain,
    }),
    distance,
    elevation_gain: elevationGain,
    assumed_metrics: {
      pace: !observation.observed_distance && pace !== null,
      distance: observation.observed_distance === null && distance !== null,
      elevationGain: observation.observed_elevation_gain === null && elevationGain !== null,
    },
    source_type: observation.source_type,
    source_label: observation.source_label,
    observation,
  };
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

function formatDuration(minutes: number) {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getCurrentLegVersionByNumber(
  displayLegResults: DisplayLegResult[],
  legDefinitions: LegDefinition[]
) {
  const versionByLeg = new Map<number, number>();

  displayLegResults.forEach((leg) => {
    if (leg.leg_number === null || leg.leg_version === null) {
      return;
    }

    versionByLeg.set(leg.leg_number, leg.leg_version);
  });

  legDefinitions.forEach((definition) => {
    const currentVersion = versionByLeg.get(definition.number);
    if (currentVersion === undefined || definition.version > currentVersion) {
      versionByLeg.set(definition.number, definition.version);
    }
  });

  return versionByLeg;
}

function getHistoricalAverageMinutesByLegVersion(raceYear: number, officialResults: OfficialResult[]) {
  const minutesByLegVersion = new Map<string, number[]>();

  officialResults.forEach((result) => {
    if (
      result.year === raceYear ||
      result.leg_number === null ||
      result.leg_version === null ||
      !result.lap_time
    ) {
      return;
    }

    const minutes = parseTimeToMinutes(result.lap_time);
    if (minutes <= 0) {
      return;
    }

    const key = formatLegVersionKey(result.leg_number, result.leg_version);
    const current = minutesByLegVersion.get(key) ?? [];
    current.push(minutes);
    minutesByLegVersion.set(key, current);
  });

  return new Map(
    Array.from(minutesByLegVersion.entries()).map(([key, minutes]) => [
      key,
      minutes.reduce((sum, value) => sum + value, 0) / minutes.length,
    ])
  );
}

function formatLegVersionKey(legNumber: number, legVersion: number) {
  return `${legNumber}:${legVersion}`;
}

function formatProjectionSource(leg: DisplayLegResult) {
  if (leg.kind === "official") {
    return "Official";
  }

  const sourceType = formatDisplaySourceType(leg.source_type);
  return leg.source_label ? `${sourceType} · ${leg.source_label}` : sourceType;
}

function formatDisplaySourceType(sourceType: string | null | undefined) {
  const labels: Record<string, string> = {
    apple_watch: "Apple Watch",
    garmin: "Garmin",
    phone: "Phone",
    strava: "Strava",
    manual_runner: "Runner",
    manual_admin: "Manual",
    official: "Official",
    other: "Other",
  };

  return labels[sourceType || ""] || "Other";
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

function getObservationTimestamp(observation: SelfRecordedObservation) {
  return Date.parse(observation.updated_at ?? observation.created_at ?? "") || 0;
}

function sortDisplayLegs(a: DisplayLegResult, b: DisplayLegResult) {
  return (
    (a.leg_number ?? 0) - (b.leg_number ?? 0) ||
    (a.leg_version ?? 0) - (b.leg_version ?? 0)
  );
}
