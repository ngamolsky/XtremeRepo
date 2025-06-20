import { useParams } from "@tanstack/react-router";
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
import { formatPace, parseTimeToMinutes } from "../lib/utils";

const LegDetail: React.FC = () => {
  const { legNumber, version } = useParams({
    from: "/legs/$legNumber/$version",
  });
  const { legResults, loading, error } = useRelayData();

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
  const legData = legResults.filter(
    (result) =>
      result.leg_number === Number(legNumber) &&
      result.leg_version === Number(version)
  );

  if (legData.length === 0) {
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

  // Get leg details from the first result
  const legDetails = legData[0];

  // Prepare data for the performance chart
  const performanceData = legData
    .filter((result) => result.lap_time && result.leg_definitions?.distance)
    .map((result) => ({
      year: result.year,
      runner: result.runners?.name,
      pace: result.lap_time
        ? parseTimeToMinutes(result.lap_time) /
          (result.leg_definitions?.distance || 1)
        : null,
      time: result.lap_time ? parseTimeToMinutes(result.lap_time) : null,
    }))
    .sort((a, b) => a.year - b.year);

  // Calculate statistics
  const times = performanceData
    .map((d) => d.time)
    .filter((t): t is number => t !== null);
  const paces = performanceData
    .map((d) => d.pace)
    .filter((p): p is number => p !== null);

  const stats = {
    bestPace: Math.min(...paces),
    avgPace: paces.reduce((a, b) => a + b, 0) / paces.length,
    bestTime: Math.min(...times),
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    totalRuns: legData.length,
    uniqueRunners: new Set(legData.map((r) => r.runners?.name)).size,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Leg {legNumber} Details
        </h1>
        <p className="text-lg text-gray-600">
          Version {version} • {legDetails.leg_definitions?.distance} miles • +
          {legDetails.leg_definitions?.elevation_gain}ft elevation
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Best Pace
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatPace(stats.bestPace)}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Average Pace
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatPace(stats.avgPace)}
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Total Runs
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats.totalRuns}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            by {stats.uniqueRunners} runners
          </p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Historical Performance
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value: any, name: string) => {
                if (name === "pace") {
                  return [formatPace(value), "Pace"];
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
                .sort((a, b) => b.year - a.year)
                .map((result, idx) => (
                  <tr
                    key={`${result.year}-${result.runners?.name}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.runners?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.lap_time || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.lap_time && result.leg_definitions?.distance
                        ? formatPace(
                            parseTimeToMinutes(result.lap_time) /
                              result.leg_definitions?.distance
                          )
                        : "N/A"}
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
