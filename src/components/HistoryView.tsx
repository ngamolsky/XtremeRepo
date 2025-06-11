import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Trophy, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useRelayData } from '../hooks/useRelayData';

const HistoryView: React.FC = () => {
  const { teamPerformance, legResults, placements, loading, error } = useRelayData();
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

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

  // Combine data by year
  const raceHistory = teamPerformance.map(perf => {
    const placement = placements.find(p => p.year === perf.year);
    const yearResults = legResults.filter(r => r.year === perf.year);
    
    return {
      year: perf.year,
      totalTime: perf.total_time,
      averagePace: perf.average_pace,
      divisionPlace: perf.division_place,
      divisionTeams: perf.division_teams,
      overallPlace: perf.overall_place,
      overallTeams: perf.overall_teams,
      improvement: perf.improvement,
      division: placement?.division || 'Unknown',
      bib: placement?.bib,
      legResults: yearResults.sort((a, b) => a.leg_number - b.leg_number)
    };
  });

  const toggleExpanded = (year: number) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  const getPlacementColor = (place: number, total: number) => {
    const percentage = place / total;
    if (percentage <= 0.1) return 'text-yellow-600 bg-yellow-50';
    if (percentage <= 0.25) return 'text-green-600 bg-green-50';
    if (percentage <= 0.5) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Race History</h1>
        <p className="text-lg text-gray-600">A complete timeline of our relay race journey</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{raceHistory.length}</h3>
          <p className="text-gray-600">Years Competed</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            #{Math.min(...raceHistory.map(r => r.overallPlace))}
          </h3>
          <p className="text-gray-600">Best Finish</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Clock className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {raceHistory.reduce((best, race) => {
              if (!best || race.totalTime < best) return race.totalTime;
              return best;
            }, '')}
          </h3>
          <p className="text-gray-600">Best Time</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {Math.round(raceHistory.reduce((sum, race) => sum + race.overallPlace, 0) / raceHistory.length)}
          </h3>
          <p className="text-gray-600">Avg Placement</p>
        </div>
      </div>

      {/* Race Timeline */}
      <div className="space-y-4">
        {raceHistory.map((race) => (
          <div key={race.year} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleExpanded(race.year)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    {race.year}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {race.year} Relay Race
                    </h3>
                    <p className="text-gray-600">
                      Division: {race.division} • Bib #{race.bib}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{race.totalTime}</p>
                    <p className="text-sm text-gray-600">Total Time</p>
                  </div>
                  <div className="text-center">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(race.overallPlace, race.overallTeams)}`}>
                      #{race.overallPlace} of {race.overallTeams}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Overall</p>
                  </div>
                  <div className="text-center">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(race.divisionPlace, race.divisionTeams)}`}>
                      #{race.divisionPlace} of {race.divisionTeams}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Division</p>
                  </div>
                  {expandedYear === race.year ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {race.improvement !== null && (
                <div className="mt-4 flex items-center">
                  <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    race.improvement > 0 ? 'text-green-700 bg-green-100' : 
                    race.improvement < 0 ? 'text-red-700 bg-red-100' : 
                    'text-gray-700 bg-gray-100'
                  }`}>
                    {race.improvement > 0 ? '+' : ''}{race.improvement} places vs previous year
                  </div>
                </div>
              )}
            </div>

            {expandedYear === race.year && (
              <div className="border-t border-gray-100 p-6 bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Leg-by-Leg Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {race.legResults.map((leg) => (
                    <div key={leg.leg_number} className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900">Leg {leg.leg_number}</h5>
                        <span className="text-lg font-bold text-blue-600">{leg.lap_time}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Runner: {leg.runner}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{leg.distance} miles</span>
                        <span>+{leg.elevation_gain} ft</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                    <p className="text-sm text-gray-600">Average Pace</p>
                    <p className="text-xl font-bold text-gray-900">{race.averagePace}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                    <p className="text-sm text-gray-600">Total Distance</p>
                    <p className="text-xl font-bold text-gray-900">
                      {race.legResults.reduce((sum, leg) => sum + leg.distance, 0).toFixed(1)} mi
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                    <p className="text-sm text-gray-600">Total Elevation</p>
                    <p className="text-xl font-bold text-gray-900">
                      {race.legResults.reduce((sum, leg) => sum + leg.elevation_gain, 0)} ft
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;