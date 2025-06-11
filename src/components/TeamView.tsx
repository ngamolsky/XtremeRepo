import React from 'react';
import { Users, Award, Clock, Target } from 'lucide-react';
import { useRelayData } from '../hooks/useRelayData';

const TeamView: React.FC = () => {
  const { legResults, loading, error } = useRelayData();

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

  // Group results by runner and calculate stats
  const runnerStats = legResults.reduce((acc, result) => {
    if (!result.runner || result.runner === 'Unknown') return acc;
    
    if (!acc[result.runner]) {
      acc[result.runner] = {
        name: result.runner,
        races: [],
        totalRaces: 0,
        bestTime: Infinity,
        totalTime: 0,
        legs: new Set()
      };
    }
    
    acc[result.runner].races.push(result);
    acc[result.runner].totalRaces++;
    acc[result.runner].legs.add(result.leg_number);
    
    if (result.lap_time) {
      const timeInMinutes = parseFloat(result.lap_time.split(':')[0]) * 60 + parseFloat(result.lap_time.split(':')[1]);
      acc[result.runner].totalTime += timeInMinutes;
      if (timeInMinutes < acc[result.runner].bestTime) {
        acc[result.runner].bestTime = timeInMinutes;
      }
    }
    
    return acc;
  }, {} as Record<string, any>);

  const runners = Object.values(runnerStats).map((runner: any) => ({
    ...runner,
    averageTime: runner.totalTime / runner.totalRaces,
    bestTimeFormatted: runner.bestTime === Infinity ? 'N/A' : `${Math.floor(runner.bestTime / 60)}:${(runner.bestTime % 60).toFixed(0).padStart(2, '0')}`,
    averageTimeFormatted: `${Math.floor(runner.averageTime / 60)}:${(runner.averageTime % 60).toFixed(0).padStart(2, '0')}`,
    legsRun: Array.from(runner.legs).sort((a, b) => a - b)
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Members</h1>
        <p className="text-lg text-gray-600">Meet the athletes who make our relay team great</p>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Users className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{runners.length}</h3>
          <p className="text-gray-600">Active Runners</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Target className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{legResults.length}</h3>
          <p className="text-gray-600">Total Legs Run</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Award className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{new Set(legResults.map(r => r.year)).size}</h3>
          <p className="text-gray-600">Years Competed</p>
        </div>
      </div>

      {/* Runner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {runners.map((runner) => (
          <div key={runner.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {runner.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">{runner.name}</h3>
                <p className="text-sm text-gray-600">Team Runner</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Races Participated</span>
                <span className="font-semibold text-gray-900">{runner.totalRaces}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Best Time</span>
                <span className="font-semibold text-gray-900">{runner.bestTimeFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Average Time</span>
                <span className="font-semibold text-gray-900">{runner.averageTimeFormatted}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Legs Run</span>
                <div className="flex flex-wrap gap-1">
                  {runner.legsRun.map((leg: number) => (
                    <span key={leg} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {leg}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Performance */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Races</h4>
              <div className="space-y-1">
                {runner.races.slice(0, 3).map((race: any, index: number) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-gray-600">{race.year} - Leg {race.leg_number}</span>
                    <span className="text-gray-900">{race.lap_time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Runner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Races</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Legs</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runners.map((runner) => (
                <tr key={runner.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                        {runner.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{runner.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{runner.totalRaces}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{runner.bestTimeFormatted}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{runner.averageTimeFormatted}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {runner.legsRun.map((leg: number) => (
                        <span key={leg} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {leg}
                        </span>
                      ))}
                    </div>
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

export default TeamView;