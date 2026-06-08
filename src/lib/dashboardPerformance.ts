import type { Tables } from "../types/database.types";

type OfficialResult = Tables<"v_results_with_pace">;
type SelfReportedObservation = Tables<"v_leg_result_observations_with_pace">;
type YearlySummary = Tables<"v_yearly_summary">;

export type DashboardResultType = "official" | "self_reported";

export type DashboardLegPerformanceEntry = {
  key: string;
  label: "Official" | "Self Reported";
  leg: string;
  legNumber: number | null;
  legVersion: number | null;
  pace: number | null;
  resultType: DashboardResultType;
  runner: string;
  time: number | null;
  timeText: string | null;
};

export type DashboardYearlyRow = {
  averagePace: string | null;
  division: string | null;
  divisionPlace: number | null;
  divisionTeams: number | null;
  overallPlace: number | null;
  overallTeams: number | null;
  resultType: DashboardResultType;
  selfReportedLegCount: number;
  totalTime: string | null;
  year: number;
};

export type DashboardPerformanceData = {
  currentYear: number;
  latestRaceEntries: DashboardLegPerformanceEntry[];
  latestTime: string | null;
  totalRaces: number;
  yearlyRows: DashboardYearlyRow[];
};

export function buildDashboardPerformanceData(
  yearlySummary: YearlySummary[],
  results: OfficialResult[],
  observations: SelfReportedObservation[]
): DashboardPerformanceData {
  const officialSummaryYears = new Set(
    yearlySummary
      .map((summary) => summary.year)
      .filter((year): year is number => typeof year === "number")
  );
  const allYears = new Set<number>(officialSummaryYears);

  results.forEach((result) => {
    if (typeof result.year === "number") {
      allYears.add(result.year);
    }
  });

  getVisibleSelfReportedObservations(observations, results).forEach((observation) => {
    if (typeof observation.year === "number") {
      allYears.add(observation.year);
    }
  });

  const currentYear =
    Array.from(allYears).sort((a, b) => b - a)[0] ?? new Date().getFullYear();
  const latestRaceEntries = buildLatestRaceEntries(currentYear, results, observations);
  const latestTime = formatMinutes(
    latestRaceEntries.reduce((sum, entry) => sum + (entry.time ?? 0), 0)
  );
  const provisionalRows = buildSelfReportedYearRows(
    officialSummaryYears,
    results,
    observations
  );
  const officialRows = yearlySummary
    .filter((summary): summary is YearlySummary & { year: number } => typeof summary.year === "number")
    .map(toOfficialYearRow);
  const yearlyRows = [...officialRows, ...provisionalRows].sort((a, b) => b.year - a.year);

  return {
    currentYear,
    latestRaceEntries,
    latestTime,
    totalRaces: yearlyRows.length,
    yearlyRows,
  };
}

function buildLatestRaceEntries(
  year: number,
  results: OfficialResult[],
  observations: SelfReportedObservation[]
): DashboardLegPerformanceEntry[] {
  const officialEntries = results
    .filter((result) => result.year === year)
    .map(toOfficialLegEntry);
  const officialLegKeys = new Set(
    officialEntries.map((entry) => legKey(entry.legNumber, entry.legVersion))
  );
  const selfReportedEntries = observations
    .filter(
      (observation) =>
        observation.year === year &&
        isVisibleSelfReportedObservation(observation) &&
        !officialLegKeys.has(legKey(observation.leg_number, observation.leg_version))
    )
    .map(toSelfReportedLegEntry);

  return [...officialEntries, ...selfReportedEntries].sort(sortLegEntries);
}

function buildSelfReportedYearRows(
  officialSummaryYears: Set<number>,
  results: OfficialResult[],
  observations: SelfReportedObservation[]
): DashboardYearlyRow[] {
  const years = new Set(
    getVisibleSelfReportedObservations(observations, results)
      .map((observation) => observation.year)
      .filter((year): year is number => typeof year === "number")
      .filter((year) => !officialSummaryYears.has(year))
  );

  return Array.from(years).map((year) => {
    const entries = buildLatestRaceEntries(year, results, observations);
    const selfReportedLegCount = entries.filter((entry) => entry.resultType === "self_reported").length;
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.time ?? 0), 0);
    const paces = entries
      .map((entry) => entry.pace)
      .filter((pace): pace is number => typeof pace === "number" && Number.isFinite(pace));
    const averagePace = paces.length
      ? formatPace(paces.reduce((sum, pace) => sum + pace, 0) / paces.length)
      : null;

    return {
      averagePace,
      division: null,
      divisionPlace: null,
      divisionTeams: null,
      overallPlace: null,
      overallTeams: null,
      resultType: "self_reported",
      selfReportedLegCount,
      totalTime: formatMinutes(totalMinutes),
      year,
    };
  });
}

