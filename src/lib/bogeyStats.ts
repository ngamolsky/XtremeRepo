import type { Tables } from "../types/database.types";

export type BogeyEvent = Tables<"v_bogey_events">;

export type RunnerBogeySummary = {
  knownStartOffsetCount: number;
  net: number;
  passedByCount: number;
  passedCount: number;
  sameStartAssumedCount: number;
};

export type PerformanceBogeyFilter = {
  legNumber: number;
  legVersion: number;
  runnerName: string;
  year: number;
};

const emptySummary: RunnerBogeySummary = {
  knownStartOffsetCount: 0,
  net: 0,
  passedByCount: 0,
  passedCount: 0,
  sameStartAssumedCount: 0,
};

export function buildRunnerBogeySummary(
  runnerName: string,
  events: BogeyEvent[]
): RunnerBogeySummary {
  return events
    .filter((event) => event.runner_name === runnerName)
    .reduce<RunnerBogeySummary>((summary, event) => addEventToSummary(summary, event), {
      ...emptySummary,
    });
}

export function filterBogeyEventsForPerformance(
  events: BogeyEvent[],
  filter: PerformanceBogeyFilter
): BogeyEvent[] {
  return events.filter(
    (event) =>
      event.runner_name === filter.runnerName &&
      event.year === filter.year &&
      event.leg_number === filter.legNumber &&
      event.leg_version === filter.legVersion
  );
}

export function formatBogeyEventSummary(events: BogeyEvent[]) {
  if (events.length === 0) {
    return "0";
  }

  const summary = events.reduce<RunnerBogeySummary>(
    (currentSummary, event) => addEventToSummary(currentSummary, event),
    { ...emptySummary }
  );

  return `+${summary.passedCount} / -${summary.passedByCount}`;
}

function addEventToSummary(
  summary: RunnerBogeySummary,
  event: BogeyEvent
): RunnerBogeySummary {
  const next = { ...summary };

  if (event.event_type === "passed_by_us") {
    next.passedCount += 1;
  } else if (event.event_type === "passed_us") {
    next.passedByCount += 1;
  }

  if (event.time_basis === "known_start_offsets" || event.start_offsets_known) {
    next.knownStartOffsetCount += 1;
  } else {
    next.sameStartAssumedCount += 1;
  }

  next.net = next.passedCount - next.passedByCount;
  return next;
}
