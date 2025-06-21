import { Link, useNavigate } from "@tanstack/react-router";
import { Award, Target, User, Users } from "lucide-react";
import React from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { Tables } from "../types/database.types";
import { LegPill } from "./LegPill";

const TeamView: React.FC = () => {
  const { data, loading, error } = useRelayData();
  const navigate = useNavigate();

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

  const { runnerStats, results, yearlySummary } = data;

  const runners = runnerStats
    .filter((runner) => runner.runner_name)
    .map((runner) => {
      const bestPaceLegsWithVersions: { leg: number; version: number }[] =
        (runner.best_pace_legs_with_versions as {
          leg: number;
          version: number;
        }[]) || [];

      const legsRun: { leg: number; latestVersion: number }[] =
        (runner.legs_run as { leg: number; latestVersion: number }[]) || [];

      const recentRaces = results
        .filter((r) => r.runner_name === runner.runner_name)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, 3);

      const years = Array.from(
        new Set(
          results
            .filter((r) => r.runner_name === runner.runner_name)
            .map((r) => r.year)
        )
      ).sort((a, b) => (a || 0) - (b || 0));

      return {
        name: runner.runner_name as string,
        totalRaces: runner.total_races || 0,
        bestPace: runner.best_pace,
        averagePace: runner.average_pace,
        bestPaceFormatted: formatPace(runner.best_pace || 0),
        averagePaceFormatted: formatPace(runner.average_pace || 0),
        legsRun: legsRun.sort((a, b) => a.leg - b.leg),
        bestPaceLegsWithVersions,
        recentRaces,
        years,
      };
    })
    .sort((a, b) => b.totalRaces - a.totalRaces);

  console.log(runners);

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
          <h3 className="text-2xl font-bold text-gray-900">{results.length}</h3>
          <p className="text-gray-600">Total Legs Run</p>
        </div>
        <div className="card p-6 text-center">
          <Award className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {yearlySummary.length}
          </h3>
          <p className="text-gray-600">Years Competed</p>
        </div>
      </div>

      {/* Runner Cards */}
      {runners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runners.map((runner) => (
            <Link
              key={runner.name}
              to="/runners/$runnerName"
              params={{ runnerName: runner.name }}
              className="card p-6 hover:shadow-lg transition-all duration-200 block"
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
                    {runner.bestPaceLegsWithVersions &&
                      runner.bestPaceLegsWithVersions.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {runner.bestPaceLegsWithVersions.map(
                            ({
                              leg,
                              version,
                            }: {
                              leg: number;
                              version: number;
                            }) => (
                              <LegPill
                                key={`${leg}-${version}`}
                                leg={leg}
                                version={version}
                                className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full hover:bg-green-200"
                              >
                                Leg {leg} (v{version})
                              </LegPill>
                            )
                          )}
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
                    {runner.legsRun.map(
                      ({
                        leg,
                        latestVersion,
                      }: {
                        leg: number;
                        latestVersion: number;
                      }) => (
                        <LegPill
                          key={leg}
                          leg={leg}
                          version={latestVersion}
                          className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full hover:bg-primary-200"
                        >
                          {leg}
                        </LegPill>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Performance */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Recent Races
                </h4>
                <div className="space-y-1">
                  {runner.recentRaces.map(
                    (race: Tables<"v_results_with_pace">, index: number) => {
                      const pace = formatPace(race.pace || 0);
                      const duration = race.lap_time || "N/A";

                      return (
                        <div
                          key={index}
                          className="flex justify-between text-xs"
                        >
                          <span className="text-gray-600">
                            {race.year} - Leg {race.leg_number}
                          </span>
                          <span className="text-gray-900">
                            {duration} <span className="text-gray-400">|</span>{" "}
                            {pace}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </Link>
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
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: "/runners/$runnerName",
                        params: { runnerName: runner.name },
                      })
                    }
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
                        {runner.bestPaceLegsWithVersions &&
                          runner.bestPaceLegsWithVersions.length > 0 && (
                            <span className="flex flex-wrap gap-1">
                              {runner.bestPaceLegsWithVersions.map(
                                ({
                                  leg,
                                  version,
                                }: {
                                  leg: number;
                                  version: number;
                                }) => (
                                  <LegPill
                                    key={`${leg}-${version}`}
                                    leg={leg}
                                    version={version}
                                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full hover:bg-green-200"
                                  >
                                    Leg {leg} (v{version})
                                  </LegPill>
                                )
                              )}
                            </span>
                          )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {runner.averagePaceFormatted}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {runner.legsRun.map(
                          ({
                            leg,
                            latestVersion,
                          }: {
                            leg: number;
                            latestVersion: number;
                          }) => (
                            <LegPill
                              key={leg}
                              leg={leg}
                              version={latestVersion}
                              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full hover:bg-primary-200"
                            >
                              {leg}
                            </LegPill>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {runner.years.map((year) => {
                          return (
                            <span
                              key={year}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {year}
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
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default TeamView;
