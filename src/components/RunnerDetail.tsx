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

const RunnerDetail: React.FC = () => {
  const { runnerName } = useParams({ from: "/runners/$runnerName" });
  const {
    data: { runnerStats, results },
    loading,
    error,
  } = useRelayData();

  const runnerStat = runnerStats.find((r) => r.runner_name === runnerName);
  const runnerResults = results.filter((r) => r.runner_name === runnerName);

  const runnerAuthId =
    runnerResults.length > 0 ? runnerResults[0].auth_user_id : undefined;
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
          {runnerStat.unique_years}{" "}
          {runnerStat.unique_years === 1 ? "year" : "years"} •{" "}
          {runnerStat.total_races}{" "}
          {runnerStat.total_races === 1 ? "run" : "runs"}
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
                  return [formatPace(value), `Pace (Leg ${props.payload.leg})`];
                }
                if (name === "time") {
                  return [`${value.toFixed(2)} mins`, "Time"];
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
              {runnerResults
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
