import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Calendar,
  Clock,
  Image,
  Trophy,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";
import CommentsSection from "./CommentsSection";

type AlbumSummary = Tables<"v_race_photo_album_summary">;

const RaceDetailView: React.FC = () => {
  const { year } = useParams({ from: "/races/$year" });
  const raceYear = Number(year);
  const {
    data: { yearlySummary, results, participations },
    loading,
    error,
  } = useRelayData();
  const [albumSummary, setAlbumSummary] = useState<AlbumSummary | null>(null);
  const [albumLoading, setAlbumLoading] = useState(true);
  const [albumError, setAlbumError] = useState<string | null>(null);

  const raceName = "Tahoe Relay";
  const race = useMemo(
    () => yearlySummary.find((yearlyRace) => yearlyRace.year === raceYear) ?? null,
    [raceYear, yearlySummary]
  );
  const legResults = useMemo(
    () =>
      results
        .filter((result) => result.year === raceYear)
        .sort((a, b) => (a.leg_number || 0) - (b.leg_number || 0)),
    [raceYear, results]
  );
  const yearParticipations = useMemo(
    () =>
      participations
        .filter((participation) => participation.year === raceYear)
        .sort((a, b) => (a.runner_name || "").localeCompare(b.runner_name || "")),
    [participations, raceYear]
  );
  const unknownLegParticipations = yearParticipations.filter(
    (participation) => !participation.has_known_leg
  );
  const coverUrl =
    albumSummary?.cover_storage_bucket && albumSummary.cover_storage_path
      ? supabase.storage
          .from(albumSummary.cover_storage_bucket)
          .getPublicUrl(albumSummary.cover_storage_path).data.publicUrl
      : null;

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
      } else {
        setAlbumSummary(data);
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
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`${raceYear} ${raceName}`}
                className="h-80 w-full object-cover"
              />
            ) : (
              <div className="flex h-80 items-center justify-center bg-gray-100 dark:bg-slate-800">
                <Image className="h-16 w-16 text-gray-300" />
              </div>
            )}
            <div className="p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-medium text-primary-700">
                <Calendar className="h-4 w-4" />
                <span>{raceYear}</span>
                {race.bib && <span>Bib #{race.bib}</span>}
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                {raceYear} {raceName}
              </h1>
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Leg Results</h2>
            </div>

            {legResults.length === 0 ? (
              <p className="text-sm text-gray-600">No leg results recorded for this race.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                        Leg
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                        Runner
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                        Pace
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {legResults.map((leg) => (
                      <tr key={`${leg.leg_number}-${leg.leg_version}`}>
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-800">
                          {leg.leg_number} (v{leg.leg_version})
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-800">
                          {leg.runner_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-800">
                          {leg.lap_time || "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-800">
                          {formatPace(leg.pace || 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm font-medium">
                          {leg.runner_name ? (
                            <Link
                              to="/runs/$runnerName/$year/$legNumber/$version"
                              params={{
                                runnerName: leg.runner_name,
                                year: String(leg.year),
                                legNumber: String(leg.leg_number),
                                version: String(leg.leg_version),
                              }}
                              className="text-primary-700 hover:text-primary-800"
                            >
                              Open
                            </Link>
                          ) : (
                            "N/A"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              <h2 className="text-lg font-semibold text-gray-900">Result</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <StatRow label="Total time" value={race.total_time?.toString() ?? "N/A"} />
              <StatRow label="Average pace" value={race.average_pace ?? "N/A"} />
              <StatRow
                label="Division"
                value={
                  race.division_place && race.division_teams
                    ? `${race.division_place} of ${race.division_teams}`
                    : race.division || "N/A"
                }
              />
              <StatRow
                label="Overall"
                value={
                  race.overall_place && race.overall_teams
                    ? `${race.overall_place} of ${race.overall_teams}`
                    : "N/A"
                }
              />
            </dl>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Roster</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {formatCount(yearParticipations.length || race.participant_count || 0, "runner")}
            </p>
            {unknownLegParticipations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {unknownLegParticipations.map((participation) => (
                  <span
                    key={`${participation.year}-${participation.runner_id}`}
                    className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800"
                  >
                    {participation.runner_name}
                  </span>
                ))}
              </div>
            )}
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
  <Link
    to="/races"
    className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-primary-700"
  >
    <ArrowLeft className="h-4 w-4" />
    <span>Back to races</span>
  </Link>
);

const StatRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <dt className="text-gray-600">{label}</dt>
    <dd className="font-medium text-gray-900">{value}</dd>
  </div>
);

function formatCount(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

export default RaceDetailView;
