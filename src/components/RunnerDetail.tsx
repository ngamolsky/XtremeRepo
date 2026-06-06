import { useParams } from "@tanstack/react-router";
import { Award, BarChart, Calendar, LogOut, Map } from "lucide-react";
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
import { formatPace } from "../lib/utils";
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
    data: { runnerStats, results, participations },
    loading,
    error,
  } = useRelayData();

  const runnerStat = runnerStats.find((r) => r.runner_name === runnerName);
  const runnerResults = results.filter((r) => r.runner_name === runnerName);
  const runnerParticipations = participations.filter(
    (participation) => participation.runner_name === runnerName
  );
  const unknownLegYears = runnerParticipations
    .filter((participation) => !participation.has_known_leg)
    .map((participation) => participation.year)
    .filter((year): year is number => typeof year === "number")
    .sort((a, b) => a - b);

  const runnerAuthId =
    runnerResults[0]?.auth_user_id ?? runnerParticipations[0]?.auth_user_id;
  const { isMyProfile } = useIsMyProfile(runnerAuthId);

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

  if (!runnerStat) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No data found
        </h3>
        <p className="text-gray-600">No results found for {runnerName}</p>
      </div>
    );
  }

  const yearsCompeted = runnerStat.unique_years ?? 0;
  const knownLegRuns = runnerStat.known_leg_runs ?? 0;

  // Prepare data for the performance chart
  const performanceData = runnerResults
    .map((result) => ({
      year: result.year,
      leg: result.leg_number,
      pace: result.pace,
      time: result.time_in_minutes,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0));

  return (
    <div className="space-y-8 animate-fade-in">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Award className="w-6 h-6 text-yellow-600" />}
          label="Best Pace"
          value={formatPace(runnerStat.best_pace || 0)}
        />
        <StatCard
          icon={<BarChart className="w-6 h-6 text-blue-600" />}
          label="Average Pace"
          value={formatPace(runnerStat.average_pace || 0)}
        />
        <StatCard
          icon={<Map className="w-6 h-6 text-green-600" />}
          label="Unique Legs"
          value={runnerStat.unique_legs?.toString() || "0"}
        />
        <StatCard
          icon={<Calendar className="w-6 h-6 text-indigo-600" />}
          label="Years Competed"
          value={runnerStat.unique_years?.toString() || "0"}
        />
      </div>

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

      {/* Results Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Known Leg Results
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leg
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pace
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Elevation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runnerResults.length > 0 ? (
                runnerResults
                .sort((a, b) => (b.year || 0) - (a.year || 0))
                .map((result, idx) => (
                  <tr
                    key={`${result.year}-${result.leg_number}-${result.leg_version}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <LegPill
                        leg={result.leg_number || 0}
                        version={result.leg_version || 0}
                        className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                      >
                        {result.leg_number} (v{result.leg_version})
                      </LegPill>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.lap_time || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPace(result.pace || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.distance ? `${result.distance} mi` : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.elevation_gain
                        ? `${result.elevation_gain} ft`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {result.notes || ""}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-sm text-gray-600"
                  >
                    This runner is counted for race-year participation, but no
                    leg assignment is known yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {unknownLegYears.length > 0 && (
        <section className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Years With Unknown Leg
          </h3>
          <div className="flex flex-wrap gap-2">
            {unknownLegYears.map((year) => (
              <span
                key={year}
                className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
              >
                {year}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RunnerDetail;
