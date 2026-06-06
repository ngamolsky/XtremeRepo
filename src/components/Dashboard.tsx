import {
  Calendar,
  Clock,
  Feather,
  Mountain,
  Route,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
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
    data: { yearlySummary, results },
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

  const currentYear = latestPerformance?.year || new Date().getFullYear();
  const latestRaceResults = results.filter((result) => result.year === currentYear);
  const legPerformanceData = results
    .filter((result) => result.year === currentYear)
    .map((result) => ({
      leg: `Leg ${result.leg_number}`,
      time: result.time_in_minutes,
      runner: result.runner_name || "Missing Runner Name",
    }));
  const currentRaceMiles = latestRaceResults.reduce(
    (total, result) => total + (result.distance || 0),
    0
  );
  const currentRaceElevation = latestRaceResults.reduce(
    (total, result) => total + (result.elevation_gain || 0),
    0
  );
  const currentRaceRunners = new Set(
    latestRaceResults.map((result) => result.runner_name).filter(Boolean)
  ).size;
  const fastestLatestLeg = latestRaceResults
    .filter((result) => result.pace !== null)
    .sort((a, b) => (a.pace || 0) - (b.pace || 0))[0];
  const falconHighlights = [
    {
      label: "Falcon Course",
      value:
        currentRaceMiles > 0 ? `${currentRaceMiles.toFixed(1)} mi` : "N/A",
      detail: `${currentYear} race distance logged`,
      icon: <Route className="w-5 h-5" />,
    },
    {
      label: "Climb Watch",
      value:
        currentRaceElevation > 0
          ? `+${Math.round(currentRaceElevation).toLocaleString()} ft`
          : "N/A",
      detail: "Elevation carried by the squad",
      icon: <Mountain className="w-5 h-5" />,
    },
    {
      label: "Handoff Crew",
      value: currentRaceRunners > 0 ? currentRaceRunners.toString() : "N/A",
      detail: "Falcons in the latest relay",
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: "Fastest Wing",
      value: fastestLatestLeg?.pace ? formatPace(fastestLatestLeg.pace) : "N/A",
      detail: fastestLatestLeg
        ? `Leg ${fastestLatestLeg.leg_number} by ${fastestLatestLeg.runner_name}`
        : "Waiting on split data",
      icon: <Zap className="w-5 h-5" />,
    },
  ];

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
          value={yearlySummary.length.toString()}
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
          value={latestPerformance?.total_time?.toString() || "N/A"}
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

      <div className="card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase text-primary-700">
              <Feather className="w-3.5 h-3.5" />
              Falcon Flight Board
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Built for Falcons who race the whole course, not just their own
              split.
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              The latest relay snapshot blends distance, climb, crew size, and
              fastest pace so the Falcons can read the course at a glance.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
            {falconHighlights.map((highlight) => (
              <div
                key={highlight.label}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    {highlight.label}
                  </span>
                  <span className="rounded-full bg-white p-2 text-primary-600 shadow-sm dark:bg-slate-900 dark:text-primary-300">
                    {highlight.icon}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {highlight.value}
                </div>
                <p className="mt-1 text-xs text-gray-500">{highlight.detail}</p>
              </div>
            ))}
          </div>
        </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Latest Race - Leg Performance ({currentYear})
          </h3>
          {legPerformanceData.length > 0 ? (
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
                      `${formattedValue} min`,
                      `Time (${props?.payload?.runner || "Unknown Runner"})`,
                    ];
                  }}
                />
                <Bar dataKey="time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No leg performance data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Performance Summary */}
      {yearlySummary.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Year-over-Year Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
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
              <tbody className="bg-white divide-y divide-gray-200">
                {yearlySummary.map((perf, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50 hover:bg-gray-100"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {perf.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.total_time?.toString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.average_pace?.toString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.overall_place} of {perf.overall_teams}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.division_place} of {perf.division_teams} (
                      {perf.division})
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

export default Dashboard;
