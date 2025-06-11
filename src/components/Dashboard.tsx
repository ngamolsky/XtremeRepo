import React from 'react';
import { Clock, Trophy, Users, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import StatCard from './StatCard';
import { useRelayData } from '../hooks/useRelayData';

const Dashboard: React.FC = () => {
  const { teamPerformance, legResults, placements, loading, error } = useRelayData();

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
        <h3 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h3>
        <p className="text-red-700">{error}</p>
        <p className="text-red-600 text-sm mt-2">
          Make sure your Supabase environment variables are configured correctly.
        </p>
      </div>
    );
  }

  // Calculate stats from real data
  const latestPerformance = teamPerformance[0];
  const bestPlacement = placements.length > 0 ? Math.min(...placements.map(p => p.overall_place || Infinity)) : 0;
  const averagePlacement = placements.length > 0 
    ? Math.round(placements.reduce((sum, p) => sum + (p.overall_place || 0), 0) / placements.length)
    : 0;

  // Prepare chart data
  const performanceChartData = teamPerformance
    .map(perf => ({
      year: perf.year,
      placement: perf.overall_place,
      totalTeams: perf.overall_teams,
    }))
    .reverse();

  const currentYear = latestPerformance?.year || new Date().getFullYear();
  const legPerformanceData = legResults
    .filter(result => result.year === currentYear)
    .map(result => ({
      leg: `Leg ${result.leg_number}`,
      time: result.lap_time ? parseTimeToMinutes(result.lap_time) : 0,
      runner: result.runner || 'Unknown',
    }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Performance Dashboard</h1>
        <p className="text-lg text-gray-600">Track your relay race journey and achievements</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Races"
          value={placements.length}
          icon={Calendar}
          subtitle="Years of competition"
        />
        <StatCard
          title="Best Placement"
          value={bestPlacement > 0 ? `#${bestPlacement}` : 'N/A'}
          icon={Trophy}
          subtitle="All-time best finish"
          className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200"
        />
        <StatCard
          title="Latest Time"
          value={latestPerformance?.total_time || 'N/A'}
          icon={Clock}
          subtitle={`${latestPerformance?.year || 'No data'} race`}
        />
        <StatCard
          title="Avg Placement"
          value={averagePlacement > 0 ? `#${averagePlacement}` : 'N/A'}
          icon={TrendingUp}
          subtitle="Across all races"
          trend={latestPerformance?.improvement ? {
            value: latestPerformance.improvement,
            isPositive: latestPerformance.improvement > 0
          } : undefined}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Placement Trend */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Placement Trend Over Time</h3>
          {performanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" stroke="#6b7280" />
                <YAxis 
                  stroke="#6b7280" 
                  domain={['dataMin - 2', 'dataMax + 2']}
                  reversed
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => [
                    `#${value}`,
                    'Placement'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="placement" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No performance data available
            </div>
          )}
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
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string, props: any) => [
                    `${value.toFixed(1)} min`,
                    `Time (${props.payload.runner})`
                  ]}
                />
                <Bar 
                  dataKey="time" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
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
      {teamPerformance.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division Place</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Place</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Pace</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamPerformance.slice(0, 5).map((perf) => (
                  <tr key={perf.year} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{perf.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{perf.total_time || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.division_place && perf.division_teams ? `#${perf.division_place} of ${perf.division_teams}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {perf.overall_place && perf.overall_teams ? `#${perf.overall_place} of ${perf.overall_teams}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{perf.average_pace || 'N/A'}</td>
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

// Helper function to parse time strings to minutes
const parseTimeToMinutes = (timeString: string): number => {
  const parts = timeString.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + seconds / 60;
  }
  return 0;
};

export default Dashboard;