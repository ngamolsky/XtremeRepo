import { Link, useNavigate } from "@tanstack/react-router";
import React from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { Tables } from "../types/database.types";

const LegsView: React.FC = () => {
  const {
    data: { legVersionStats },
    loading,
    error,
  } = useRelayData();
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

  const legs = legVersionStats.sort(
    (a, b) =>
      (a.leg_number || 0) - (b.leg_number || 0) ||
      (b.leg_version || 0) - (a.leg_version || 0)
  );

  const legsV2 = legs.filter((leg) => leg.leg_version === 2);
  const legsV1 = legs.filter((leg) => leg.leg_version === 1);

  // Helper to get year ranges - this still requires iterating over results, but it's much simpler now.
  const getVersionLabel = (version: number) => {
    return `Legs (Version ${version})`;
  };

  const LegTable = ({
    legs,
    version,
  }: {
    legs: Tables<"v_leg_version_stats">[];
    version: number;
  }) => (
    <>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {getVersionLabel(version)}
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
            {legs.map((leg) => {
              const bestPaceRunners =
                (leg.best_pace_runner_years as {
                  runner: string;
                  year: number;
                }[]) || [];
              return (
                <tr
                  key={`${leg.leg_number}-${leg.leg_version}`}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/legs/$legNumber/$version",
                      params: {
                        legNumber: (leg.leg_number || 0).toString(),
                        version: (leg.leg_version || 0).toString(),
                      },
                    })
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ">
                    {leg.leg_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leg.runs}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leg.distance ? `${leg.distance} mi` : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leg.elevation_gain !== undefined &&
                    leg.elevation_gain !== null
                      ? `+${leg.elevation_gain} ft`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leg.average_pace !== null
                      ? formatPace(leg.average_pace)
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span>
                        {leg.best_pace !== null
                          ? formatPace(leg.best_pace)
                          : "N/A"}
                      </span>
                      {bestPaceRunners.length > 0 && (
                        <span className="text-xs text-gray-500">
                          by{" "}
                          <Link
                            to="/runners/$runnerName"
                            params={{ runnerName: bestPaceRunners[0].runner }}
                            className="hover:underline"
                          >
                            {bestPaceRunners[0].runner}
                          </Link>{" "}
                          ({bestPaceRunners[0].year})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {leg.unique_runners}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

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
        {legsV2.length > 0 && <LegTable legs={legsV2} version={2} />}
        {legsV1.length > 0 && <LegTable legs={legsV1} version={1} />}
        {legsV1.length === 0 && legsV2.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leg data available.
          </div>
        )}
      </div>
    </div>
  );
};

export default LegsView;
