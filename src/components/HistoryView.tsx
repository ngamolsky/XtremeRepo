import { Calendar, Clock, Trophy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import React from "react";
import { useRelayData } from "../hooks/useRelayData";
import {
  getDisplayLegResults,
  getNaiveLiveProjection,
  getRaceDisplaySummary,
} from "../lib/raceDisplay";
import type { RaceResultStatus } from "../lib/raceDisplay";
import { getRacesTopSummary } from "../lib/raceSummary";

const HistoryView: React.FC = () => {
  const {
    data: { yearlySummary, results, participations, legDefinitions, legResultObservations },
    loading,
    error,
  } = useRelayData();
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
    const displayLegResults = race.year
      ? getDisplayLegResults(race.year, results, legResultObservations)
      : [];
    const yearParticipations = participations.filter(
      (participation) => participation.year === race.year
    );
    return {
      ...race,
      legResults: displayLegResults,
      resultSummary: getRaceDisplaySummary(race, displayLegResults),
      latestRaceProjection: race.year
        ? getNaiveLiveProjection(race.year, displayLegResults, results, legDefinitions)
        : null,
      participantCount: yearParticipations.length || race.participant_count || 0,
    };
  });

  const topSummary = getRacesTopSummary(raceHistory);

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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Races</h1>
        <p className="text-lg text-gray-600">
          A complete timeline of our relay race journey
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card p-6 text-center">
          <Calendar className="w-8 h-8 text-primary-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {topSummary.yearsRan}
          </h3>
          <p className="text-gray-600">Years ran</p>
        </div>
        <div className="card p-6 text-center">
          <Clock className="w-8 h-8 text-green-600 mx-auto mb-3 dark:text-green-300" />
          <h3 className={`text-2xl font-bold ${getLatestRaceTimeColor(topSummary.latestRace?.source)}`}>
            {topSummary.latestRace
              ? `${topSummary.latestRace.year} · ${topSummary.latestRace.time ?? "pending"}`
              : "N/A"}
          </h3>
          <p className="text-gray-600 dark:text-slate-300">Latest race</p>
          {topSummary.latestRace && (
            <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getLatestRaceSourceBadgeColor(topSummary.latestRace.source)}`}>
              {topSummary.latestRace.label}
            </p>
          )}
        </div>
        <div className="card p-6 text-center">
          <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-gray-900">
            {topSummary.bestCurrentCourseTime
              ? `${topSummary.bestCurrentCourseTime.year} · ${topSummary.bestCurrentCourseTime.time}`
              : "N/A"}
          </h3>
          <p className="text-gray-600">Best current-course time</p>
        </div>
      </div>

      {/* Race Timeline */}
      {raceHistory.length > 0 ? (
        <div className="space-y-4">
          {raceHistory.map((race) => (
            <Link
              key={race.year}
              to="/races/$year"
              params={{ year: String(race.year) }}
              className="card group block overflow-hidden p-4 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:p-6"
              aria-label={`Open ${race.year} Tahoe Relay race detail`}
            >
              <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white sm:h-16 sm:w-16 sm:text-xl">
                    {race.year}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 sm:text-xl">
                        {race.year} Tahoe Relay
                      </h3>
                      <RaceStatusBadge status={race.resultSummary.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
                      <span>Division: {race.division || "Pending"}</span>
                      {race.bib && <span>Bib #{race.bib}</span>}
                      {race.participantCount > 0 && (
                        <span>{race.participantCount} runners</span>
                      )}
                      {race.resultSummary.selfRecordedResultCount > 0 && (
                        <span>
                          {race.resultSummary.selfRecordedResultCount} self recorded
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <div className="min-w-24 rounded-lg bg-gray-50 px-3 py-2 text-center transition-colors group-hover:bg-white">
                    <p className="text-lg font-bold text-gray-900 sm:text-2xl">
                      {race.resultSummary.displayTotalTime ?? "N/A"}
                    </p>
                    <p className="text-sm text-gray-600">Total Time</p>
                  </div>
                  {race.overall_percentile !== null && (
                    <div className="min-w-24 text-center">
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
                    <div className="min-w-24 text-center">
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
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No races found
          </h3>
          <p className="text-gray-600">
            Race data will appear here once it's available
          </p>
        </div>
      )}
    </div>
  );
};

function getLatestRaceTimeColor(source: "official" | "self_recorded" | "expected" | "pending" | undefined) {
  switch (source) {
    case "official":
      return "text-emerald-700 dark:text-emerald-300";
    case "self_recorded":
      return "text-amber-700 dark:text-amber-300";
    case "expected":
      return "text-sky-700 dark:text-sky-300";
    case "pending":
    default:
      return "text-gray-900 dark:text-slate-100";
  }
}

function getLatestRaceSourceBadgeColor(source: "official" | "self_recorded" | "expected" | "pending") {
  switch (source) {
    case "official":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800";
    case "self_recorded":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800";
    case "expected":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800";
    case "pending":
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700";
  }
}

const RaceStatusBadge: React.FC<{ status: RaceResultStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getRaceStatusClass(
      status
    )}`}
    title={status.description}
  >
    {status.label}
  </span>
);

function getRaceStatusClass(status: RaceResultStatus) {
  if (status.tone === "official") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status.tone === "partial") {
    return "bg-blue-50 text-blue-700";
  }
  return "bg-amber-50 text-amber-800";
}

export default HistoryView;
