import React from 'react';
import { Clock, Trophy, Users, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import StatCard from './StatCard';
import { useRelayData } from '../hooks/useRelayData';

const Dashboard: React.FC = () => {
  const { teamPerformance, legResults, placements, loading, error } = useRelayData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading data: {error}</p>
      </div>
    );
  }

  // Calculate stats from real data
  const currentYear = new Date().getFullYear();
  const latestPerformance = teamPerformance[0];
  const bestPlacement = Math.min(...placements.map(p => p.overall_place || Infinity));
  const averagePlacement = placements.reduce((sum, p) => sum + (p.overall_place || 0), 0) / placements.length;

  // Prepare chart data
  const performanceChartData = teamPerformance.map(perf => ({
    year: perf.year,
    placement: perf.overall_place,
    totalTeams: perf.overall_teams,
    time: perf.total_time ? parseFloat(perf.total_time.split(':')[0]) + parseFloat(perf.total_time.split(':')[1]) / 60 : 0
  })).reverse();

  const legPerformanceData = legResults
    .filter(result => result.year === (latestPerformance?.year || currentYear))
    .map(result => ({
      leg: `Leg ${result.leg_number}`,
      time: result.lap_time ? parseFloat(result.lap_time.split(':')[0]) + parseFloat(result.lap_time.split(':')[1]) / 60 : 0,
      runner: result.runner,
      distance: result.distance
    }));

  return (
    <div className="space-y-8">
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
          value={`#${bestPlacement}`}
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
          value={`#${Math.round(averagePlacement)}`}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Placement Trend</h3>
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
                  name === 'placement' ? `#${value}` : value,
                  name === 'placement' ? 'Placement' : 'Total Teams'
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
        </div>

        {/* Leg Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Latest Race - Leg Performance ({latestPerformance?.year || 'No data'})
          </h3>
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
        </div>
      </div>

      {/* Recent Performance Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{perf.total_time}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    #{perf.division_place} of {perf.division_teams}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    #{perf.overall_place} of {perf.overall_teams}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{perf.average_pace}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;