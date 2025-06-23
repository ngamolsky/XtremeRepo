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
import { formatPace } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, description }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{label}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const {
    data: { yearlySummary, results },
    loading,
    error,
  } = useRelayData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive">Connection Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <p className="text-muted-foreground text-sm mt-2">
            Make sure your Supabase environment variables are configured
            correctly.
          </p>
        </CardContent>
      </Card>
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
      pace: result.pace ? formatPace(result.pace) : null,
      runner: result.runner_name || "Missing Runner Name",
    }));

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          Team Performance Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Track your relay race journey and achievements
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Total Races"
          value={yearlySummary.length.toString()}
          description="Completed race seasons"
        />
        <StatCard
          icon={<Trophy className="w-6 h-6" />}
          label="Best Percentile"
          value={
            bestOverallPercentile !== null
              ? `Top ${Math.round(bestOverallPercentile)}%`
              : "N/A"
          }
          description="Best overall performance"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Latest Time"
          value={latestPerformance?.total_time?.toString() || "N/A"}
          description={`Race ${latestPerformance?.year || "N/A"}`}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Avg Percentile"
          value={
            averageOverallPercentile !== null
              ? `Top ${Math.round(averageOverallPercentile)}%`
              : "N/A"
          }
          description="Average performance"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Placement Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Percentile Trend</CardTitle>
            <CardDescription>
              Lower percentile indicates better performance (e.g., 10% means top
              10% of teams)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={performanceChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    domain={[0, 100]}
                    reversed={true}
                    label={{
                      value: "Percentile",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "hsl(var(--muted-foreground))" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="division"
                    name="Division"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
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
          </CardContent>
        </Card>

        {/* Leg Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Race - Leg Performance ({currentYear})</CardTitle>
            <CardDescription>
              Individual leg times and performance by runner
            </CardDescription>
          </CardHeader>
          <CardContent>
            {legPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={legPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="leg" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(_value: any, _name: any, props: any) => {
                      return [
                        `${props?.payload?.pace}`,
                        `Time (${props?.payload?.runner || "Unknown Runner"})`,
                      ];
                    }}
                  />
                  <Bar dataKey="time" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No leg performance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Performance Summary */}
      {yearlySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Year-over-Year Performance</CardTitle>
            <CardDescription>
              Historical performance data and team placements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Avg Pace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Overall Placement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Division Placement
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {yearlySummary.map((perf, idx) => (
                    <tr
                      key={idx}
                      className={
                        idx % 2 === 0
                          ? "bg-background"
                          : "bg-muted/50 hover:bg-muted"
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        <Badge variant="outline">{perf.year}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {perf.total_time?.toString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {perf.average_pace?.toString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {perf.overall_place} of {perf.overall_teams}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {perf.division_place} of {perf.division_teams} ({perf.division})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
