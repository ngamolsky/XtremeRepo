import { Link } from "@tanstack/react-router";
import { Calendar, Clock, TrendingUp, Trophy } from "lucide-react";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRelayData } from "../hooks/useRelayData";
import { buildDashboardPerformanceData } from "../lib/dashboardPerformance";
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

const Dashboard: React.FC = () => {
  const {
    data: { yearlySummary, results, legResultObservations },
    loading,
    error,
  } = useRelayData();

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
        <p className="text-red-600 text-sm mt-2">
          Make sure your Supabase environment variables are configured
          correctly.
        </p>
      </div>
    );
  }

  const dashboardPerformance = buildDashboardPerformanceData(
    yearlySummary,
    results,
    legResultObservations
  );

  // Calculate stats from real data
  const latestPerformance = yearlySummary[0];
  const bestOverallPercentile =
    yearlySummary.length > 0
      ? Math.min(
          ...yearlySummary
            .map((p) => p.overall_percentile)
            .filter((p): p is number => p !== null)
        )
      : null;
  const averageOverallPercentile =
    yearlySummary.length > 0
      ? yearlySummary.reduce((sum, p) => sum + (p.overall_percentile || 0), 0) /
        yearlySummary.length
      : null;

  // Prepare chart data
  const performanceChartData = yearlySummary
    .map((perf) => ({
      year: perf.year,
      division: perf.division_percentile,
      overall: perf.overall_percentile,
    }))
    .reverse();

  const currentYear = dashboardPerformance.currentYear;
  const legPerformanceData = dashboardPerformance.latestRaceEntries.map((entry) => ({
    fill: entry.resultType === "self_reported" ? "#d97706" : "#3b82f6",
    leg: entry.leg,
    resultType: entry.resultType,
    status: entry.label,
    time: entry.time,
    timeText: entry.timeText,
    runner: entry.runner,
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Xtreme Falcons Performance Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Race-day signal for every Falcon leg, handoff, and climb
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Total Races"
          value={dashboardPerformance.totalRaces.toString()}
        />
        <StatCard
          icon={<Trophy className="w-6 h-6" />}
          label="Best Percentile"
          value={
            bestOverallPercentile !== null
              ? `Top ${Math.round(bestOverallPercentile)}%`
              : "N/A"
          }
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Latest Time"
          value={dashboardPerformance.latestTime || latestPerformance?.total_time?.toString() || "N/A"}
          detail={
            dashboardPerformance.latestTimeResultType === "self_reported" ? (
              <div className="flex flex-wrap items-center gap-2">
                <SelfReportedBadge compact />
                <span className="text-amber-800 dark:text-amber-200">
                  {dashboardPerformance.latestTimeSelfReportedLegCount} self-reported leg
                  {dashboardPerformance.latestTimeSelfReportedLegCount === 1 ? "" : "s"}
                </span>
              </div>
            ) : undefined
          }
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Avg Percentile"
          value={
            averageOverallPercentile !== null
              ? `Top ${Math.round(averageOverallPercentile)}%`
              : "N/A"
          }
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Placement Trend */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Performance Percentile Trend
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Lower percentile indicates better performance (e.g., 10% means top
            10% of teams)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={performanceChartData}
                margin={{ top: 8, right: 28, left: 30, bottom: 8 }}
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
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  domain={[0, 100]}
                  reversed={true}
                  label={{
                    value: "Percentile",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: chartAxisColor },
                  }}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => {
                    const numericValue = typeof value === "number" ? value : Number(value);
                    const formattedValue = Number.isFinite(numericValue)
                      ? numericValue.toFixed(1)
                      : String(value ?? "");

                    return [`${formattedValue}%`, ""];
                  }}
                />
                <Legend wrapperStyle={{ color: chartAxisColor }} />
                <Line
                  type="monotone"
                  dataKey="division"
                  name="Division"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: "#3B82F6", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: "#10B981", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leg Performance */}
        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50">
              Latest Race - Leg Performance ({currentYear})
            </h3>
            {legPerformanceData.some((entry) => entry.resultType === "self_reported") ? (
              <SelfReportedBadge />
            ) : null}
          </div>
          {legPerformanceData.length > 0 ? (
            <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={legPerformanceData}
                margin={{ top: 8, right: 16, left: 28, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis
                  dataKey="leg"
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
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value, _name, props) => {
                    const numericValue = typeof value === "number" ? value : Number(value);
                    const formattedValue = Number.isFinite(numericValue)
                      ? numericValue.toFixed(1)
                      : String(value);

                    return [
                      `${formattedValue} min${props?.payload?.status ? ` · ${props.payload.status}` : ""}`,
                      `Time (${props?.payload?.runner || "Unknown Runner"})`,
                    ];
                  }}
                />
                <Bar dataKey="time" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {legPerformanceData.map((entry) => (
                    <Cell key={`${entry.leg}-${entry.runner}-${entry.status}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {legPerformanceData.some((entry) => entry.resultType === "self_reported") ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-slate-300">
                {legPerformanceData
                  .filter((entry) => entry.resultType === "self_reported")
                  .map((entry) => (
                    <span key={`self-dot-${entry.leg}-${entry.runner}`} className="inline-flex items-center gap-1.5">
                      <SelfReportedDot />
                      {entry.leg} · {entry.runner}
                    </span>
                  ))}
              </div>
            ) : null}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No leg performance data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Performance Summary */}
      {dashboardPerformance.yearlyRows.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50 mb-4">
            Year-over-Year Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
              <thead className="bg-gray-50 dark:bg-slate-900/70">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Pace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall Placement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Division Placement
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {dashboardPerformance.yearlyRows.map((perf, idx) => (
                  <tr
                    key={`${perf.year}-${perf.resultType}`}
                    className={
                      idx % 2 === 0
                        ? "bg-white dark:bg-slate-950"
                        : "bg-gray-50 hover:bg-gray-100 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/races/$year"
                          params={{ year: String(perf.year) }}
                          className="text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                        >
                          {perf.year}
                        </Link>
                        {perf.resultType === "self_reported" ? <SelfReportedBadge compact /> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {perf.totalTime || "—"}
                      {perf.resultType === "self_reported" && perf.selfReportedLegCount > 0 ? (
                        <span className="ml-2 text-xs text-amber-800 dark:text-amber-200">
                          ({perf.selfReportedLegCount} self-reported leg{perf.selfReportedLegCount === 1 ? "" : "s"})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {perf.averagePace || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {formatPlacement(perf.overallPlace, perf.overallTeams)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                      {formatPlacement(perf.divisionPlace, perf.divisionTeams)}
                      {perf.division ? ` (${perf.division})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const SelfReportedBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span
    className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-100 font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 ${
      compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
    }`}
  >
    Self Reported
  </span>
);

const SelfReportedDot: React.FC = () => (
  <span
    aria-hidden="true"
    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600 ring-2 ring-amber-100 dark:bg-amber-300 dark:ring-amber-950"
  />
);

function formatPlacement(place: number | null, teams: number | null): string {
  if (place === null && teams === null) {
    return "—";
  }
  if (place === null) {
    return `— of ${teams}`;
  }
  if (teams === null) {
    return String(place);
  }
  return `${place} of ${teams}`;
}

export default Dashboard;
