import { useParams } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
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
import { formatPace, parseTimeToMinutes } from "../lib/utils";
import { LegPill } from "./LegPill";

const RunnerDetail: React.FC = () => {
  const { runnerName } = useParams({ from: "/runners/$runnerName" });
  const { legResults, loading, error } = useRelayData();

  const runnerData = legResults.filter(
    (result) => result.runners?.name === runnerName
  );

  const runnerAuthId =
    runnerData.length > 0 ? runnerData[0].runners?.auth_user_id : undefined;
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

  if (runnerData.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No data found
        </h3>
        <p className="text-gray-600">No results found for {runnerName}</p>
      </div>
    );
  }

  // Prepare data for the performance chart
  const performanceData = runnerData
    .filter((result) => result.lap_time && result.leg_definitions?.distance)
    .map((result) => ({
      year: result.year,
      leg: result.leg_number,
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
    totalRuns: runnerData.length,
    uniqueLegs: new Set(runnerData.map((r) => r.leg_number)).size,
    years: new Set(runnerData.map((r) => r.year)).size,
  };

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
          {stats.years} {stats.years === 1 ? "year" : "years"} •{" "}
          {stats.totalRuns} {stats.totalRuns === 1 ? "run" : "runs"}
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
            Unique Legs
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats.uniqueLegs}
          </p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance History
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
              formatter={(value: any, name: string, props: any) => {
                if (name === "pace") {
                  return [formatPace(value), `Pace (Leg ${props.payload.leg})`];
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runnerData
                .sort((a, b) => b.year - a.year)
                .map((result, idx) => (
                  <tr
                    key={`${result.year}-${result.leg_number}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <LegPill
                        leg={result.leg_number}
                        version={result.leg_version}
                        className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                      >
                        {result.leg_number} (v{result.leg_version})
                      </LegPill>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.leg_definitions?.distance
                        ? `${result.leg_definitions?.distance} mi`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.leg_definitions?.elevation_gain
                        ? `+${result.leg_definitions?.elevation_gain} ft`
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

export default RunnerDetail;
