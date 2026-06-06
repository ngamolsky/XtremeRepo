import { Link, useParams } from "@tanstack/react-router";
import {
  Camera,
  Calendar,
  Clock,
  Image,
  Trophy,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import {
  getDisplayLegResults,
  getNaiveLiveProjection,
  getRaceDisplaySummary,
} from "../lib/raceDisplay";
import type { RaceResultStatus } from "../lib/raceDisplay";
import {
  formatGradeAdjustedPace,
  getGradeAdjustedPace,
} from "../lib/gradeAdjustedPace";
import { formatFeet, formatMiles, formatPace, formatSourceType, parseTimeToMinutes } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";
import Breadcrumbs from "./Breadcrumbs";
import CommentsSection from "./CommentsSection";

type AlbumSummary = Tables<"v_race_photo_album_summary">;
type RacePhoto = Tables<"race_photos">;
type LegDefinition = Tables<"leg_definitions">;
type OfficialResult = Tables<"v_results_with_pace">;
type SelfRecordedObservation = Tables<"v_leg_result_observations_with_pace">;

type MetricAssumptions = {
  pace: boolean;
  distance: boolean;
  elevationGain: boolean;
};

type RaceLegEntry = {
  assumedMetrics: MetricAssumptions;
  distance: number | null;
  elevationGain: number | null;
  key: string;
  kind: "official" | "self_recorded";
  legNumber: number;
  legVersion: number;
  pace: number | null;
  gradeAdjustedPace: number | null;
  runnerName: string | null;
  sourceLabel: string | null;
  sourceTags: string[];
  sourceType: string | null;
  time: string | null;
  timeLabel: string;
  updatedAt: string | null;
};

type RaceLegGroup = {
  distance: number | null;
  elevationGain: number | null;
  entries: RaceLegEntry[];
  legNumber: number;
  legVersion: number | null;
};

const REMOTE_PUBLIC_STORAGE_BASE_URL =
  "https://vrorouyfpacxpxkcsleq.supabase.co/storage/v1/object/public";
const EXPECTED_RELAY_LEGS = 7;
const ASSUMED_METRIC_LEGEND =
  "* means a self recorded value was missing and inherited from the leg default.";

const RaceDetailView: React.FC = () => {
  const { year } = useParams({ from: "/races/$year" });
  const raceYear = Number(year);
  const {
    data: {
      yearlySummary,
      results,
      legDefinitions,
      legResultObservations,
    },
    loading,
    error,
  } = useRelayData();
  const [albumSummary, setAlbumSummary] = useState<AlbumSummary | null>(null);
  const [fallbackCoverPhoto, setFallbackCoverPhoto] = useState<RacePhoto | null>(null);
  const [albumLoading, setAlbumLoading] = useState(true);
  const [albumError, setAlbumError] = useState<string | null>(null);

  const raceName = "Tahoe Relay";
  const race = useMemo(
    () => yearlySummary.find((yearlyRace) => yearlyRace.year === raceYear) ?? null,
    [raceYear, yearlySummary]
  );
  const displayLegResults = useMemo(
    () =>
      Number.isFinite(raceYear)
        ? getDisplayLegResults(raceYear, results, legResultObservations)
        : [],
    [legResultObservations, raceYear, results]
  );
  const resultSummary = useMemo(
    () => (race ? getRaceDisplaySummary(race, displayLegResults) : null),
    [displayLegResults, race]
  );
  const liveProjection = useMemo(
    () =>
      Number.isFinite(raceYear)
        ? getNaiveLiveProjection(raceYear, displayLegResults, results)
        : null,
    [displayLegResults, raceYear, results]
  );
  const raceLegGroups = useMemo(
    () =>
      Number.isFinite(raceYear)
        ? buildRaceLegGroups(raceYear, legDefinitions, results, legResultObservations)
        : [],
    [legDefinitions, legResultObservations, raceYear, results]
  );
  const officialEntryCount = raceLegGroups.reduce(
    (count, group) => count + group.entries.filter((entry) => entry.kind === "official").length,
    0
  );
  const selfRecordedEntryCount = raceLegGroups.reduce(
    (count, group) =>
      count + group.entries.filter((entry) => entry.kind === "self_recorded").length,
    0
  );
  const legsWithEntriesCount = raceLegGroups.filter(
    (group) => group.entries.length > 0
  ).length;
  const hasAssumedMetrics = raceLegGroups.some((group) =>
    group.entries.some((entry) =>
      Object.values(entry.assumedMetrics).some((isAssumed) => isAssumed)
    )
  );
  const hasOfficialResults = officialEntryCount > 0;
  const showLiveProjection = Boolean(
    liveProjection && selfRecordedEntryCount > 0 && officialEntryCount < EXPECTED_RELAY_LEGS
  );
  const legSectionTitle = hasOfficialResults ? "Leg Results" : "Race Day Tracker";
  const legSectionSummary = hasOfficialResults
    ? "Official results are listed first. Self recorded entries remain as supporting race-day evidence."
    : "Self recorded entries are provisional race-day evidence until official results arrive.";
  const resultSectionTitle = hasOfficialResults ? "Official Result" : "Official Result Pending";
  const resultSectionSummary = hasOfficialResults
    ? "These totals and placements come from official race data."
    : "Totals, placements, percentiles, and records stay hidden until official results are available.";
  const officialDivisionValue =
    race?.division_place && race.division_teams
      ? `${race.division_place} of ${race.division_teams}`
      : race?.division || "N/A";
  const officialOverallValue =
    race?.overall_place && race.overall_teams
      ? `${race.overall_place} of ${race.overall_teams}`
      : "N/A";
  const observedRunnerNames = Array.from(
    new Set(
      raceLegGroups
        .flatMap((group) => group.entries)
        .map((entry) => entry.runnerName)
        .filter((runnerName): runnerName is string => Boolean(runnerName))
    )
  ).sort((a, b) => a.localeCompare(b));
  const coverPhoto = albumSummary?.cover_storage_bucket
    ? {
        storageBucket: albumSummary.cover_storage_bucket,
        storagePath: albumSummary.cover_storage_path,
        alt: `${raceYear} ${raceName}`,
      }
    : fallbackCoverPhoto
      ? {
          storageBucket: fallbackCoverPhoto.storage_bucket,
          storagePath: fallbackCoverPhoto.storage_path,
          alt:
            fallbackCoverPhoto.alt_text ||
            `${fallbackCoverPhoto.year} ${fallbackCoverPhoto.race} cover photo`,
        }
      : null;
  const coverUrlCandidates = getStorageUrlCandidates(
    coverPhoto?.storageBucket,
    coverPhoto?.storagePath
  );
  const coverAlt = coverPhoto?.alt ?? `${raceYear} ${raceName}`;

  const albumCoverUrlCandidates = getStorageUrlCandidates(
    albumSummary?.cover_storage_bucket,
    albumSummary?.cover_storage_path
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAlbumSummary() {
      if (!Number.isFinite(raceYear)) {
        setAlbumSummary(null);
        setAlbumLoading(false);
        return;
      }

      setAlbumLoading(true);
      setAlbumError(null);
      setFallbackCoverPhoto(null);

      const { data, error: summaryError } = await supabase
        .from("v_race_photo_album_summary")
        .select("*")
        .eq("year", raceYear)
        .eq("race", raceName)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (summaryError) {
        setAlbumError(summaryError.message);
        setAlbumSummary(null);
      } else if (data) {
        setAlbumSummary(data);
      } else {
        setAlbumSummary(null);

        const {
          data: fallbackPhoto,
          error: fallbackError,
        } = await loadRaceCoverFallback(raceName);

        if (cancelled) {
          return;
        }

        if (fallbackError) {
          setAlbumError(fallbackError.message);
          setFallbackCoverPhoto(null);
        } else {
          setFallbackCoverPhoto(fallbackPhoto);
        }
      }

      setAlbumLoading(false);
    }

    loadAlbumSummary();

    return () => {
      cancelled = true;
    };
  }, [raceName, raceYear]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink />
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!race || !Number.isFinite(raceYear)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink />
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Race not found</h1>
          <p className="text-gray-600">No race summary exists for {year}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <BackLink />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            {coverUrlCandidates.length > 0 ? (
              <FallbackImage
                urls={coverUrlCandidates}
                alt={coverAlt}
                className="h-80 w-full object-cover"
                fallback={<ImagePlaceholder />}
              />
            ) : (
              <ImagePlaceholder />
            )}
            <div className="p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-primary-700">
                <Calendar className="h-4 w-4" />
                <span>{raceYear}</span>
                {race.bib && <span>Bib #{race.bib}</span>}
                {resultSummary && <RaceStatusBadge status={resultSummary.status} />}
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                {raceYear} {raceName}
              </h1>
            </div>
          </section>

          {showLiveProjection && liveProjection && (
            <section className="card p-6">
              <div className="mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Live Projection</h2>
              </div>
              <p className="mb-5 text-sm text-gray-600 dark:text-slate-300">
                Uses self recorded times for reported legs and historical leg averages for legs not yet reported.
              </p>
              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <ProjectionMetric
                  label="Current recorded time"
                  value={liveProjection.displayCurrentRecordedTime}
                  detail={`${liveProjection.reportedLegCount} legs reported`}
                />
                <ProjectionMetric
                  label="Projected total"
                  value={liveProjection.displayProjectedTotalTime}
                  detail={`${liveProjection.estimatedLegCount} legs estimated`}
                />
                <ProjectionMetric
                  label="Method"
                  value="Naive average"
                  detail="Actuals plus historical leg averages"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-800">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <ProjectionHeader label="Leg" />
                      <ProjectionHeader label="Status" />
                      <ProjectionHeader label="Time used" />
                      <ProjectionHeader label="Source" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {liveProjection.legs.map((leg) => (
                      <tr key={leg.legNumber}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">Leg {leg.legNumber}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              leg.status === "reported"
                                ? "bg-emerald-50 text-emerald-700"
                                : leg.status === "estimated"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {leg.status === "reported"
                              ? "Reported"
                              : leg.status === "estimated"
                                ? "Estimated"
                                : "No estimate"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{leg.displayTime}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{leg.sourceLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-900">{legSectionTitle}</h2>
                </div>
                <p className="text-sm text-gray-600">{legSectionSummary}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
                  {selfRecordedEntryCount} self recorded
                </span>
                {hasOfficialResults && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    {officialEntryCount} official
                  </span>
                )}
              </div>
            </div>

            {hasAssumedMetrics && (
              <p className="mb-4 text-xs text-gray-500">
                {ASSUMED_METRIC_LEGEND}
              </p>
            )}

            <div className="divide-y divide-gray-100">
              {raceLegGroups.map((group) => (
                <RaceLegGroupRow key={group.legNumber} group={group} raceYear={raceYear} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Photo Album</h2>
            </div>
            {albumError && <p className="mb-3 text-sm text-red-600">{albumError}</p>}
            {albumLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
            ) : albumSummary ? (
              <>
                {albumCoverUrlCandidates.length > 0 && (
                  <FallbackImage
                    urls={albumCoverUrlCandidates}
                    alt={`${raceYear} ${raceName} album cover`}
                    className="mb-4 aspect-video w-full rounded-lg object-cover"
                  />
                )}
                <p className="mb-4 text-sm text-gray-600">
                  {formatCount(albumSummary.photo_count ?? 0, "photo")} linked to this race.
                </p>
                <Link
                  to="/photos"
                  search={{ year: raceYear, race: raceName }}
                  className="btn-primary inline-flex w-full items-center justify-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>Open photo album</span>
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-600">No photo album is linked yet.</p>
            )}
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">{resultSectionTitle}</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">{resultSectionSummary}</p>
            <dl className="space-y-3 text-sm">
              <StatRow label="Status" value={resultSummary?.status.label ?? "N/A"} />
              <StatRow
                label="Total time"
                value={hasOfficialResults ? resultSummary?.displayTotalTime ?? "N/A" : "Pending"}
              />
              <StatRow
                label="Average pace"
                value={hasOfficialResults ? resultSummary?.displayAveragePace ?? "N/A" : "Pending"}
              />
              <StatRow
                label="Division"
                value={hasOfficialResults ? officialDivisionValue : "Pending"}
              />
              <StatRow
                label="Overall"
                value={hasOfficialResults ? officialOverallValue : "Pending"}
              />
            </dl>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Race Day Data</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <StatRow label="Legs with data" value={`${legsWithEntriesCount} of ${EXPECTED_RELAY_LEGS}`} />
              <StatRow label="Self recorded entries" value={String(selfRecordedEntryCount)} />
              <StatRow label="Official entries" value={String(officialEntryCount)} />
            </dl>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                Observed runners
              </p>
              {observedRunnerNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {observedRunnerNames.map((runnerName) => (
                    <span
                      key={runnerName}
                      className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700"
                    >
                      {runnerName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No self recorded entries yet.</p>
              )}
            </div>
          </section>

          <CommentsSection
            targetType="race"
            year={raceYear}
            title="Race Comments"
          />
        </aside>
      </div>
    </div>
  );
};

const BackLink: React.FC = () => (
  <Breadcrumbs
    current="Race details"
    items={[{ label: "Races", to: "/races" }]}
  />
);

const StatRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <dt className="text-gray-600">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
  </div>
);

const ProjectionMetric: React.FC<{ detail: string; label: string; value: string }> = ({
  detail,
  label,
  value,
}) => (
  <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-800">
    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
    <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{detail}</p>
  </div>
);

const ProjectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
    {label}
  </th>
);

const ImagePlaceholder: React.FC = () => (
  <div className="flex h-80 items-center justify-center bg-gray-100 dark:bg-slate-800">
    <Image className="h-16 w-16 text-gray-300" />
  </div>
);

const FallbackImage: React.FC<{
  alt: string;
  className: string;
  fallback?: React.ReactNode;
  urls: string[];
}> = ({ alt, className, fallback = null, urls }) => {
  const [urlIndex, setUrlIndex] = useState(0);
  const signature = urls.join("|");

  useEffect(() => {
    setUrlIndex(0);
  }, [signature]);

  if (urls.length === 0 || urlIndex >= urls.length) {
    return fallback;
  }

  return (
    <img
      src={urls[urlIndex]}
      alt={alt}
      className={className}
      onError={() => setUrlIndex((currentIndex) => currentIndex + 1)}
    />
  );
};

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

const RaceLegGroupRow: React.FC<{ group: RaceLegGroup; raceYear: number }> = ({
  group,
  raceYear,
}) => (
  <div className="grid gap-4 py-5 first:pt-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)]">
    <div>
      <p className="text-sm font-semibold text-gray-900">
        Leg {group.legNumber}
        {group.legVersion ? ` (v${group.legVersion})` : ""}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {formatMiles(group.distance)} · {formatFeet(group.elevationGain)}
      </p>
    </div>
    {group.entries.length > 0 ? (
      <div className="space-y-3">
        {group.entries.map((entry) => (
          <RaceLegEntryRow key={entry.key} entry={entry} raceYear={raceYear} />
        ))}
      </div>
    ) : (
      <p className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
        No self recorded data yet.
      </p>
    )}
  </div>
);

const RaceLegEntryRow: React.FC<{ entry: RaceLegEntry; raceYear: number }> = ({
  entry,
  raceYear,
}) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <EntrySourceBadge entry={entry} />
          {entry.updatedAt && (
            <span className="text-xs text-gray-500">{formatEntryDate(entry.updatedAt)}</span>
          )}
        </div>
        <p className="mt-2 text-base font-semibold text-gray-900">
          {entry.runnerName || "Unknown runner"}
        </p>
      </div>
      {entry.runnerName && entry.legVersion ? (
        <Link
          to="/runs/$runnerName/$year/$legNumber/$version"
          params={{
            runnerName: entry.runnerName,
            year: String(raceYear),
            legNumber: String(entry.legNumber),
            version: String(entry.legVersion),
          }}
          className="text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          Open
        </Link>
      ) : null}
    </div>

    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
      <EntryMetric label={entry.timeLabel} value={entry.time ?? "N/A"} />
      <EntryMetric label="Pace" value={formatPace(entry.pace || 0)} assumed={entry.assumedMetrics.pace} />
      <EntryMetric label="GAP" value={formatGradeAdjustedPace(entry.gradeAdjustedPace)} />
      <EntryMetric label="Distance" value={formatMiles(entry.distance)} assumed={entry.assumedMetrics.distance} />
      <EntryMetric label="Gain" value={formatFeet(entry.elevationGain)} assumed={entry.assumedMetrics.elevationGain} />
    </dl>

    {entry.sourceTags.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.sourceTags.map((sourceTag) => (
          <span
            key={sourceTag}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {sourceTag}
          </span>
        ))}
      </div>
    )}
  </div>
);

const EntryMetric: React.FC<{ assumed?: boolean; label: string; value: string }> = ({
  assumed = false,
  label,
  value,
}) => (
  <div>
    <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
    <dd className="mt-1 font-medium text-gray-900">
      {value}
      {assumed ? <span aria-label="assumed">*</span> : null}
    </dd>
  </div>
);

const EntrySourceBadge: React.FC<{ entry: RaceLegEntry }> = ({ entry }) => {
  const label =
    entry.kind === "official"
      ? "Official"
      : `Self Recorded${
          entry.sourceType ? ` · ${formatSourceType(entry.sourceType)}` : ""
        }${
          entry.sourceLabel ? ` (${entry.sourceLabel})` : ""
        }`;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        entry.kind === "official"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800"
      }`}
    >
      {label}
    </span>
  );
};

function getRaceStatusClass(status: RaceResultStatus) {
  if (status.tone === "official") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status.tone === "partial") {
    return "bg-blue-50 text-blue-700";
  }
  return "bg-amber-50 text-amber-800";
}

function buildRaceLegGroups(
  raceYear: number,
  legDefinitions: LegDefinition[],
  officialResults: OfficialResult[],
  observations: SelfRecordedObservation[]
): RaceLegGroup[] {
  const latestLegDefinitionByNumber = getLatestLegDefinitionByNumber(legDefinitions);
  const officialResultsByLeg = new Map<number, OfficialResult[]>();
  const observationsByLeg = new Map<number, SelfRecordedObservation[]>();
  const legNumbers = new Set<number>();

  for (let legNumber = 1; legNumber <= EXPECTED_RELAY_LEGS; legNumber += 1) {
    legNumbers.add(legNumber);
  }

  officialResults.forEach((result) => {
    if (result.year !== raceYear || result.leg_number === null) {
      return;
    }

    const currentResults = officialResultsByLeg.get(result.leg_number) ?? [];
    currentResults.push(result);
    officialResultsByLeg.set(result.leg_number, currentResults);
    legNumbers.add(result.leg_number);
  });

  observations.forEach((observation) => {
    if (
      observation.year !== raceYear ||
      observation.leg_number === null ||
      !hasMeasuredObservationData(observation)
    ) {
      return;
    }

    const currentObservations = observationsByLeg.get(observation.leg_number) ?? [];
    currentObservations.push(observation);
    observationsByLeg.set(observation.leg_number, currentObservations);
    legNumbers.add(observation.leg_number);
  });

  return Array.from(legNumbers)
    .sort((a, b) => a - b)
    .map((legNumber) => {
      const officialEntries = (officialResultsByLeg.get(legNumber) ?? [])
        .sort(sortOfficialResults)
        .map(toOfficialEntry);
      const selfRecordedEntries = (observationsByLeg.get(legNumber) ?? [])
        .sort(sortObservations)
        .map(toSelfRecordedEntry);
      const entries = [...officialEntries, ...selfRecordedEntries];
      const primaryEntry = entries[0];
      const defaultDefinition = latestLegDefinitionByNumber.get(legNumber);

      return {
        distance: primaryEntry?.distance ?? defaultDefinition?.distance ?? null,
        elevationGain:
          primaryEntry?.elevationGain ?? defaultDefinition?.elevation_gain ?? null,
        entries,
        legNumber,
        legVersion: primaryEntry?.legVersion ?? defaultDefinition?.version ?? null,
      };
    });
}

function getLatestLegDefinitionByNumber(legDefinitions: LegDefinition[]) {
  const latestByNumber = new Map<number, LegDefinition>();

  legDefinitions.forEach((definition) => {
    const current = latestByNumber.get(definition.number);
    if (!current || definition.version > current.version) {
      latestByNumber.set(definition.number, definition);
    }
  });

  return latestByNumber;
}

function toOfficialEntry(result: OfficialResult): RaceLegEntry {
  return {
    assumedMetrics: {
      pace: false,
      distance: false,
      elevationGain: false,
    },
    distance: result.distance,
    elevationGain: result.elevation_gain,
    key: `official-${result.year}-${result.leg_number}-${result.leg_version}`,
    kind: "official",
    legNumber: result.leg_number ?? 0,
    legVersion: result.leg_version ?? 0,
    pace: result.pace,
    gradeAdjustedPace: getGradeAdjustedPace({
      pace: result.pace,
      distanceMiles: result.distance,
      elevationGainFeet: result.elevation_gain,
    }),
    runnerName: result.runner_name,
    sourceLabel: null,
    sourceTags: [],
    sourceType: result.source_type ?? "official",
    time: result.lap_time,
    timeLabel: "Lap",
    updatedAt: null,
  };
}

function toSelfRecordedEntry(observation: SelfRecordedObservation): RaceLegEntry {
  const distance = observation.observed_distance ?? observation.display_distance ?? observation.canonical_distance;
  const elevationGain =
    observation.observed_elevation_gain ??
    observation.display_elevation_gain ??
    observation.canonical_elevation_gain;
  const time =
    observation.primary_time ??
    observation.lap_time ??
    observation.elapsed_time ??
    observation.moving_time;
  const pace =
    observation.observed_distance && observation.pace
      ? observation.pace
      : getAssumedEntryPace(time, distance);

  return {
    assumedMetrics: {
      pace: !observation.observed_distance && pace !== null,
      distance: observation.observed_distance === null && distance !== null,
      elevationGain: observation.observed_elevation_gain === null && elevationGain !== null,
    },
    distance,
    elevationGain,
    key: `self-recorded-${observation.id ?? `${observation.year}-${observation.leg_number}`}`,
    kind: "self_recorded",
    legNumber: observation.leg_number ?? 0,
    legVersion: observation.leg_version ?? 0,
    pace,
    gradeAdjustedPace: getGradeAdjustedPace({
      pace,
      distanceMiles: distance,
      elevationGainFeet: elevationGain,
    }),
    runnerName: observation.runner_name,
    sourceLabel: observation.source_label,
    sourceTags: observation.source_tags ?? [],
    sourceType: observation.source_type,
    time,
    timeLabel: formatObservationTimeLabel(observation.primary_time_type),
    updatedAt: observation.updated_at ?? observation.created_at,
  };
}

function getAssumedEntryPace(time: string | null | undefined, distance: number | null | undefined) {
  if (!time || !distance || distance <= 0) {
    return null;
  }

  const minutes = parseTimeToMinutes(time);
  return minutes > 0 ? minutes / distance : null;
}

function hasMeasuredObservationData(observation: SelfRecordedObservation) {
  return Boolean(
    observation.primary_time ||
      observation.lap_time ||
      observation.elapsed_time ||
      observation.moving_time ||
      observation.observed_distance ||
      observation.observed_elevation_gain
  );
}

function sortOfficialResults(a: OfficialResult, b: OfficialResult) {
  return (a.leg_version ?? 0) - (b.leg_version ?? 0);
}

function sortObservations(a: SelfRecordedObservation, b: SelfRecordedObservation) {
  return getObservationTimestamp(b) - getObservationTimestamp(a);
}

function getObservationTimestamp(observation: SelfRecordedObservation) {
  return Date.parse(observation.updated_at ?? observation.created_at ?? "") || 0;
}

function formatObservationTimeLabel(timeType: string | null | undefined) {
  if (timeType === "moving_time") {
    return "Moving";
  }
  if (timeType === "elapsed_time") {
    return "Elapsed";
  }
  return "Lap";
}

function formatEntryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStorageUrlCandidates(
  storageBucket: string | null | undefined,
  storagePath: string | null | undefined
) {
  if (!storageBucket || !storagePath) {
    return [];
  }

  const currentPublicUrl = supabase.storage
    .from(storageBucket)
    .getPublicUrl(storagePath).data.publicUrl;
  const shouldUseRemoteFallback =
    storageBucket === "race-photos" &&
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.includes("127.0.0.1");
  const remotePublicUrl = shouldUseRemoteFallback
    ? `${REMOTE_PUBLIC_STORAGE_BASE_URL}/${encodeStoragePath(storageBucket)}/${encodeStoragePath(
        storagePath
      )}`
    : null;

  return Array.from(
    new Set([currentPublicUrl, remotePublicUrl].filter((url): url is string => Boolean(url)))
  );
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function loadRaceCoverFallback(raceName: string) {
  const featuredResult = await supabase
    .from("race_photos")
    .select("*")
    .eq("race", raceName)
    .eq("featured", true)
    .order("year", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (featuredResult.data || featuredResult.error) {
    return featuredResult;
  }

  return supabase
    .from("race_photos")
    .select("*")
    .eq("race", raceName)
    .order("year", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

function formatCount(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

export default RaceDetailView;
