import { Link, useParams } from "@tanstack/react-router";
import { Award, BarChart, Calendar, ChevronDown, LogOut, Map as MapIcon, Target } from "lucide-react";
import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsMyProfile } from "../hooks/useIsMyProfile";
import { useRelayData } from "../hooks/useRelayData";
import { supabase } from "../lib/supabase";
import {
  buildRunnerBogeySummary,
} from "../lib/bogeyStats";
import {
  buildLegRadarData,
  buildLegRadarVersionOptions,
  formatRadarPoints,
  radarPointForIndex,
  type LegRadarSelection,
} from "../lib/runnerLegRadar";
import {
  buildRunnerRaceBreakdown,
  type RunnerRaceEntry,
} from "../lib/runnerRaceBreakdown";
import { formatPace, formatSourceType } from "../lib/utils";
import Breadcrumbs from "./Breadcrumbs";
import CommentsSection from "./CommentsSection";
import { LegPill } from "./LegPill";
import { StatCard } from "./StatCard";

const chartAxisColor = "var(--chart-axis)";
const chartGridColor = "var(--chart-grid)";
const chartTooltipStyle = {
  backgroundColor: "var(--chart-tooltip-bg)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: "8px",
  color: "var(--chart-tooltip-text)",
  boxShadow: "var(--chart-tooltip-shadow)",
};

