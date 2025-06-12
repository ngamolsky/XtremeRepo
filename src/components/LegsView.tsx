import React from "react";
import { useRelayData } from "../hooks/useRelayData";

// Helper to format pace
const formatPace = (pace: number): string => {
  if (!pace || pace === Infinity || isNaN(pace)) return "N/A";
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
};

const LegsView: React.FC = () => {
  const { legResults, loading, error } = useRelayData();

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

  // Group by leg number and version
  const legStats: Record<string, any> = {};
  for (const result of legResults) {
    if (!result.leg_number || !result.leg_version) continue;
    const key = `${result.leg_number}-${result.leg_version}`;
    if (!legStats[key]) {
      legStats[key] = {
        leg: result.leg_number,
        version: result.leg_version,
        distance: result.distance,
        runs: 0,
        totalTime: 0,
        totalDistance: 0,
        bestPace: Infinity,
        runners: new Set<string>(),
        elevation_gain: result.elevation_gain,
      };
    }
    if (result.lap_time && result.distance && result.distance > 0) {
      const timeInMinutes = parseTimeToMinutes(result.lap_time);
      const pace = timeInMinutes / result.distance;
      legStats[key].runs++;
      legStats[key].totalTime += timeInMinutes;
      legStats[key].totalDistance += result.distance;
      if (pace < legStats[key].bestPace) {
        legStats[key].bestPace = pace;
      }
    }
    if (result.runner) {
      legStats[key].runners.add(result.runner);
    }
  }

  const legs = Object.values(legStats)
    .map((leg: any) => {
      // Find runner(s) and year(s) with best pace
      let bestPaceRunnerYears: { runner: string; year: number }[] = [];
      if (
        leg.bestPace !== null &&
        leg.bestPace !== undefined &&
        leg.bestPace !== Infinity
      ) {
        bestPaceRunnerYears = legResults
          .filter(
            (r: any) =>
              r.leg_number === leg.leg &&
              r.leg_version === leg.version &&
              r.lap_time &&
              r.distance &&
              Math.abs(
                parseTimeToMinutes(r.lap_time) / r.distance - leg.bestPace
              ) < 0.01
          )
          .map((r: any) => ({ runner: r.runner, year: r.year }))
          .filter(
            (
              item: { runner: string; year: number },
              idx: number,
              arr: { runner: string; year: number }[]
            ) =>
              arr.findIndex(
                (x: { runner: string; year: number }) =>
                  x.runner === item.runner && x.year === item.year
              ) === idx
          )
          .sort(
            (
              a: { runner: string; year: number },
              b: { runner: string; year: number }
            ) => a.runner.localeCompare(b.runner) || a.year - b.year
          );
      }
      return {
        ...leg,
        averagePace:
          leg.totalDistance > 0 ? leg.totalTime / leg.totalDistance : null,
        bestPace: leg.bestPace !== Infinity ? leg.bestPace : null,
        bestPaceRunnerYears,
        runners: Array.from(leg.runners).sort(),
      };
    })
    .sort((a, b) => a.leg - b.leg || b.version - a.version);

  const legsV2 = legs.filter((leg: any) => leg.version === 2);
  const legsV1 = legs.filter((leg: any) => leg.version === 1);

  // Compute year ranges for each version
  const versionYears: Record<number, { min: number; max: number }> = {};
  for (const result of legResults) {
    if (!result.leg_version || !result.year) continue;
    const version = result.leg_version;
    const year = Number(result.year);
    if (!versionYears[version]) {
      versionYears[version] = { min: year, max: year };
    } else {
      if (year < versionYears[version].min) versionYears[version].min = year;
      if (year > versionYears[version].max) versionYears[version].max = year;
    }
  }

  // Helper to label version sections
  const getVersionLabel = (version: number) => {
    const years = versionYears[version];
    if (!years) return `Version ${version}`;
    if (years.min === years.max) return `Legs (${years.min}+)`;
    return `Legs (${years.min}–${years.max})`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Leg Performance Breakdown
        </h1>
        <p className="text-lg text-gray-600">
          See stats for each leg across all years and runners
        </p>
      </div>
      <div className="card p-6">
        {legsV2.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {getVersionLabel(2)}
            </h3>
            <div className="overflow-x-auto mb-8">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Runs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Pace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Best Pace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Runners
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {legsV2.map((leg) => (
                    <tr key={`${leg.leg}-${leg.version}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {leg.leg}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.runs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.distance ? `${leg.distance} mi` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.elevation_gain !== undefined
                          ? `+${leg.elevation_gain} ft`
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPace(leg.averagePace)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPace(leg.bestPace)}
                        {leg.bestPaceRunnerYears &&
                          leg.bestPaceRunnerYears.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {leg.bestPaceRunnerYears.map(
                                ({
                                  runner,
                                  year,
                                }: {
                                  runner: string;
                                  year: number;
                                }) => (
                                  <span
                                    key={`${runner}-${year}`}
                                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                  >
                                    {runner} ({year})
                                  </span>
                                )
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {leg.runners.map((runner: string) => (
                            <span
                              key={runner}
                              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                            >
                              {runner}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {legsV1.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {getVersionLabel(1)}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Runs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Pace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Best Pace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Runners
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {legsV1.map((leg) => (
                    <tr key={`${leg.leg}-${leg.version}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {leg.leg}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.runs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.distance ? `${leg.distance} mi` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.elevation_gain !== undefined
                          ? `+${leg.elevation_gain} ft`
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPace(leg.averagePace)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPace(leg.bestPace)}
                        {leg.bestPaceRunnerYears &&
                          leg.bestPaceRunnerYears.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {leg.bestPaceRunnerYears.map(
                                ({
                                  runner,
                                  year,
                                }: {
                                  runner: string;
                                  year: number;
                                }) => (
                                  <span
                                    key={`${runner}-${year}`}
                                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                  >
                                    {runner} ({year})
                                  </span>
                                )
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {leg.runners.map((runner: string) => (
                            <span
                              key={runner}
                              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                            >
                              {runner}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Helper function to parse time strings to minutes
const parseTimeToMinutes = (timeString: string): number => {
  const parts = timeString.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + seconds / 60;
  }
  return 0;
};

export default LegsView;
