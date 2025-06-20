import { Link, useParams } from "@tanstack/react-router";
import { Award, BarChart, Map, Users } from "lucide-react";
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
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { StatCard } from "./StatCard";

const LegDetail: React.FC = () => {
  const { legNumber, version } = useParams({
    from: "/legs/$legNumber/$version",
  });
  const {
    data: { legVersionStats, results },
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
      </div>
    );
  }

  // Filter results for this specific leg and version
  const legStat = legVersionStats.find(
    (l) =>
      l.leg_number === Number(legNumber) && l.leg_version === Number(version)
  );

  const legData = results.filter(
    (result) =>
      result.leg_number === Number(legNumber) &&
      result.leg_version === Number(version)
  );

  if (!legStat) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No data found
        </h3>
        <p className="text-gray-600">
          No results found for Leg {legNumber} Version {version}
        </p>
      </div>
    );
  }

  // Prepare data for the performance chart
  const performanceData = legData
    .map((result) => ({
      year: result.year,
      runner: result.runner_name,
      pace: result.pace,
      time: result.time_in_minutes,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0));

  const bestPaceRunners =
    (legStat.best_pace_runner_years as { runner: string; year: number }[]) ||
    [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Leg {legNumber} Details
        </h1>
        <p className="text-lg text-gray-600">
          Version {version} • {legStat.distance} miles • +
          {legStat.elevation_gain}ft elevation
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <StatCard
            icon={<Award className="w-6 h-6 text-yellow-600" />}
            label="Best Pace"
            value={formatPace(legStat.best_pace || 0)}
          />
          {bestPaceRunners.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              by {bestPaceRunners.map((r) => r.runner).join(", ")} in{" "}
              {bestPaceRunners.map((r) => r.year).join(", ")}
            </p>
          )}
        </div>
        <StatCard
          icon={<BarChart className="w-6 h-6 text-blue-600" />}
          label="Average Pace"
          value={formatPace(legStat.average_pace || 0)}
        />
        <StatCard
          icon={<Map className="w-6 h-6 text-green-600" />}
          label="Total Runs"
          value={legStat.runs?.toString() || "0"}
        />
        <StatCard
          icon={<Users className="w-6 h-6 text-indigo-600" />}
          label="Unique Runners"
          value={legStat.unique_runners?.toString() || "0"}
        />
      </div>

      {/* Performance Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Historical Performance
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" stroke="#6b7280" />
            <YAxis
              stroke="#6b7280"
              reversed
              tickFormatter={(tick) => formatPace(tick)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value: any, name: string, props: any) => {
                if (name === "pace") {
                  return [formatPace(value), `Pace (${props.payload.runner})`];
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
                fill: "white",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Results Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          All Results
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Runner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pace
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {legData
                .sort((a, b) => (b.year || 0) - (a.year || 0))
                .map((result, idx) => (
                  <tr
                    key={`${result.year}-${result.runner_name}`}
                    className={
                      idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50 hover:bg-gray-100"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hover:text-primary-600">
                      <Link
                        to="/runners/$runnerName"
                        params={{ runnerName: result.runner_name || "" }}
                      >
                        {result.runner_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.lap_time || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPace(result.pace || 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LegDetail;
