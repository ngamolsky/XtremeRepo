import { Link, useParams } from "@tanstack/react-router";
import {
  Activity,
  Clock,
  FileText,
  Map as MapIcon,
  Pencil,
  PlusCircle,
  Tag,
  Target,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import {
  filterBogeyEventsForPerformance,
  formatBogeyEventSummary,
} from "../lib/bogeyStats";
import {
  formatGradeAdjustedPace,
  getGradeAdjustedPace,
} from "../lib/gradeAdjustedPace";
import { formatFeet, formatMiles, formatPace, formatSourceType } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";
import Breadcrumbs from "./Breadcrumbs";
import CommentsSection from "./CommentsSection";
import EntityPill from "./EntityPill";
import { LegPill } from "./LegPill";
import SourceBadge, { type SourceKind } from "./SourceBadge";

type ObservationRow = Tables<"v_leg_result_observations_with_pace">;
type OfficialResultRow = Tables<"v_results_with_pace">;
type PrimaryPerformanceSource = "official" | "self-reported" | "projected";

type PrimaryPerformance = {
  source: PrimaryPerformanceSource;
  sourceLabel: string;
  timeLabel: string;
  timeType: string;
  pace: number | null;
  gradeAdjustedPace: string;
  distance: number | null;
  elevationGain: number | null;
  averageDelta: string;
  note: string;
};

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
  sourceType: "apple_watch",
};

const sourceTypeOptions = ["apple_watch", "garmin", "other"];

const defaultSourceTagOptions = ["Apple Fitness", "Strava", "Garmin App", "Screenshot"];
const ASSUMED_OBSERVATION_LEGEND =
  "* means a self recorded value was missing and inherited from the leg default.";

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

function getRunHistoricalAverageMinutes(
  legVersionStats: Tables<"v_leg_version_stats">[],
  legNumber: number,
  legVersion: number
) {
  const legStat = legVersionStats.find(
    (stat) => stat.leg_number === legNumber && stat.leg_version === legVersion
  );

  if (!legStat?.total_time || !legStat.runs) {
    return null;
  }

  const averageMinutes = legStat.total_time / legStat.runs;
  return Number.isFinite(averageMinutes) && averageMinutes > 0 ? averageMinutes : null;
}

