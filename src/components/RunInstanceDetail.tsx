import { Link, useParams } from "@tanstack/react-router";
import { Activity, Clock, FileText, Map, PlusCircle, User } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatFeet, formatMiles, formatPace, formatSourceType } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type ObservationRow = Tables<"v_leg_result_observations_with_pace">;

const formatValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "N/A" : String(value);

const formatPrimaryTimeType = (value: string | null | undefined) => {
  const labels: Record<string, string> = {
    elapsed_time: "Elapsed",
    lap_time: "Lap",
    moving_time: "Moving",
  };

  return labels[value || ""] || "Time";
};

const isEmptyMetadata = (value: ObservationRow["raw_metadata"]) => {
  if (!value) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return typeof value === "object" && Object.keys(value).length === 0;
};

const RunInstanceDetail: React.FC = () => {
  const { runnerName, year, legNumber, version } = useParams({
    from: "/runs/$runnerName/$year/$legNumber/$version",
  });
  const {
    data: { legDefinitions, legResultObservations, results, yearlySummary },
    loading,
    error,
  } = useRelayData();
  const [currentRunnerId, setCurrentRunnerId] = useState<string | null>(null);
  const [createdObservations, setCreatedObservations] = useState<ObservationRow[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const selectedYear = Number(year);
  const selectedLegNumber = Number(legNumber);
  const selectedVersion = Number(version);

  useEffect(() => {
    let isActive = true;

    const loadCurrentRunner = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive || !user) {
        return;
      }

      const { data: runner } = await supabase
        .from("runners")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (isActive) {
        setCurrentRunnerId(runner?.id ?? null);
      }
    };

    loadCurrentRunner();

    return () => {
      isActive = false;
    };
  }, []);

  const canonicalResult = results.find(
    (result) =>
      result.runner_name === runnerName &&
      result.year === selectedYear &&
      result.leg_number === selectedLegNumber &&
      result.leg_version === selectedVersion
  );
  const routeObservations = legResultObservations.filter(
    (observation) =>
      observation.runner_name === runnerName &&
      observation.year === selectedYear &&
      observation.leg_number === selectedLegNumber &&
      observation.leg_version === selectedVersion
  );
  const observations = useMemo(() => {
    const byId = new Map<string, ObservationRow>();

    [...routeObservations, ...createdObservations].forEach((observation) => {
      if (observation.id) {
        byId.set(observation.id, observation);
      }
    });

    return [...byId.values()].sort((a, b) => {
      const createdCompare =
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

      return createdCompare || (a.source_type || "").localeCompare(b.source_type || "");
    });
  }, [createdObservations, routeObservations]);
  const legDefinition = legDefinitions.find(
    (leg) => leg.number === selectedLegNumber && leg.version === selectedVersion
  );
  const yearlyRace = yearlySummary.find((race) => race.year === selectedYear);
  const observedRunnerId =
    canonicalResult?.runner_id ||
    observations.find((observation) => observation.runner_id)?.runner_id ||
    null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-red-800">
          Connection Error
        </h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!canonicalResult && observations.length === 0) {
    return (
      <div className="py-12 text-center">
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          No run data found
        </h3>
        <p className="text-gray-600">
          No canonical or provisional data matched {runnerName}, {selectedYear},
          leg {selectedLegNumber} version {selectedVersion}.
        </p>
      </div>
    );
  }

  const handleSaveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");

    const trimmedNote = noteText.trim();

    if (!trimmedNote) {
      setSaveError("Add a note before saving.");
      return;
    }

    if (!observedRunnerId) {
      setSaveError("This run is not linked to a runner record.");
      return;
    }

    setSavingNote(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("leg_result_observations")
        .insert({
          year: selectedYear,
          leg_number: selectedLegNumber,
          leg_version: selectedVersion,
          runner_id: observedRunnerId,
          submitted_by_runner_id: currentRunnerId,
          source_type: "manual_runner",
          source_label: "Run detail note",
          notes: trimmedNote,
          raw_metadata: {
            origin: "run_instance_detail",
            runner_name: runnerName,
          },
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const { data: savedObservation, error: viewError } = await supabase
        .from("v_leg_result_observations_with_pace")
        .select("*")
        .eq("id", inserted.id)
        .single();

      if (viewError) {
        throw viewError;
      }

      setCreatedObservations((current) => [savedObservation, ...current]);
      setNoteText("");
      setSaveMessage("Saved provisional note.");
    } catch (saveErr) {
      setSaveError(
        saveErr instanceof Error ? saveErr.message : "Could not save note."
      );
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <Link
            to="/runners/$runnerName"
            params={{ runnerName }}
            className="font-medium text-primary-700 hover:text-primary-800"
          >
            {runnerName}
          </Link>
          <span>/</span>
          <Link
            to="/legs/$legNumber/$version"
            params={{
              legNumber: selectedLegNumber.toString(),
              version: selectedVersion.toString(),
            }}
            className="font-medium text-primary-700 hover:text-primary-800"
          >
            Leg {selectedLegNumber} v{selectedVersion}
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {selectedYear} Leg {selectedLegNumber}
        </h1>
        <p className="mt-2 text-gray-600">
          {formatMiles(canonicalResult?.distance ?? legDefinition?.distance)} •{" "}
          {formatFeet(canonicalResult?.elevation_gain ?? legDefinition?.elevation_gain)}
          {yearlyRace?.race_start_time && ` • Race start ${yearlyRace.race_start_time}`}
        </p>
      </div>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Canonical Result
          </h2>
        </div>
        {canonicalResult ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Metric label="Runner" value={runnerName} icon={<User className="h-4 w-4" />} />
            <Metric label="Lap Time" value={canonicalResult.lap_time || "N/A"} icon={<Clock className="h-4 w-4" />} />
            <Metric label="Pace" value={formatPace(canonicalResult.pace || 0)} icon={<Activity className="h-4 w-4" />} />
            <Metric label="Distance" value={formatMiles(canonicalResult.distance)} icon={<Map className="h-4 w-4" />} />
            <Metric label="Start" value={formatValue(canonicalResult.leg_start_time)} />
            <Metric label="Finish" value={formatValue(canonicalResult.leg_finish_time)} />
            <Metric label="Elevation" value={formatFeet(canonicalResult.elevation_gain)} />
            <Metric label="Source" value={formatSourceType(canonicalResult.source_type)} />
            <div className="md:col-span-3 lg:col-span-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                Official Notes
              </p>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                {canonicalResult.notes || "None"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No canonical result is recorded for this run instance.
          </p>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Provisional Evidence
          </h2>
        </div>
        {observations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <EvidenceHeader label="Source" />
                  <EvidenceHeader label="Status" />
                  <EvidenceHeader label="Time" />
                  <EvidenceHeader label="Pace" />
                  <EvidenceHeader label="Distance" />
                  <EvidenceHeader label="Elevation" />
                  <EvidenceHeader label="Submitted By" />
                  <EvidenceHeader label="Notes" />
                  <EvidenceHeader label="Metadata" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {observations.map((observation, index) => {
                  const source = observation.source_label
                    ? `${formatSourceType(observation.source_type)} (${observation.source_label})`
                    : formatSourceType(observation.source_type);
                  const status = observation.has_canonical_result
                    ? "Canonical exists"
                    : "Provisional";
                  const statusClass = observation.has_canonical_result
                    ? "bg-gray-100 text-gray-700"
                    : "bg-amber-100 text-amber-800";
                  const timeValue =
                    observation.primary_time ||
                    observation.lap_time ||
                    observation.elapsed_time ||
                    observation.moving_time;

                  return (
                    <tr
                      key={observation.id || `${observation.source_type}-${index}`}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {source}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{timeValue || "N/A"}</div>
                        {observation.primary_time_type && (
                          <div className="text-xs text-gray-500">
                            {formatPrimaryTimeType(observation.primary_time_type)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatPace(observation.pace || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatMiles(observation.display_distance)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatFeet(observation.display_elevation_gain)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {observation.submitted_by_runner_name || "N/A"}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-sm text-gray-900">
                        {observation.notes || ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {isEmptyMetadata(observation.raw_metadata) ? (
                          "None"
                        ) : (
                          <details>
                            <summary className="cursor-pointer text-primary-700">
                              View
                            </summary>
                            <pre className="mt-2 max-w-sm overflow-x-auto rounded bg-gray-100 p-3 text-xs text-gray-800">
                              {JSON.stringify(observation.raw_metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No provisional evidence has been saved for this run instance.
          </p>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Add Provisional Note
          </h2>
        </div>
        <form onSubmit={handleSaveNote} className="space-y-4">
          <label
            htmlFor="run-instance-note"
            className="block text-sm font-medium text-gray-700"
          >
            Note
          </label>
          <textarea
            id="run-instance-note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingNote}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {savingNote ? "Saving..." : "Save Note"}
            </button>
            {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
            {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          </div>
        </form>
      </section>
    </div>
  );
};

type MetricProps = {
  icon?: React.ReactNode;
  label: string;
  value: string;
};

const Metric: React.FC<MetricProps> = ({ icon, label, value }) => (
  <div className="rounded-lg bg-gray-50 p-4">
    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-sm font-semibold text-gray-900">{value}</p>
  </div>
);

const EvidenceHeader: React.FC<{ label: string }> = ({ label }) => (
  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
    {label}
  </th>
);

export default RunInstanceDetail;
