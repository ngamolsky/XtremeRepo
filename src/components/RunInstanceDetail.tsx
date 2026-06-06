import { Link, useParams } from "@tanstack/react-router";
import {
  Activity,
  Clock,
  FileText,
  Map as MapIcon,
  PlusCircle,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import {
  formatGradeAdjustedPace,
  getGradeAdjustedPace,
} from "../lib/gradeAdjustedPace";
import { formatFeet, formatMiles, formatPace, formatSourceType } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";
import Breadcrumbs from "./Breadcrumbs";
import CommentsSection from "./CommentsSection";

type ObservationRow = Tables<"v_leg_result_observations_with_pace">;

type ObservationFormState = {
  distance: string;
  elapsedTime: string;
  elevationGain: string;
  lapTime: string;
  metadata: string;
  movingTime: string;
  sourceLabel: string;
  sourceTags: string[];
  sourceType: string;
};

const defaultObservationForm: ObservationFormState = {
  distance: "",
  elapsedTime: "",
  elevationGain: "",
  lapTime: "",
  metadata: "",
  movingTime: "",
  sourceLabel: "",
  sourceTags: [],
  sourceType: "manual_runner",
};

const sourceTypeOptions = [
  "manual_runner",
  "apple_watch",
  "garmin",
  "phone",
  "strava",
  "manual_admin",
  "other",
];

const defaultSourceTagOptions = ["Apple Fitness", "Strava", "Garmin", "Manual"];
const ASSUMED_OBSERVATION_LEGEND =
  "* means a self recorded value was missing and inherited from the leg default.";

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

const normalizeTag = (value: string) => value.trim().replace(/\s+/g, " ");
const tagKey = (value: string) => normalizeTag(value).toLocaleLowerCase();

const uniqueTags = (tags: string[]) => {
  const tagsByKey = new Map<string, string>();

  tags.forEach((tag) => {
    const normalizedTag = normalizeTag(tag);

    if (normalizedTag && !tagsByKey.has(tagKey(normalizedTag))) {
      tagsByKey.set(tagKey(normalizedTag), normalizedTag);
    }
  });

  return [...tagsByKey.values()];
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
  const [deletedObservationIds, setDeletedObservationIds] = useState<Set<string>>(new Set());
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);
  const [observationForm, setObservationForm] = useState<ObservationFormState>({
    ...defaultObservationForm,
  });
  const [sourceTagComboboxOpen, setSourceTagComboboxOpen] = useState(false);
  const [newTagText, setNewTagText] = useState("");
  const [savingObservation, setSavingObservation] = useState(false);
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

  const officialResult = results.find(
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
      if (observation.id && !deletedObservationIds.has(observation.id)) {
        byId.set(observation.id, observation);
      }
    });

    return [...byId.values()].sort((a, b) => {
      const createdCompare =
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

      return createdCompare || (a.source_type || "").localeCompare(b.source_type || "");
    });
  }, [createdObservations, deletedObservationIds, routeObservations]);
  const hasAssumedObservationMetrics = observations.some((observation) =>
    Object.values(getObservationAssumedMetrics(observation)).some((isAssumed) => isAssumed)
  );
  const legDefinition = legDefinitions.find(
    (leg) => leg.number === selectedLegNumber && leg.version === selectedVersion
  );
  const yearlyRace = yearlySummary.find((race) => race.year === selectedYear);
  const observedRunnerId =
    officialResult?.runner_id ||
    observations.find((observation) => observation.runner_id)?.runner_id ||
    null;
  const sourceTagOptions = useMemo(
    () => uniqueTags([...defaultSourceTagOptions, ...observationForm.sourceTags]),
    [observationForm.sourceTags]
  );
  const sourceTagQuery = normalizeTag(newTagText);
  const selectedSourceTagKeys = new Set(observationForm.sourceTags.map(tagKey));
  const filteredSourceTagOptions = sourceTagOptions.filter(
    (sourceTag) =>
      !selectedSourceTagKeys.has(tagKey(sourceTag)) &&
      (!sourceTagQuery || tagKey(sourceTag).includes(tagKey(sourceTagQuery)))
  );
  const canCreateSourceTag =
    Boolean(sourceTagQuery) &&
    !sourceTagOptions.some((sourceTag) => tagKey(sourceTag) === tagKey(sourceTagQuery));
  const showSourceTagCombobox =
    sourceTagComboboxOpen && (filteredSourceTagOptions.length > 0 || canCreateSourceTag);
  const exactSourceTagMatch =
    sourceTagQuery &&
    sourceTagOptions.find((sourceTag) => tagKey(sourceTag) === tagKey(sourceTagQuery));
  const firstSuggestedSourceTag = exactSourceTagMatch || filteredSourceTagOptions[0];
  const lastSelectedSourceTag =
    observationForm.sourceTags.length > 0
      ? observationForm.sourceTags[observationForm.sourceTags.length - 1]
      : null;
  const sourceTagHelpText =
    observationForm.sourceTags.length > 0
      ? "Search or create another tag"
      : "Search Apple Fitness, Strava, Garmin, or Manual";

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

  if (!officialResult && observations.length === 0) {
    return (
      <div className="py-12 text-center">
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          No run data found
        </h3>
        <p className="text-gray-600">
          No official or self recorded data matched {runnerName}, {selectedYear},
          leg {selectedLegNumber} version {selectedVersion}.
        </p>
      </div>
    );
  }

  const handleObservationFieldChange =
    (field: keyof ObservationFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setObservationForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleAddSourceTag = (tag: string) => {
    const normalizedTag = normalizeTag(tag);

    if (!normalizedTag) {
      return;
    }

    setObservationForm((current) => {
      if (current.sourceTags.some((sourceTag) => tagKey(sourceTag) === tagKey(normalizedTag))) {
        return current;
      }

      return {
        ...current,
        sourceTags: uniqueTags([...current.sourceTags, normalizedTag]),
      };
    });
    setNewTagText("");
    setSourceTagComboboxOpen(true);
  };

  const handleRemoveSourceTag = (tag: string) => {
    setObservationForm((current) => ({
      ...current,
      sourceTags: current.sourceTags.filter((sourceTag) => tagKey(sourceTag) !== tagKey(tag)),
    }));
  };

  const handleSourceTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (firstSuggestedSourceTag || sourceTagQuery) {
        event.preventDefault();
        handleAddSourceTag(firstSuggestedSourceTag || sourceTagQuery);
      }
      return;
    }

    if (event.key === "Backspace" && !newTagText && lastSelectedSourceTag) {
      event.preventDefault();
      handleRemoveSourceTag(lastSelectedSourceTag);
      return;
    }

    if (event.key === "Escape") {
      setSourceTagComboboxOpen(false);
    }
  };

  const handleSaveObservation = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");

    if (!observedRunnerId) {
      setSaveError("This run is not linked to a runner record.");
      return;
    }

    const parsedDistance = parseOptionalNumber(observationForm.distance);
    const parsedElevation = parseOptionalInteger(observationForm.elevationGain);

    if (parsedDistance !== null && Number.isNaN(parsedDistance)) {
      setSaveError("Distance must be a number.");
      return;
    }

    if (parsedDistance !== null && parsedDistance <= 0) {
      setSaveError("Distance must be greater than zero.");
      return;
    }

    if (parsedElevation !== null && Number.isNaN(parsedElevation)) {
      setSaveError("Elevation gain must be a number.");
      return;
    }

    if (parsedElevation !== null && parsedElevation < 0) {
      setSaveError("Elevation gain cannot be negative.");
      return;
    }

    let parsedMetadata: Record<string, unknown> = {};

    if (observationForm.metadata.trim()) {
      try {
        const metadataValue = JSON.parse(observationForm.metadata) as unknown;

        if (!metadataValue || Array.isArray(metadataValue) || typeof metadataValue !== "object") {
          setSaveError("Metadata must be a JSON object.");
          return;
        }

        parsedMetadata = metadataValue as Record<string, unknown>;
      } catch {
        setSaveError("Metadata must be valid JSON.");
        return;
      }
    }

    const sourceTags = uniqueTags(observationForm.sourceTags);
    const hasObservedValue =
      Boolean(
        observationForm.lapTime.trim() ||
          observationForm.movingTime.trim() ||
          observationForm.elapsedTime.trim() ||
          observationForm.sourceLabel.trim() ||
          sourceTags.length > 0
      ) ||
      parsedDistance !== null ||
      parsedElevation !== null ||
      Object.keys(parsedMetadata).length > 0;

    if (!hasObservedValue) {
      setSaveError("Add a time, distance, elevation, source tag, or metadata before saving.");
      return;
    }

    setSavingObservation(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("leg_result_observations")
        .insert({
          year: selectedYear,
          leg_number: selectedLegNumber,
          leg_version: selectedVersion,
          runner_id: observedRunnerId,
          submitted_by_runner_id: currentRunnerId,
          source_type: observationForm.sourceType,
          source_label: observationForm.sourceLabel.trim() || null,
          source_tags: sourceTags,
          ...(observationForm.lapTime.trim() ? { lap_time: observationForm.lapTime.trim() } : {}),
          ...(observationForm.movingTime.trim()
            ? { moving_time: observationForm.movingTime.trim() }
            : {}),
          ...(observationForm.elapsedTime.trim()
            ? { elapsed_time: observationForm.elapsedTime.trim() }
            : {}),
          ...(parsedDistance !== null ? { distance: parsedDistance } : {}),
          ...(parsedElevation !== null ? { elevation_gain: parsedElevation } : {}),
          raw_metadata: {
            ...parsedMetadata,
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
      setObservationForm({ ...defaultObservationForm });
      setNewTagText("");
      setSaveMessage("Saved self recorded data.");
    } catch (saveErr) {
      setSaveError(
        saveErr instanceof Error ? saveErr.message : "Could not save self recorded data."
      );
    } finally {
      setSavingObservation(false);
    }
  };

  const handleDeleteObservation = async (observation: ObservationRow) => {
    if (!observation.id || !window.confirm("Delete this self recorded observation?")) {
      return;
    }

    setDeletingObservationId(observation.id);
    setSaveError("");
    setSaveMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("leg_result_observations")
        .delete()
        .eq("id", observation.id);

      if (deleteError) {
        throw deleteError;
      }

      setDeletedObservationIds((current) => new Set([...current, observation.id as string]));
      setCreatedObservations((current) =>
        current.filter((createdObservation) => createdObservation.id !== observation.id)
      );
      setSaveMessage("Deleted self recorded data.");
    } catch (deleteErr) {
      setSaveError(
        deleteErr instanceof Error ? deleteErr.message : "Could not delete self recorded data."
      );
    } finally {
      setDeletingObservationId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Breadcrumbs
          current={`${selectedYear} Leg ${selectedLegNumber}`}
          items={[
            { label: "Team", to: "/team" },
            {
              label: runnerName,
              to: "/runners/$runnerName",
              params: { runnerName },
            },
            {
              label: `Leg ${selectedLegNumber} v${selectedVersion}`,
              to: "/legs/$legNumber/$version",
              params: {
                legNumber: selectedLegNumber.toString(),
                version: selectedVersion.toString(),
              },
            },
          ]}
        />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedYear} Leg {selectedLegNumber}
            </h1>
            <p className="mt-2 text-gray-600">
              {formatMiles(officialResult?.distance ?? legDefinition?.distance)} •{" "}
              {formatFeet(officialResult?.elevation_gain ?? legDefinition?.elevation_gain)}
              {yearlyRace?.race_start_time && ` • Race start ${yearlyRace.race_start_time}`}
            </p>
          </div>
          <Link
            to="/legs/$legNumber/$version"
            params={{
              legNumber: selectedLegNumber.toString(),
              version: selectedVersion.toString(),
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
          >
            <MapIcon className="h-4 w-4" />
            View leg page
          </Link>
        </div>
      </div>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Official Result
          </h2>
        </div>
        {officialResult ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Metric label="Runner" value={runnerName} icon={<User className="h-4 w-4" />} />
            <Metric label="Lap Time" value={officialResult.lap_time || "N/A"} icon={<Clock className="h-4 w-4" />} />
            <Metric label="Pace" value={formatPace(officialResult.pace || 0)} icon={<Activity className="h-4 w-4" />} />
            <Metric
              label="Grade Adjusted Pace"
              value={formatGradeAdjustedPace(
                getGradeAdjustedPace({
                  pace: officialResult.pace,
                  distanceMiles: officialResult.distance,
                  elevationGainFeet: officialResult.elevation_gain,
                })
              )}
              icon={<Activity className="h-4 w-4" />}
            />
            <Metric label="Distance" value={formatMiles(officialResult.distance)} icon={<MapIcon className="h-4 w-4" />} />
            <Metric label="Start" value={formatValue(officialResult.leg_start_time)} />
            <Metric label="Finish" value={formatValue(officialResult.leg_finish_time)} />
            <Metric label="Elevation" value={formatFeet(officialResult.elevation_gain)} />
            <Metric label="Source" value={formatSourceType(officialResult.source_type)} />
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No official result is recorded for this run instance.
          </p>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Self Recorded Evidence
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
                  <EvidenceHeader label="GAP" />
                  <EvidenceHeader label="Distance" />
                  <EvidenceHeader label="Elevation" />
                  <EvidenceHeader label="Submitted By" />
                  <EvidenceHeader label="Metadata" />
                  <EvidenceHeader label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {observations.map((observation, index) => {
                  const assumedMetrics = getObservationAssumedMetrics(observation);
                  const status = observation.has_canonical_result
                    ? "Official exists"
                    : "Self Recorded";
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
                        <div>{formatObservationSource(observation)}</div>
                        {observation.source_tags && observation.source_tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {observation.source_tags.map((sourceTag) => (
                              <span
                                key={sourceTag}
                                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                              >
                                {sourceTag}
                              </span>
                            ))}
                          </div>
                        )}
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
                        <AssumedObservationValue
                          value={formatPace(observation.pace || 0)}
                          assumed={assumedMetrics.pace}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatGradeAdjustedPace(getObservationGradeAdjustedPace(observation))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <AssumedObservationValue
                          value={formatMiles(observation.display_distance)}
                          assumed={assumedMetrics.distance}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <AssumedObservationValue
                          value={formatFeet(observation.display_elevation_gain)}
                          assumed={assumedMetrics.elevationGain}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {observation.submitted_by_runner_name || "N/A"}
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
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <button
                          type="button"
                          onClick={() => handleDeleteObservation(observation)}
                          disabled={deletingObservationId === observation.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>
                            {deletingObservationId === observation.id ? "Deleting..." : "Delete"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasAssumedObservationMetrics && (
              <p className="mt-2 text-xs text-gray-500">{ASSUMED_OBSERVATION_LEGEND}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No self recorded evidence has been saved for this run instance.
          </p>
        )}
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Add Self Recorded Data
          </h2>
        </div>
        <form onSubmit={handleSaveObservation} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Lap Time">
              <input
                type="text"
                value={observationForm.lapTime}
                onChange={handleObservationFieldChange("lapTime")}
                placeholder="01:23:45"
                className="field-input"
              />
            </Field>
            <Field label="Moving Time">
              <input
                type="text"
                value={observationForm.movingTime}
                onChange={handleObservationFieldChange("movingTime")}
                placeholder="01:23:45"
                className="field-input"
              />
            </Field>
            <Field label="Elapsed Time">
              <input
                type="text"
                value={observationForm.elapsedTime}
                onChange={handleObservationFieldChange("elapsedTime")}
                placeholder="01:23:45"
                className="field-input"
              />
            </Field>
            <Field label="Distance">
              <input
                type="number"
                step="0.001"
                min="0"
                value={observationForm.distance}
                onChange={handleObservationFieldChange("distance")}
                className="field-input"
              />
            </Field>
            <Field label="Elevation">
              <input
                type="number"
                step="1"
                min="0"
                value={observationForm.elevationGain}
                onChange={handleObservationFieldChange("elevationGain")}
                className="field-input"
              />
            </Field>
            <Field label="Source Type">
              <select
                value={observationForm.sourceType}
                onChange={handleObservationFieldChange("sourceType")}
                className="field-input"
              >
                {sourceTypeOptions.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {formatSourceType(sourceType)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Source Label">
            <input
              type="text"
              value={observationForm.sourceLabel}
              onChange={handleObservationFieldChange("sourceLabel")}
              placeholder="Watch file, screenshot, activity title"
              className="field-input"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tag className="h-4 w-4 text-gray-500" />
              <span>Source Tags</span>
            </div>
            <div className="relative">
              <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
                {observationForm.sourceTags.map((sourceTag) => (
                  <button
                    key={sourceTag}
                    type="button"
                    onClick={() => handleRemoveSourceTag(sourceTag)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-200"
                    aria-label={`Remove ${sourceTag}`}
                  >
                    <span>{sourceTag}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              <input
                type="text"
                value={newTagText}
                onChange={(event) => {
                  setNewTagText(event.target.value);
                  setSourceTagComboboxOpen(true);
                }}
                onFocus={() => setSourceTagComboboxOpen(true)}
                onClick={() => setSourceTagComboboxOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setSourceTagComboboxOpen(false), 100);
                }}
                onKeyDown={handleSourceTagKeyDown}
                role="combobox"
                aria-autocomplete="list"
                aria-controls="source-tag-options"
                aria-expanded={showSourceTagCombobox}
                aria-label="Source Tags"
                autoComplete="off"
                className="min-w-44 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
                placeholder={
                  observationForm.sourceTags.length > 0
                    ? "Search or create tag"
                    : sourceTagHelpText
                }
              />
            </div>
              {showSourceTagCombobox && (
                <div
                  id="source-tag-options"
                  role="listbox"
                  aria-label="Source tag suggestions"
                  className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  {filteredSourceTagOptions.map((sourceTag) => (
                    <button
                      key={sourceTag}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleAddSourceTag(sourceTag)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-primary-50"
                    >
                      <span>{sourceTag}</span>
                      <span className="text-xs text-gray-500">Add</span>
                    </button>
                  ))}
                  {canCreateSourceTag && (
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleAddSourceTag(sourceTagQuery)}
                      className="flex w-full items-center justify-between border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-primary-800 transition-colors hover:bg-primary-50"
                    >
                      <span>{sourceTagQuery}</span>
                      <span className="text-xs text-primary-600">Create</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <Field label="Metadata">
            <textarea
              value={observationForm.metadata}
              onChange={handleObservationFieldChange("metadata")}
              rows={4}
              placeholder='{"activity_id":"..."}'
              className="field-input font-mono"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingObservation}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{savingObservation ? "Saving..." : "Save Self Recorded Data"}</span>
            </button>
            {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
            {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          </div>
        </form>
      </section>

      {observedRunnerId && (
        <CommentsSection
          targetType="leg_instance"
          year={selectedYear}
          legNumber={selectedLegNumber}
          legVersion={selectedVersion}
          runnerId={observedRunnerId}
          title="Run Comments"
        />
      )}
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

const AssumedObservationValue: React.FC<{ assumed?: boolean; value: string }> = ({
  assumed = false,
  value,
}) => (
  <span>
    {value}
    {assumed ? <span aria-label="assumed">*</span> : null}
  </span>
);

const Field: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    {children}
  </label>
);

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
}

function formatObservationSource(observation: ObservationRow) {
  const source = formatSourceType(observation.source_type);

  return observation.source_label ? `${source} (${observation.source_label})` : source;
}

function getObservationAssumedMetrics(observation: ObservationRow) {
  return {
    pace: observation.observed_distance === null && observation.pace !== null,
    distance: observation.observed_distance === null && observation.display_distance !== null,
    elevationGain:
      observation.observed_elevation_gain === null &&
      observation.display_elevation_gain !== null,
  };
}

function getObservationGradeAdjustedPace(observation: ObservationRow) {
  return getGradeAdjustedPace({
    pace: observation.pace,
    distanceMiles: observation.display_distance,
    elevationGainFeet: observation.display_elevation_gain,
  });
}

export default RunInstanceDetail;