const RunnerDetail: React.FC = () => {
  const { runnerName } = useParams({ from: "/runners/$runnerName" });
  const {
    data: { bogeyEvents, legDefinitions, legResultObservations, runnerStats, results, participations },
    loading,
    error,
  } = useRelayData();
  const [selectedLegRadarVersion, setSelectedLegRadarVersion] =
    React.useState("latest");
  const [expandedRaceYears, setExpandedRaceYears] = React.useState<Set<number>>(
    () => new Set()
  );

  const runnerStat = runnerStats.find((r) => r.runner_name === runnerName);
  const runnerBogeySummary = buildRunnerBogeySummary(runnerName, bogeyEvents);
  const runnerResults = results.filter((r) => r.runner_name === runnerName);
  const runnerRaceBreakdown = React.useMemo(
    () => buildRunnerRaceBreakdown(runnerName, results, legResultObservations),
    [legResultObservations, results, runnerName]
  );
  React.useEffect(() => {
    setExpandedRaceYears(
      runnerRaceBreakdown.length > 0
        ? new Set([runnerRaceBreakdown[0].year])
        : new Set()
    );
  }, [runnerName, runnerRaceBreakdown]);
  const runnerParticipations = participations.filter(
    (participation) => participation.runner_name === runnerName
  );
  const unknownLegYears = runnerParticipations
    .filter((participation) => !participation.has_known_leg)
    .map((participation) => participation.year)
    .filter((year): year is number => typeof year === "number")
    .sort((a, b) => a - b);

  const runnerAuthId =
    runnerResults[0]?.auth_user_id ??
    runnerParticipations[0]?.auth_user_id;
  const { isMyProfile } = useIsMyProfile(runnerAuthId);
  const runnerId =
    runnerStat?.runner_id ??
    runnerResults[0]?.runner_id ??
    runnerParticipations[0]?.runner_id ??
    null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Connection Error
        </h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!runnerStat && runnerParticipations.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No data found
        </h3>
        <p className="text-gray-600">No results found for {runnerName}</p>
      </div>
    );
  }

  const yearsCompeted =
    runnerStat?.unique_years ??
    new Set(
      runnerParticipations
        .map((participation) => participation.year)
        .filter((year): year is number => typeof year === "number")
    ).size;
  const knownLegRuns = runnerStat?.known_leg_runs ?? 0;
  const legVersionGroups = Array.from(
    runnerResults.reduce((groups, result) => {
      const leg = result.leg_number;
      const version = result.leg_version;

      if (typeof leg !== "number" || typeof version !== "number") {
        return groups;
      }

      const legs = groups.get(version) ?? new Set<number>();
      legs.add(leg);
      groups.set(version, legs);

      return groups;
    }, new Map<number, Set<number>>())
  )
    .map(([version, legs]) => ({
      version,
      legs: [...legs].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.version - a.version);
  const legRadarOptions = buildLegRadarVersionOptions(runnerResults, legDefinitions);
  const legRadarVersionOptions = legRadarOptions.filter(
    (option): option is { label: string; value: number } =>
      typeof option.value === "number"
  );
  const selectedNumericVersion = Number(selectedLegRadarVersion);
  const selectedLegRadarSelection: LegRadarSelection =
    selectedLegRadarVersion === "all"
      ? "all"
      : legRadarVersionOptions.some(
            (option) => option.value === selectedNumericVersion
          )
        ? selectedNumericVersion
        : (legRadarVersionOptions[0]?.value ?? "all");
  const latestLegRadar = buildLegRadarData(
    runnerResults,
    legDefinitions,
    selectedLegRadarSelection
  );
  const legRadarSelectionLabel =
    selectedLegRadarSelection === "all"
      ? "all versions"
      : `v${selectedLegRadarSelection}`;

  // Prepare data for the performance chart
  const performanceData = runnerResults
    .map((result) => ({
      year: result.year,
      leg: result.leg_number,
      pace: result.pace,
      time: result.time_in_minutes,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0));
  const radarSize = 320;
  const radarCenter = radarSize / 2;
  const radarRadius = 108;
  const radarLabelRadius = 136;
  const radarMaxCount = Math.max(1, latestLegRadar.maxCount);
  const radarTotalLegs = latestLegRadar.data.length;
  const radarValuePoints = latestLegRadar.data.map((datum, index) =>
    radarPointForIndex(
      index,
      radarTotalLegs,
      datum.count / radarMaxCount,
      radarCenter,
      radarCenter,
      radarRadius
    )
  );
  const radarAxisPoints = latestLegRadar.data.map((_, index) =>
    radarPointForIndex(index, radarTotalLegs, 1, radarCenter, radarCenter, radarRadius)
  );
  const radarLabelPoints = latestLegRadar.data.map((_, index) =>
    radarPointForIndex(
      index,
      radarTotalLegs,
      1,
      radarCenter,
      radarCenter,
      radarLabelRadius
    )
  );
  const toggleRaceYear = (year: number) => {
    setExpandedRaceYears((current) => {
      const next = new Set(current);

      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }

      return next;
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Breadcrumbs
        current={runnerName}
        items={[{ label: "Team", to: "/team" }]}
      />
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
          {runnerName
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{runnerName}</h1>
        <p className="text-lg text-gray-600">
          {yearsCompeted} {yearsCompeted === 1 ? "year" : "years"} •{" "}
          {knownLegRuns} known {knownLegRuns === 1 ? "leg run" : "leg runs"}
        </p>
        {isMyProfile && (
          <button
            onClick={handleSignOut}
            className="mt-4 flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 mx-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      <section className="card mx-auto max-w-4xl px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200">
            <MapIcon className="h-5 w-5 text-green-600 dark:text-green-300" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Legs Run
            </h2>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:items-end">
            {legVersionGroups.length > 0 ? (
              legVersionGroups.map(({ version, legs }) => (
                <div
                  key={version}
                  className="flex flex-wrap items-center gap-2 sm:justify-end"
                >
                  <span className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                    v{version}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {legs.map((leg) => (
                      <LegPill
                        key={`${version}-${leg}`}
                        leg={leg}
                        version={version}
                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Leg {leg}
                      </LegPill>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <span className="text-sm text-gray-600 dark:text-slate-400">No known legs yet.</span>
            )}
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          icon={<Award className="w-6 h-6 text-yellow-600" />}
          label="Best Pace"
          value={runnerStat?.best_pace ? formatPace(runnerStat.best_pace) : "N/A"}
        />
        <StatCard
          icon={<BarChart className="w-6 h-6 text-blue-600" />}
          label="Average Pace"
          value={runnerStat?.average_pace ? formatPace(runnerStat.average_pace) : "N/A"}
        />
        <StatCard
          icon={<Target className="w-6 h-6 text-emerald-600" />}
          label="Bogeys"
          value={`+${runnerBogeySummary.passedCount} / -${runnerBogeySummary.passedByCount}`}
        />
        <StatCard
          icon={<MapIcon className="w-6 h-6 text-green-600" />}
          label="Unique Legs"
          value={runnerStat?.unique_legs?.toString() || "0"}
        />
        <StatCard
          icon={<Calendar className="w-6 h-6 text-indigo-600" />}
          label="Years Competed"
          value={yearsCompeted.toString()}
        />
      </div>
      {runnerBogeySummary.passedCount + runnerBogeySummary.passedByCount > 0 && (
        <p className="text-sm text-gray-600">
          Bogeys are teams passed (+) and teams that passed this runner (-) by leg. {" "}
          {runnerBogeySummary.sameStartAssumedCount > 0
            ? `${runnerBogeySummary.sameStartAssumedCount} same-start inferred event${runnerBogeySummary.sameStartAssumedCount === 1 ? "" : "s"} may differ from physical on-course passes if wave starts were offset.`
            : "All displayed bogey events have known start offsets."}
        </p>
      )}

      {/* Performance Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance History
        </h3>
        {performanceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={performanceData}
              margin={{ top: 12, right: 24, left: 30, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis
                dataKey="year"
                stroke={chartAxisColor}
                tick={{ fill: chartAxisColor }}
                tickLine={{ stroke: chartAxisColor }}
              />
              <YAxis
                width={76}
                tickMargin={8}
                stroke={chartAxisColor}
                tick={{ fill: chartAxisColor }}
                tickLine={{ stroke: chartAxisColor }}
                reversed
                tickFormatter={(tick) => formatPace(tick)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name, props) => {
                  const numericValue = typeof value === "number" ? value : Number(value);

                  if (name === "pace") {
                    return [
                      formatPace(Number.isFinite(numericValue) ? numericValue : 0),
                      `Pace (Leg ${props.payload.leg})`,
                    ];
                  }
                  if (name === "time") {
                    const formattedValue = Number.isFinite(numericValue)
                      ? numericValue.toFixed(2)
                      : String(value);

                    return [`${formattedValue} mins`, "Time"];
                  }
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{
                  stroke: "#3b82f6",
                  strokeWidth: 2,
                  r: 4,
                  fill: "var(--chart-dot-fill)",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-600">No known leg results yet.</p>
        )}
      </div>

      {/* Race Breakdown */}
      <div className="card p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Race Results
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Tap a race to expand official data and any self reported race-day entries.
          </p>
        </div>
        {runnerRaceBreakdown.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {runnerRaceBreakdown.map((race) => {
              const isExpanded = expandedRaceYears.has(race.year);

              return (
                <section key={race.year} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleRaceYear(race.year)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-gray-900">
                        {race.year} Race
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        {race.official.length} official
                        {race.provisional.length > 0
                          ? ` · ${race.provisional.length} self reported`
                          : ""}
                      </p>
                      <Link
                        to="/races/$year"
                        params={{ year: String(race.year) }}
                        className="mt-1 inline-flex text-xs font-medium text-primary-700 hover:text-primary-800"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Race page
                      </Link>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-5">
                      <RunnerRaceEntryGroup
                        entries={race.official}
                        emptyText="No official data yet."
                        kind="official"
                        runnerName={runnerName}
                        title="Official"
                        year={race.year}
                      />
                      {race.provisional.length > 0 && (
                        <RunnerRaceEntryGroup
                          entries={race.provisional}
                          emptyText=""
                          kind="provisional"
                          runnerName={runnerName}
                          title="Self Reported"
                          year={race.year}
                        />
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            This runner is counted for race-year participation, but no leg assignment is known yet.
          </p>
        )}
      </div>

      {unknownLegYears.length > 0 && (
        <section className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Years With Unknown Leg
          </h3>
          <div className="flex flex-wrap gap-2">
            {unknownLegYears.map((year) => (
              <Link
                key={year}
                to="/races/$year"
                params={{ year: String(year) }}
                className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full hover:bg-amber-200"
              >
                {year}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Leg Frequency
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Showing {legRadarSelectionLabel}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <span>Version</span>
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              onChange={(event) => setSelectedLegRadarVersion(event.target.value)}
              value={
                selectedLegRadarSelection === "all"
                  ? "all"
                  : String(selectedLegRadarSelection)
              }
            >
              {legRadarOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {latestLegRadar.data.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-gray-600">
              How many times {runnerName} has run each leg for {legRadarSelectionLabel}.
            </p>
            <div className="flex justify-center overflow-x-auto">
              <svg
                aria-label={`Leg frequency radar chart for ${runnerName}, ${legRadarSelectionLabel}`}
                className="h-[360px] min-w-[320px] max-w-full"
                role="img"
                viewBox={`0 0 ${radarSize} ${radarSize}`}
              >
                {[0.25, 0.5, 0.75, 1].map((level) => (
                  <polygon
                    key={level}
                    fill="none"
                    points={formatRadarPoints(
                      latestLegRadar.data.map((_, index) =>
                        radarPointForIndex(
                          index,
                          radarTotalLegs,
                          level,
                          radarCenter,
                          radarCenter,
                          radarRadius
                        )
                      )
                    )}
                    stroke={chartGridColor}
                    strokeWidth="1"
                  />
                ))}
                {radarAxisPoints.map((point, index) => (
                  <line
                    key={`axis-${latestLegRadar.data[index].legNumber}`}
                    stroke={chartGridColor}
                    strokeWidth="1"
                    x1={radarCenter}
                    x2={point.x}
                    y1={radarCenter}
                    y2={point.y}
                  />
                ))}
                <polygon
                  fill="#22c55e"
                  fillOpacity="0.35"
                  points={formatRadarPoints(radarValuePoints)}
                  stroke="#16a34a"
                  strokeWidth="2"
                />
                {radarValuePoints.map((point, index) => (
                  <circle
                    key={`point-${latestLegRadar.data[index].legNumber}`}
                    cx={point.x}
                    cy={point.y}
                    fill="#16a34a"
                    r="3.5"
                  />
                ))}
                {radarLabelPoints.map((point, index) => {
                  const datum = latestLegRadar.data[index];
                  const anchor =
                    Math.abs(point.x - radarCenter) < 8
                      ? "middle"
                      : point.x > radarCenter
                        ? "start"
                        : "end";

                  return (
                    <text
                      key={`label-${datum.legNumber}`}
                      fill={chartAxisColor}
                      fontSize="11"
                      textAnchor={anchor}
                      x={point.x}
                      y={point.y}
                    >
                      <tspan x={point.x}>{datum.leg}</tspan>
                      <tspan dy="13" x={point.x}>
                        {datum.count}
                      </tspan>
                    </text>
                  );
                })}
              </svg>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            No known leg results for {legRadarSelectionLabel} yet.
          </p>
        )}
      </section>

      {runnerId && (
        <CommentsSection
          targetType="runner"
          runnerId={runnerId}
          title="Runner Comments"
        />
      )}
    </div>
  );
};

const RunnerRaceEntryGroup: React.FC<{
  emptyText: string;
  entries: RunnerRaceEntry[];
  kind: "official" | "provisional";
  runnerName: string;
  title: string;
  year: number;
}> = ({ emptyText, entries, kind, runnerName, title, year }) => (
  <div>
    <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {title}
    </h5>
    {entries.length > 0 ? (
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {entries.map((entry) => (
          <RunnerRaceEntryCard
            key={entry.key}
            entry={entry}
            kind={kind}
            runnerName={runnerName}
            year={year}
          />
        ))}
      </div>
    ) : (
      <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
        {emptyText}
      </p>
    )}
  </div>
);

const RunnerRaceEntryCard: React.FC<{
  entry: RunnerRaceEntry;
  kind: "official" | "provisional";
  runnerName: string;
  year: number;
}> = ({ entry, kind, runnerName, year }) => (
  <div className="py-4 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {entry.legNumber && entry.legVersion ? (
            <LegPill
              leg={entry.legNumber}
              version={entry.legVersion}
              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
            >
              {entry.label}
            </LegPill>
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              {entry.label}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              kind === "official"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {kind === "official" ? "Official" : "Self Reported"}
          </span>
        </div>
        {kind === "provisional" && (
          <p className="mt-2 text-xs text-gray-500">
            {formatProvisionalSource(entry)}
          </p>
        )}
      </div>
      {entry.legNumber && entry.legVersion ? (
        <Link
          to="/runs/$runnerName/$year/$legNumber/$version"
          params={{
            runnerName,
            year: String(year),
            legNumber: String(entry.legNumber),
            version: String(entry.legVersion),
          }}
          className="text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          Open
        </Link>
      ) : null}
    </div>

    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <RunnerRaceMetric label={entry.timeLabel} value={entry.time || "N/A"} />
      <RunnerRaceMetric
        assumed={entry.assumedMetrics.pace}
        label="Pace"
        value={entry.pace ? formatPace(entry.pace) : "N/A"}
      />
      <RunnerRaceMetric
        assumed={entry.assumedMetrics.distance}
        label="Distance"
        value={entry.distance ? `${entry.distance} mi` : "N/A"}
      />
      <RunnerRaceMetric
        assumed={entry.assumedMetrics.elevationGain}
        label="Elevation"
        value={entry.elevationGain ? `${entry.elevationGain} ft` : "N/A"}
      />
    </dl>

    {entry.sourceTags.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.sourceTags.map((sourceTag) => (
          <span
            key={sourceTag}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {formatRaceSourceTag(sourceTag)}
          </span>
        ))}
      </div>
    )}
  </div>
);

const RunnerRaceMetric: React.FC<{
  assumed?: boolean;
  label: string;
  value: string;
}> = ({ assumed = false, label, value }) => (
  <div>
    <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
    <dd className="mt-1 font-medium text-gray-900">
      {value}
      {assumed ? <span aria-label="assumed">*</span> : null}
    </dd>
  </div>
);

function formatRaceSourceTag(sourceTag: string) {
  return sourceTag.toLowerCase() === "provisional" ? "Self Reported" : sourceTag;
}

function formatProvisionalSource(entry: RunnerRaceEntry) {
  const sourceType = entry.sourceType ? formatSourceType(entry.sourceType) : null;

  if (sourceType && entry.sourceLabel) {
    return `${sourceType} · ${entry.sourceLabel}`;
  }

  return sourceType ?? entry.sourceLabel ?? "Self recorded race-day data";
}

export default RunnerDetail;
