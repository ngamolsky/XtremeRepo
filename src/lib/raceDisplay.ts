import type { Tables } from "../types/database.types";

type OfficialResult = Tables<"v_results_with_pace">;
type SelfRecordedObservation = Tables<"v_leg_result_observations_with_pace">;
type YearlySummary = Tables<"v_yearly_summary">;

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
  distance: number | null;
  elevation_gain: number | null;
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
    distance: result.distance,
    elevation_gain: result.elevation_gain,
    source_type: result.source_type ?? "official",
    source_label: null,
    officialResult: result,
  };
}

function toSelfRecordedDisplayLeg(observation: SelfRecordedObservation): DisplayLegResult {
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
    pace: observation.observed_distance ? observation.pace : null,
    distance: observation.observed_distance,
    elevation_gain: observation.observed_elevation_gain,
    source_type: observation.source_type,
    source_label: observation.source_label,
    observation,
  };
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
