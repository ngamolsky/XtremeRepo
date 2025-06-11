import { Award, Target, User, Users } from "lucide-react";
import React from "react";
import { useRelayData } from "../hooks/useRelayData";

const TeamView: React.FC = () => {
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

  // Group results by runner and calculate stats
  const runnerStats = legResults.reduce((acc, result) => {
    const runnerName = result.runner || "Unknown";
    if (runnerName === "Unknown") return acc;

    if (!acc[runnerName]) {
      acc[runnerName] = {
        name: runnerName,
        races: [],
        totalRaces: 0,
        bestTime: Infinity,
        totalTimeMinutes: 0,
        totalDistance: 0,
        bestPace: Infinity,
        legs: new Set<number>(),
      };
    }

    acc[runnerName].races.push(result);
    acc[runnerName].totalRaces++;
    acc[runnerName].legs.add(result.leg_number);

    if (result.lap_time && result.distance && result.distance > 0) {
      const timeInMinutes = parseTimeToMinutes(result.lap_time);
      acc[runnerName].totalTimeMinutes += timeInMinutes;
      acc[runnerName].totalDistance += result.distance;
      const pace = timeInMinutes / result.distance;
      if (pace < acc[runnerName].bestPace) {
        acc[runnerName].bestPace = pace;
      }
      if (timeInMinutes < acc[runnerName].bestTime) {
        acc[runnerName].bestTime = timeInMinutes;
      }
    }

    return acc;
  }, {} as Record<string, any>);

  const formatPace = (pace: number): string => {
    if (!pace || pace === Infinity || isNaN(pace)) return "N/A";
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
  };

  const runners = Object.values(runnerStats)
    .map((runner: any) => {
      const averagePace =
        runner.totalDistance > 0
          ? runner.totalTimeMinutes / runner.totalDistance
          : null;
      const bestPace = runner.bestPace !== Infinity ? runner.bestPace : null;
      const bestPaceFormatted = formatPace(runner.bestPace);
      const averagePaceFormatted = formatPace(
        runner.totalDistance > 0
          ? runner.totalTimeMinutes / runner.totalDistance
          : NaN
      );
      const legsRun = Array.from(runner.legs).sort((a: any, b: any) => a - b);
      // Find leg(s) where best pace was achieved
      let bestPaceLegs: number[] = [];
      if (bestPace !== null) {
        bestPaceLegs = runner.races
          .filter((race: any) => {
            if (race.lap_time && race.distance && race.distance > 0) {
              const pace = parseTimeToMinutes(race.lap_time) / race.distance;
              return Math.abs(pace - bestPace) < 0.01;
            }
            return false;
          })
          .map((race: any) => race.leg_number)
          .filter(
            (leg: number, idx: number, arr: number[]) =>
              arr.indexOf(leg) === idx
          )
          .sort((a: number, b: number) => a - b);
      }
      return {
        ...runner,
        averagePace,
        bestPace,
        bestPaceFormatted,
        averagePaceFormatted,
        legsRun,
        bestPaceLegs,
      };
    })
    .sort((a: any, b: any) => b.totalRaces - a.totalRaces);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Members</h1>
        <p className="text-lg text-gray-600">
          Meet the athletes who make our relay team great
        </p>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <Users className="w-8 h-8 text-primary-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">{runners.length}</h3>
          <p className="text-gray-600">Active Runners</p>
        </div>
        <div className="card p-6 text-center">
          <Target className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {legResults.length}
          </h3>
          <p className="text-gray-600">Total Legs Run</p>
        </div>
        <div className="card p-6 text-center">
          <Award className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {new Set(legResults.map((r) => r.year)).size}
          </h3>
          <p className="text-gray-600">Years Competed</p>
        </div>
      </div>

      {/* Runner Cards */}
      {runners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runners.map((runner) => (
            <div
              key={runner.name}
              className="card p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(runner.name)}
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {runner.name}
                  </h3>
                  <p className="text-sm text-gray-600">Team Runner</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Races Participated
                  </span>
                  <span className="font-semibold text-gray-900">
                    {runner.totalRaces}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Best Pace</span>
                  <span className="font-semibold text-gray-900 flex items-center gap-2">
                    {runner.bestPaceFormatted}
                    {runner.bestPaceLegs && runner.bestPaceLegs.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {runner.bestPaceLegs.map((leg: number) => (
                          <span
                            key={leg}
                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                          >
                            Leg {leg}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Pace</span>
                  <span className="font-semibold text-gray-900">
                    {runner.averagePaceFormatted}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">Legs Run</span>
                  <div className="flex flex-wrap gap-1">
                    {runner.legsRun.map((leg: number) => (
                      <span
                        key={leg}
                        className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                      >
                        {leg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Performance */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Recent Races
                </h4>
                <div className="space-y-1">
                  {runner.races.slice(0, 3).map((race: any, index: number) => {
                    let pace = "N/A";
                    let duration = race.lap_time || "N/A";
                    if (race.lap_time && race.distance && race.distance > 0) {
                      const timeInMinutes = parseTimeToMinutes(race.lap_time);
                      pace = formatPace(timeInMinutes / race.distance);
                    }
                    return (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          {race.year} - Leg {race.leg_number}
                        </span>
                        <span className="text-gray-900">
                          {duration} <span className="text-gray-400">|</span>{" "}
                          {pace}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No team data found
          </h3>
          <p className="text-gray-600">
            Runner information will appear here once data is available
          </p>
        </div>
      )}

      {/* Performance Table */}
      {runners.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Detailed Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Runner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Races
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Pace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Pace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Legs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Years
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runners.map((runner) => (
                  <tr
                    key={runner.name}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                          {getInitials(runner.name)}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {runner.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {runner.totalRaces}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="flex items-center gap-2">
                        {runner.bestPaceFormatted}
                        {runner.bestPaceLegs &&
                          runner.bestPaceLegs.length > 0 && (
                            <span className="flex flex-wrap gap-1">
                              {runner.bestPaceLegs.map((leg: number) => (
                                <span
                                  key={leg}
                                  className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                >
                                  Leg {leg}
                                </span>
                              ))}
                            </span>
                          )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {runner.averagePaceFormatted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {runner.legsRun.map((leg: number) => (
                          <span
                            key={leg}
                            className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                          >
                            {leg}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(
                          new Set(runner.races.map((r: any) => r.year))
                        )
                          .sort((a, b) => Number(a) - Number(b))
                          .map((year) => {
                            const y = Number(year);
                            return (
                              <span
                                key={y}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                              >
                                {y}
                              </span>
                            );
                          })}
                      </div>
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

// Helper functions
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

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default TeamView;
