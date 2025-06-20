import { Calendar, Clock, TrendingUp, Trophy } from "lucide-react";
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
import { StatCard } from "./StatCard";

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
  const legPerformanceData = results
    .filter((result) => result.year === currentYear)
    .map((result) => ({
      leg: `Leg ${result.leg_number}`,
      time: result.time_in_minutes,
      runner: result.runner_name || "Missing Runner Name",
    }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Team Performance Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Track your relay race journey and achievements
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
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#6B7280" }}
                  tickLine={{ stroke: "#6B7280" }}
                />
                <YAxis
                  tick={{ fill: "#6B7280" }}
                  tickLine={{ stroke: "#6B7280" }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  domain={[0, 100]}
                  reversed={true}
                  label={{
                    value: "Percentile",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#6B7280" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "none",
                    borderRadius: "0.375rem",
                    color: "#F9FAFB",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                />
                <Legend />
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
              <BarChart data={legPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="leg" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    return [
                      `${value.toFixed(1)} min`,
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