function toOfficialYearRow(summary: YearlySummary & { year: number }): DashboardYearlyRow {
  return {
    averagePace: stringifyValue(summary.average_pace),
    division: summary.division,
    divisionPlace: summary.division_place,
    divisionTeams: summary.division_teams,
    overallPlace: summary.overall_place,
    overallTeams: summary.overall_teams,
    resultType: "official",
    selfReportedLegCount: 0,
    totalTime: stringifyValue(summary.total_time),
    year: summary.year,
  };
}

function toOfficialLegEntry(result: OfficialResult): DashboardLegPerformanceEntry {
  return {
    key: `official-${result.year}-${result.leg_number}-${result.leg_version}`,
    label: "Official",
    leg: formatLegLabel(result.leg_number, result.leg_version),
    legNumber: result.leg_number,
    legVersion: result.leg_version,
    pace: result.pace,
    resultType: "official",
    runner: result.runner_name || "Missing Runner Name",
    time: result.time_in_minutes,
    timeText: result.lap_time,
  };
}

function toSelfReportedLegEntry(
  observation: SelfReportedObservation
): DashboardLegPerformanceEntry {
  const timeText =
    observation.primary_time ??
    observation.lap_time ??
    observation.elapsed_time ??
    observation.moving_time;

  return {
    key: `self-reported-${observation.id ?? `${observation.year}-${observation.leg_number}-${observation.leg_version}`}`,
    label: "Self Reported",
    leg: formatLegLabel(observation.leg_number, observation.leg_version),
    legNumber: observation.leg_number,
    legVersion: observation.leg_version,
    pace: observation.pace,
    resultType: "self_reported",
    runner: observation.runner_name || "Missing Runner Name",
    time: observation.time_in_minutes ?? parseTimeToMinutes(timeText),
    timeText,
  };
}

function getVisibleSelfReportedObservations(
  observations: SelfReportedObservation[],
  results: OfficialResult[]
): SelfReportedObservation[] {
  const officialKeys = new Set(results.map((result) => resultKey(result.year, result.leg_number, result.leg_version)));
  return observations.filter(
    (observation) =>
      isVisibleSelfReportedObservation(observation) &&
      !officialKeys.has(resultKey(observation.year, observation.leg_number, observation.leg_version))
  );
}

function isVisibleSelfReportedObservation(observation: SelfReportedObservation): boolean {
  return observation.has_canonical_result !== true && hasSelfReportedData(observation);
}

function hasSelfReportedData(observation: SelfReportedObservation): boolean {
  return Boolean(
    observation.primary_time ||
      observation.lap_time ||
      observation.elapsed_time ||
      observation.moving_time ||
      observation.time_in_minutes ||
      observation.pace
  );
}

function sortLegEntries(
  a: DashboardLegPerformanceEntry,
  b: DashboardLegPerformanceEntry
): number {
  return (
    (a.legNumber ?? Number.MAX_SAFE_INTEGER) -
      (b.legNumber ?? Number.MAX_SAFE_INTEGER) ||
    (a.legVersion ?? 0) - (b.legVersion ?? 0) ||
    a.resultType.localeCompare(b.resultType)
  );
}

function resultKey(
  year: number | null,
  legNumber: number | null,
  legVersion: number | null
): string {
  return `${year ?? "?"}:${legKey(legNumber, legVersion)}`;
}

function legKey(legNumber: number | null, legVersion: number | null): string {
  return `${legNumber ?? "?"}:${legVersion ?? 1}`;
}

function formatLegLabel(legNumber: number | null, legVersion: number | null): string {
  if (legNumber === null) {
    return "Unknown leg";
  }
  return legVersion === null ? `Leg ${legNumber}` : `Leg ${legNumber}`;
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) {
    return null;
  }
  const parts = time.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  return null;
}

function formatMinutes(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const wholeMinutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${hours}:${String(wholeMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPace(value: number): string {
  const minutes = Math.floor(value);
  const seconds = Math.round((value - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
