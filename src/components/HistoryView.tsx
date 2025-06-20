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

const HistoryView: React.FC = () => {
  const { teamPerformance, legResults, placements, loading, error } =
    useRelayData();
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

  // Helper to compute percentile (lower is better)
  const getPercentile = (
    place?: number | null,
    teams?: number | null
  ): string => {
    if (!place || !teams || teams < 1) return "N/A";
    const percentile = (place / teams) * 100;
    return `Top ${Math.round(percentile)}%`;
  };

  // Combine data by year
  const raceHistory = teamPerformance
    .map((perf) => {
      const placement = placements.find((p) => p.year === perf.year);
      const yearResults = legResults.filter((r) => r.year === perf.year);

      return {
        year: perf.year,
        totalTime: perf.total_time,
        averagePace: perf.average_pace,
        divisionPlace: perf.division_place,
        divisionTeams: perf.division_teams,
        overallPlace: perf.overall_place,
        overallTeams: perf.overall_teams,
        improvement: perf.improvement,
        division: placement?.division || "Unknown",
        bib: placement?.bib,
        legResults: yearResults.sort((a, b) => a.leg_number - b.leg_number),
      };
    })
    .filter((race) => race.year); // Filter out null years

  // Best and average percentiles
  const bestPercentile =
    raceHistory.length > 0
      ? Math.min(
          ...raceHistory.map((r) =>
            r.overallPlace && r.overallTeams
              ? (r.overallPlace / r.overallTeams) * 100
              : Infinity
          )
        )
      : null;
  const averagePercentile =
    raceHistory.length > 0
      ? Math.round(
          raceHistory.reduce((sum, r) => {
            if (r.overallPlace && r.overallTeams) {
              return sum + (r.overallPlace / r.overallTeams) * 100;
            }
            return sum;
          }, 0) / raceHistory.length
        )
      : null;

  // For each year, determine the dominant leg version (most common among its legs)
  const getDominantVersion = (yearResults: any[]) => {
    const versionCounts: Record<number, number> = {};
    for (const leg of yearResults) {
      if (leg.leg_version) {
        versionCounts[leg.leg_version] =
          (versionCounts[leg.leg_version] || 0) + 1;
      }
    }
    const entries = Object.entries(versionCounts);
    if (entries.length === 0) return null;
    return Number(entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0]);
  };

  // Build a list of {race, dominantVersion}
  const raceHistoryWithVersion = raceHistory.map((race) => ({
    ...race,
    dominantVersion: getDominantVersion(race.legResults),
  }));

  const toggleExpanded = (year: number) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  const getPlacementColor = (place: number | null, total: number | null) => {
    if (!place || !total) return "text-gray-600 bg-gray-50";
    const percentage = place / total;
    if (percentage <= 0.1) return "text-yellow-600 bg-yellow-50";
    if (percentage <= 0.25) return "text-green-600 bg-green-50";
    if (percentage <= 0.5) return "text-blue-600 bg-blue-50";
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
            {bestPercentile !== null && bestPercentile !== Infinity
              ? `Top ${Math.round(bestPercentile)}%`
              : "N/A"}
          </h3>
          <p className="text-gray-600">Best Percentile</p>
        </div>
        <div className="card p-6 text-center">
          <Clock className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {raceHistory.length > 0 ? getBestTime(raceHistory) : "N/A"}
          </h3>
          <p className="text-gray-600">Best Time</p>
        </div>
        <div className="card p-6 text-center">
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {averagePercentile !== null ? `Top ${averagePercentile}%` : "N/A"}
          </h3>
          <p className="text-gray-600">Avg Percentile</p>
        </div>
      </div>

      {/* Race Timeline */}
      {raceHistoryWithVersion.length > 0 ? (
        <div className="space-y-4">
          {raceHistoryWithVersion.map((race, idx) => {
            const prev = raceHistoryWithVersion[idx - 1];
            const versionChanged =
              idx > 0 && race.dominantVersion !== prev.dominantVersion;
            return (
              <React.Fragment key={race.year}>
                {versionChanged && (
                  <div className="flex items-center my-6">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="mx-4 text-xs text-gray-500 font-semibold uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-full">
                      Legs changed to Version {prev.dominantVersion}
                    </span>
                    <div className="flex-grow border-t border-gray-300"></div>
                  </div>
                )}
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
                            {(race.totalTime as string) || "N/A"}
                          </p>
                          <p className="text-sm text-gray-600">Total Time</p>
                        </div>
                        {race.overallPlace && race.overallTeams && (
                          <div className="text-center">
                            <div
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(
                                race.overallPlace,
                                race.overallTeams
                              )}`}
                            >
                              {getPercentile(
                                race.overallPlace,
                                race.overallTeams
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Overall
                            </p>
                          </div>
                        )}
                        {race.divisionPlace && race.divisionTeams && (
                          <div className="text-center">
                            <div
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlacementColor(
                                race.divisionPlace,
                                race.divisionTeams
                              )}`}
                            >
                              {getPercentile(
                                race.divisionPlace,
                                race.divisionTeams
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Division
                            </p>
                          </div>
                        )}
                        {expandedYear === race.year ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {race.improvement !== null &&
                      race.improvement !== undefined && (
                        <div className="mt-4 flex items-center">
                          <div
                            className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              race.improvement > 0
                                ? "text-green-700 bg-green-100"
                                : race.improvement < 0
                                ? "text-red-700 bg-red-100"
                                : "text-gray-700 bg-gray-100"
                            }`}
                          >
                            {race.improvement > 0 ? "+" : ""}
                            {race.improvement} places vs previous year
                          </div>
                        </div>
                      )}
                  </div>

                  {expandedYear === race.year && (
                    <div className="border-t border-gray-100 p-6 bg-gray-50">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Leg-by-Leg Breakdown
                      </h4>
                      {race.legResults.length > 0 ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {race.legResults.map((leg) => (
                              <div
                                key={leg.leg_number}
                                className="bg-white rounded-lg p-4 border border-gray-200"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-semibold text-gray-900">
                                    Leg {leg.leg_number}
                                  </h5>
                                  <span className="text-lg font-bold text-primary-600">
                                    {leg.lap_time || "N/A"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                  Runner: {leg.runners?.name || "Unknown"}
                                </p>
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>
                                    {leg.leg_definitions?.distance || 0} miles
                                  </span>
                                  <span>
                                    +{leg.leg_definitions?.elevation_gain || 0}{" "}
                                    ft
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                              <p className="text-sm text-gray-600">
                                Average Pace
                              </p>
                              <p className="text-xl font-bold text-gray-900">
                                {race.averagePace || "N/A"}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                              <p className="text-sm text-gray-600">
                                Total Distance
                              </p>
                              <p className="text-xl font-bold text-gray-900">
                                {race.legResults
                                  .reduce(
                                    (sum, leg) =>
                                      sum +
                                      (leg.leg_definitions?.distance || 0),
                                    0
                                  )
                                  .toFixed(1)}{" "}
                                mi
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                              <p className="text-sm text-gray-600">
                                Total Elevation
                              </p>
                              <p className="text-xl font-bold text-gray-900">
                                {race.legResults.reduce(
                                  (sum, leg) =>
                                    sum +
                                    (leg.leg_definitions?.elevation_gain || 0),
                                  0
                                )}{" "}
                                ft
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No leg details available for this race
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No race history found
          </h3>
          <p className="text-gray-600">
            Race history will appear here once data is available
          </p>
        </div>
      )}
    </div>
  );
};

// Helper functions
const getBestTime = (races: any[]): string => {
  const times = races.map((r) => r.totalTime).filter(Boolean);
  if (times.length === 0) return "N/A";

  // Simple string comparison should work for HH:MM:SS format
  return times.reduce((best, current) => (current < best ? current : best));
};

export default HistoryView;
