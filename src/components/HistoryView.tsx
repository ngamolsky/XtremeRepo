import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Trophy,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { Tables } from "../types/database.types";

const HistoryView: React.FC = () => {
  const {
    data: { yearlySummary, results },
    loading,
    error,
  } = useRelayData();
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

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

  const raceHistory = yearlySummary.map((race) => {
    const yearResults = results.filter((r) => r.year === race.year);
    return {
      ...race,
      legResults: yearResults.sort(
        (a, b) => (a.leg_number || 0) - (b.leg_number || 0)
      ),
    };
  });

  const bestOverallPercentile =
    raceHistory.length > 0
      ? Math.min(
          ...raceHistory
            .map((r) => r.overall_percentile)
            .filter((p): p is number => p !== null)
        )
      : null;
  const averageOverallPercentile =
    raceHistory.length > 0
      ? raceHistory.reduce((sum, r) => sum + (r.overall_percentile || 0), 0) /
        raceHistory.length
      : null;

  const bestTime =
    raceHistory.length > 0
      ? (raceHistory
          .reduce(
            (min, r) =>
              r.total_time && r.total_time < min ? r.total_time : min,
            raceHistory[0].total_time || "99:99:99"
          )
          ?.toString() ?? "N/A")
      : "N/A";

  const toggleExpanded = (year: number) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  const getPlacementColor = (percentile: number | null) => {
    if (percentile === null) return "text-gray-600 bg-gray-50";
    if (percentile <= 10) return "text-yellow-600 bg-yellow-50";
    if (percentile <= 25) return "text-green-600 bg-green-50";
    if (percentile <= 50) return "text-blue-600 bg-blue-50";
    return "text-gray-600 bg-gray-50";
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Race History</h1>
        <p className="text-lg text-gray-600">
          A complete timeline of our relay race journey
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 text-center">
          <Calendar className="w-8 h-8 text-primary-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {raceHistory.length}
          </h3>
          <p className="text-gray-600">Years Competed</p>
        </div>
        <div className="card p-6 text-center">
          <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {bestOverallPercentile !== null
              ? `Top ${Math.round(bestOverallPercentile)}%`
              : "N/A"}
          </h3>
          <p className="text-gray-600">Best Percentile</p>
        </div>
        <div className="card p-6 text-center">
          <Clock className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{bestTime}</h3>
          <p className="text-gray-600">Best Time</p>
        </div>
        <div className="card p-6 text-center">
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {averageOverallPercentile !== null
              ? `Top ${Math.round(averageOverallPercentile)}%`
              : "N/A"}
          </h3>
          <p className="text-gray-600">Avg Percentile</p>
        </div>
      </div>

      {/* Race Timeline */}
      {raceHistory.length > 0 ? (
        <div className="space-y-4">
          {raceHistory.map((race) => (
            <div key={race.year} className="card overflow-hidden">
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(race.year!)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                      {race.year}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {race.year} Relay Race
                      </h3>
                      <p className="text-gray-600">
                        Division: {race.division}{" "}
                        {race.bib && `• Bib #${race.bib}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {race.total_time?.toString() ?? "N/A"}
                      </p>
                      <p className="text-sm text-gray-600">Total Time</p>
                    </div>
                    {race.overall_percentile !== null && (
                      <div className="text-center">
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(
                            race.overall_percentile
                          )}`}
                        >
                          Top {Math.round(race.overall_percentile)}%
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Overall</p>
                      </div>
                    )}
                    {race.division_percentile !== null && (
                      <div className="text-center">
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(
                            race.division_percentile
                          )}`}
                        >
                          Top {Math.round(race.division_percentile ?? 0)}%
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Division</p>
                      </div>
                    )}
                    {expandedYear === race.year ? (
                      <ChevronUp className="w-6 h-6 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {expandedYear === race.year && (
                <div className="p-6 bg-gray-50/50">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">
                    Leg Results
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Leg
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Runner
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Pace
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Distance
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                            Gain
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {race.legResults.map(
                          (leg: Tables<"v_results_with_pace">) => (
                            <tr key={leg.leg_number}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">
                                {leg.leg_number} (v{leg.leg_version})
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                {leg.runner_name}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                {leg.lap_time || "N/A"}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                {formatPace(leg.pace || 0)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                {leg.distance ? `${leg.distance} mi` : "N/A"}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                {leg.elevation_gain
                                  ? `+${leg.elevation_gain} ft`
                                  : "N/A"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No race history found
          </h3>
          <p className="text-gray-600">
            Race data will appear here once it's available
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryView;