function formatAverageDelta(
  actualMinutes: number | null | undefined,
  averageMinutes: number | null | undefined
) {
  if (!actualMinutes || !averageMinutes) {
    return "N/A";
  }

  const deltaMinutes = actualMinutes - averageMinutes;
  if (!Number.isFinite(deltaMinutes)) {
    return "N/A";
  }

  const totalSeconds = Math.round(Math.abs(deltaMinutes) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const sign = deltaMinutes > 0 ? "+" : deltaMinutes < 0 ? "−" : "±";
  const suffix = deltaMinutes > 0 ? " slower" : deltaMinutes < 0 ? " faster" : " on avg";

  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}${suffix}`;
}

function formatMinutesAsDuration(totalMinutes: number | null | undefined) {
  if (!totalMinutes || !Number.isFinite(totalMinutes)) {
    return "N/A";
  }

  const totalSeconds = Math.round(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getOfficialPrimaryPerformance(
  officialResult: OfficialResultRow,
  legHistoricalAverageMinutes: number | null
): PrimaryPerformance {
  return {
    source: "official",
    sourceLabel: "Official",
    timeLabel: officialResult.lap_time || "N/A",
    timeType: "Lap time",
    pace: officialResult.pace,
    gradeAdjustedPace: formatGradeAdjustedPace(
      getGradeAdjustedPace({
        pace: officialResult.pace,
        distanceMiles: officialResult.distance,
        elevationGainFeet: officialResult.elevation_gain,
      })
    ),
    distance: officialResult.distance,
    elevationGain: officialResult.elevation_gain,
    averageDelta: formatAverageDelta(officialResult.time_in_minutes, legHistoricalAverageMinutes),
    note: "Official race result is the best available source for this performance.",
  };
}

function getObservationPrimaryPerformance(
  observation: ObservationRow,
  legHistoricalAverageMinutes: number | null
): PrimaryPerformance {
  const timeValue =
    observation.primary_time || observation.lap_time || observation.elapsed_time || observation.moving_time;

  return {
    source: "self-reported",
    sourceLabel: "Self Reported",
    timeLabel: timeValue || "N/A",
    timeType: formatPrimaryTimeType(observation.primary_time_type),
    pace: observation.pace,
    gradeAdjustedPace: formatGradeAdjustedPace(getObservationGradeAdjustedPace(observation)),
    distance: observation.display_distance,
    elevationGain: observation.display_elevation_gain,
    averageDelta: formatAverageDelta(observation.time_in_minutes, legHistoricalAverageMinutes),
    note: "No official result is available yet, so the best self reported observation is shown here.",
  };
}

function getProjectedPrimaryPerformance(
  legHistoricalAverageMinutes: number,
  legDefinition: Tables<"leg_definitions"> | undefined
): PrimaryPerformance {
  const distance = legDefinition?.distance ?? null;
  const elevationGain = legDefinition?.elevation_gain ?? null;
  const pace = distance && distance > 0 ? legHistoricalAverageMinutes / distance : null;

  return {
    source: "projected",
    sourceLabel: "Projected",
    timeLabel: formatMinutesAsDuration(legHistoricalAverageMinutes),
    timeType: "Historical average",
    pace,
    gradeAdjustedPace: formatGradeAdjustedPace(
      getGradeAdjustedPace({
        pace,
        distanceMiles: distance,
        elevationGainFeet: elevationGain,
      })
    ),
    distance,
    elevationGain,
    averageDelta: "N/A",
    note: "No official or self reported data is available yet, so this uses the historical average for the leg version.",
  };
}

function primaryPerformanceSourceKind(source: PrimaryPerformanceSource): SourceKind {
  return source === "projected" ? "inferred" : source;
}

const RunInstanceDetail: React.FC = () => {
  const { runnerName, year, legNumber } = useParams({
    from: "/runs/$runnerName/$year/$legNumber",
  });
  const {
    data: { bogeyEvents, legDefinitions, legResultObservations, legVersionStats, results, yearlySummary },
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
  const [observationModalOpen, setObservationModalOpen] = useState(false);
  const [editingObservation, setEditingObservation] = useState<ObservationRow | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const selectedYear = Number(year);
  const selectedLegNumber = Number(legNumber);

  const officialResult = results.find(
    (result) =>
      result.runner_name === runnerName &&
      result.year === selectedYear &&
      result.leg_number === selectedLegNumber
  );
  const selectedVersion =
    officialResult?.leg_version ??
    Math.max(
      1,
      ...legDefinitions
        .filter((leg) => leg.number === selectedLegNumber)
        .map((leg) => leg.version || 1)
    );

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

  const performanceBogeyEvents = filterBogeyEventsForPerformance(bogeyEvents, {
    runnerName,
    year: selectedYear,
    legNumber: selectedLegNumber,
    legVersion: selectedVersion,
  });
  const routeObservations = legResultObservations.filter(
    (observation) =>
      observation.runner_name === runnerName &&
      observation.year === selectedYear &&
      observation.leg_number === selectedLegNumber
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
  const legHistoricalAverageMinutes = getRunHistoricalAverageMinutes(
    legVersionStats,
    selectedLegNumber,
    selectedVersion
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
  const primaryPerformance: PrimaryPerformance | null = officialResult
    ? getOfficialPrimaryPerformance(officialResult, legHistoricalAverageMinutes)
    : observations[0]
      ? getObservationPrimaryPerformance(observations[0], legHistoricalAverageMinutes)
      : legHistoricalAverageMinutes
        ? getProjectedPrimaryPerformance(legHistoricalAverageMinutes, legDefinition)
        : null;
  const showPrimaryBogeys = primaryPerformance?.source === "official";
  const primaryObservationId =
    primaryPerformance?.source === "self-reported" ? observations[0]?.id ?? null : null;
  const secondaryObservations = observations.filter(
    (observation) => observation.id !== primaryObservationId
  );
  const otherReportsCount =
    secondaryObservations.length + (officialResult && primaryPerformance?.source !== "official" ? 1 : 0);

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

  if (!officialResult && observations.length === 0 && !legHistoricalAverageMinutes) {
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

  const openObservationModal = (observation?: ObservationRow) => {
    setSaveError("");
    setSaveMessage("");
    setNewTagText("");
    setSourceTagComboboxOpen(false);
    setEditingObservation(observation ?? null);
    setObservationForm(
      observation
        ? {
            distance: observation.observed_distance?.toString() ?? "",
            elapsedTime: observation.elapsed_time ?? "",
            elevationGain: observation.observed_elevation_gain?.toString() ?? "",
            lapTime: observation.lap_time ?? "",
            metadata: isEmptyMetadata(observation.raw_metadata)
              ? ""
              : JSON.stringify(observation.raw_metadata, null, 2),
            movingTime: observation.moving_time ?? "",
            sourceLabel: observation.source_label ?? "",
            sourceTags: observation.source_tags ?? [],
            sourceType: observation.source_type ?? "apple_watch",
          }
        : { ...defaultObservationForm }
    );
    setObservationModalOpen(true);
  };

  const closeObservationModal = () => {
    if (savingObservation) {
      return;
    }

    setObservationModalOpen(false);
    setEditingObservation(null);
    setObservationForm({ ...defaultObservationForm });
    setNewTagText("");
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

    const otherDeviceLabel = observationForm.sourceLabel.trim();
    if (observationForm.sourceType === "other" && !otherDeviceLabel) {
      setSaveError("Describe the recording device when Recording Device is Other.");
      return;
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
      const observationPayload = {
        year: selectedYear,
        leg_number: selectedLegNumber,
        leg_version: selectedVersion,
        runner_id: observedRunnerId,
        submitted_by_runner_id: currentRunnerId,
        source_type: observationForm.sourceType,
        source_label: observationForm.sourceType === "other" ? otherDeviceLabel : null,
        source_tags: sourceTags,
        lap_time: observationForm.lapTime.trim() || null,
        moving_time: observationForm.movingTime.trim() || null,
        elapsed_time: observationForm.elapsedTime.trim() || null,
        distance: parsedDistance,
        elevation_gain: parsedElevation,
        raw_metadata: {
          ...parsedMetadata,
          origin: "run_instance_detail",
          runner_name: runnerName,
        },
      };

      const savedId = editingObservation?.id;

      if (savedId) {
        const { error: updateError } = await supabase
          .from("leg_result_observations")
          .update(observationPayload)
          .eq("id", savedId);

        if (updateError) {
          throw updateError;
        }
      }

      const { data: inserted, error: insertError } = savedId
        ? { data: { id: savedId }, error: null }
        : await supabase
            .from("leg_result_observations")
            .insert(observationPayload)
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

      setCreatedObservations((current) => [
        savedObservation,
        ...current.filter((createdObservation) => createdObservation.id !== savedObservation.id),
      ]);
      setObservationForm({ ...defaultObservationForm });
      setNewTagText("");
      setObservationModalOpen(false);
      setEditingObservation(null);
      setSaveMessage(savedId ? "Updated self recorded data." : "Saved self recorded data.");
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
          current={`${selectedYear} Leg ${selectedLegNumber} Performance`}
          items={[
            {
              label: "Races",
              to: "/races",
            },
            {
              label: `Race ${selectedYear}`,
              to: "/races/$year",
              params: { year: selectedYear.toString() },
            },
          ]}
        />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              Leg Performance
            </p>
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedYear} Leg {selectedLegNumber} Performance
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LegPill
                leg={selectedLegNumber}
                version={selectedVersion}
                className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                View leg page
              </LegPill>
              <EntityPill
                category="runner"
                to="/runners/$runnerName"
                params={{ runnerName }}
                ariaLabel={`View ${runnerName} runner profile`}
              >
                {runnerName}
              </EntityPill>
            </div>
            <p className="mt-2 text-gray-600">
              {formatMiles(officialResult?.distance ?? legDefinition?.distance)} •{" "}
              {formatFeet(officialResult?.elevation_gain ?? legDefinition?.elevation_gain)}
              {yearlyRace?.race_start_time && ` • Race start ${yearlyRace.race_start_time}`}
            </p>
          </div>
        </div>
      </div>

      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Primary Performance Data
              </h2>
              <p className="text-sm text-gray-600">
                Best effort view: official first, then self reported, then projected.
              </p>
            </div>
          </div>
          {primaryPerformance && (
            <SourceBadge
              kind={primaryPerformanceSourceKind(primaryPerformance.source)}
              label={primaryPerformance.sourceLabel}
              title="Primary performance data source"
            />
          )}
        </div>

        {primaryPerformance ? (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Metric label={primaryPerformance.timeType} value={primaryPerformance.timeLabel} icon={<Clock className="h-4 w-4" />} />
              <Metric label="Pace" value={formatPace(primaryPerformance.pace || 0)} icon={<Activity className="h-4 w-4" />} />
              <Metric label="Grade Adjusted Pace" value={primaryPerformance.gradeAdjustedPace} icon={<Activity className="h-4 w-4" />} />
              <Metric label="Vs Historical Avg" value={primaryPerformance.averageDelta} icon={<Clock className="h-4 w-4" />} />
              <Metric label="Distance" value={formatMiles(primaryPerformance.distance)} icon={<MapIcon className="h-4 w-4" />} />
              <Metric label="Elevation" value={formatFeet(primaryPerformance.elevationGain)} />
              {showPrimaryBogeys && (
                <Metric label="Bogeys" value={formatBogeyEventSummary(performanceBogeyEvents)} icon={<Target className="h-4 w-4" />} />
              )}
            </dl>
            <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              {primaryPerformance.note}
            </p>
            {showPrimaryBogeys && (
              <p className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                Bogeys use official source split data. Start-wave differences may affect inferred physical passes when wave start offsets are unknown.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600">No performance data is available yet.</p>
        )}
      </section>

      {otherReportsCount > 0 && (
        <details className="card overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-4 p-6 text-left">
            <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <FileText className="h-5 w-5 text-amber-600" />
              Other reports ({otherReportsCount})
            </span>
            <span className="text-sm font-medium text-primary-700">Show/hide</span>
          </summary>
          <div className="border-t border-gray-200 p-6">
            {officialResult && primaryPerformance?.source !== "official" && (
              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-emerald-900">Official report</h3>
                  <Link
                    to="/leg-results/$resultType/$runnerName/$year/$legNumber/$resultId"
                    params={{
                      resultType: "official",
                      runnerName,
                      year: String(selectedYear),
                      legNumber: String(selectedLegNumber),
                      resultId: "official",
                    }}
                    className="text-sm font-medium text-primary-700 hover:text-primary-800"
                  >
                    View leg result
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Metric label="Lap Time" value={officialResult.lap_time || "N/A"} />
                  <Metric label="Pace" value={formatPace(officialResult.pace || 0)} />
                  <Metric label="Source" value={formatSourceType(officialResult.source_type)} />
                </div>
              </div>
            )}

            {secondaryObservations.length > 0 ? (
              <div className="space-y-4">
                {secondaryObservations.map((observation, index) => {
                  const assumedMetrics = getObservationAssumedMetrics(observation);
                  const timeValue =
                    observation.primary_time ||
                    observation.lap_time ||
                    observation.elapsed_time ||
                    observation.moving_time;

                  return (
                    <div
                      key={observation.id || `${observation.source_type}-${index}`}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{formatObservationSource(observation)}</h3>
                          <p className="text-xs text-gray-500">
                            {observation.has_canonical_result ? "Official exists" : "Self Recorded"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openObservationModal(observation)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit self recorded data
                          </button>
                          <Link
                            to="/leg-results/$resultType/$runnerName/$year/$legNumber/$resultId"
                            params={{
                              resultType: "self-reported",
                              runnerName,
                              year: String(selectedYear),
                              legNumber: String(selectedLegNumber),
                              resultId: observation.id || "unknown",
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            Details
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteObservation(observation)}
                            disabled={deletingObservationId === observation.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingObservationId === observation.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Metric label={formatPrimaryTimeType(observation.primary_time_type)} value={timeValue || "N/A"} />
                        <Metric label="Pace" value={formatPace(observation.pace || 0)} />
                        <Metric label="GAP" value={formatGradeAdjustedPace(getObservationGradeAdjustedPace(observation))} />
                        <Metric label="Distance" value={`${formatMiles(observation.display_distance)}${assumedMetrics.distance ? " *" : ""}`} />
                        <Metric label="Elevation" value={`${formatFeet(observation.display_elevation_gain)}${assumedMetrics.elevationGain ? " *" : ""}`} />
                        <Metric label="Submitted By" value={observation.submitted_by_runner_name || "N/A"} />
                      </div>
                    </div>
                  );
                })}
                {hasAssumedObservationMetrics && (
                  <p className="text-xs text-gray-500">{ASSUMED_OBSERVATION_LEGEND}</p>
                )}
              </div>
            ) : !officialResult || primaryPerformance?.source === "official" ? (
              <p className="text-sm text-gray-600">No secondary self recorded reports.</p>
            ) : null}
          </div>
        </details>
      )}

      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Self Recorded Data
              </h2>
              <p className="text-sm text-gray-600">
                Add or update runner-supplied evidence without changing official data.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openObservationModal()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <PlusCircle className="h-4 w-4" />
            Add self recorded data
          </button>
        </div>
        {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
        {saveError && !observationModalOpen && <p className="text-sm text-red-700">{saveError}</p>}
      </section>

      {observationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="self-recorded-modal-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="self-recorded-modal-title" className="text-lg font-semibold text-gray-900">
                  {editingObservation ? "Edit self recorded data" : "Add self recorded data"}
                </h2>
                <p className="text-sm text-gray-600">
                  Self reported values stay separate from official race results.
                </p>
              </div>
              <button
                type="button"
                onClick={closeObservationModal}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close self recorded data modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveObservation} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Lap Time">
                  <input type="text" value={observationForm.lapTime} onChange={handleObservationFieldChange("lapTime")} placeholder="01:23:45" className="field-input" />
                </Field>
                <Field label="Moving Time">
                  <input type="text" value={observationForm.movingTime} onChange={handleObservationFieldChange("movingTime")} placeholder="01:23:45" className="field-input" />
                </Field>
                <Field label="Elapsed Time">
                  <input type="text" value={observationForm.elapsedTime} onChange={handleObservationFieldChange("elapsedTime")} placeholder="01:23:45" className="field-input" />
                </Field>
                <Field label="Distance">
                  <input type="number" step="0.001" min="0" value={observationForm.distance} onChange={handleObservationFieldChange("distance")} className="field-input" />
                </Field>
                <Field label="Elevation">
                  <input type="number" step="1" min="0" value={observationForm.elevationGain} onChange={handleObservationFieldChange("elevationGain")} className="field-input" />
                </Field>
                <Field label="Recording Device">
                  <select value={observationForm.sourceType} onChange={handleObservationFieldChange("sourceType")} className="field-input">
                    {sourceTypeOptions.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {formatSourceType(sourceType)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {observationForm.sourceType === "other" ? (
                <Field label="Other Device">
                  <input type="text" value={observationForm.sourceLabel} onChange={handleObservationFieldChange("sourceLabel")} placeholder="Recording device or source described by the runner" className="field-input" />
                </Field>
              ) : null}

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <span>Source Tags</span>
                </div>
                <div className="relative">
                  <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500">
                    {observationForm.sourceTags.map((sourceTag) => (
                      <button key={sourceTag} type="button" onClick={() => handleRemoveSourceTag(sourceTag)} className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-200" aria-label={`Remove ${sourceTag}`}>
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
                      placeholder={observationForm.sourceTags.length > 0 ? "Search or create tag" : sourceTagHelpText}
                    />
                  </div>
                  {showSourceTagCombobox && (
                    <div id="source-tag-options" role="listbox" aria-label="Source tag suggestions" className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredSourceTagOptions.map((sourceTag) => (
                        <button key={sourceTag} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => handleAddSourceTag(sourceTag)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-primary-50">
                          <span>{sourceTag}</span>
                          <span className="text-xs text-gray-500">Add</span>
                        </button>
                      ))}
                      {canCreateSourceTag && (
                        <button type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => handleAddSourceTag(sourceTagQuery)} className="flex w-full items-center justify-between border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-primary-800 transition-colors hover:bg-primary-50">
                          <span>{sourceTagQuery}</span>
                          <span className="text-xs text-primary-600">Create</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Field label="Metadata">
                <textarea value={observationForm.metadata} onChange={handleObservationFieldChange("metadata")} rows={4} placeholder='{"activity_id":"..."}' className="field-input font-mono" />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingObservation} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                  {editingObservation ? <Pencil className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                  <span>{savingObservation ? "Saving..." : editingObservation ? "Update self recorded data" : "Save self recorded data"}</span>
                </button>
                <button type="button" onClick={closeObservationModal} disabled={savingObservation} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400">
                  Cancel
                </button>
                {saveError && <p className="text-sm text-red-700">{saveError}</p>}
              </div>
            </form>
          </div>
        </div>
      )}

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
  <div>
    <dt className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
      {icon}
      <span>{label}</span>
    </dt>
    <dd className="text-sm font-semibold text-gray-900">{value}</dd>
  </div>
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
