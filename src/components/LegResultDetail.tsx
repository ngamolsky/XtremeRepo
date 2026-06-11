import { Link, useParams } from "@tanstack/react-router";
import { Activity, Clock, FileText, Map as MapIcon, Save, User } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatGradeAdjustedPace, getGradeAdjustedPace } from "../lib/gradeAdjustedPace";
import { supabase } from "../lib/supabase";
import { formatFeet, formatMiles, formatPace, formatSourceType } from "../lib/utils";
import { Tables } from "../types/database.types";
import Breadcrumbs from "./Breadcrumbs";

const resultTypeLabels: Record<string, string> = {
  official: "Official",
  "self-reported": "Self Reported",
};

type ObservationResult = Tables<"v_leg_result_observations_with_pace">;
type ObservationUpdate = {
  distance: number | null;
  elapsed_time: string | null;
  elevation_gain: number | null;
  lap_time: string | null;
  moving_time: string | null;
  raw_metadata: Record<string, unknown>;
  source_label: string | null;
  source_tags: string[];
  source_type: string;
  updated_at: string;
};

type SelfReportedFormState = {
  distance: string;
  elapsedTime: string;
  elevationGain: string;
  lapTime: string;
  metadata: string;
  movingTime: string;
  sourceLabel: string;
  sourceTags: string;
  sourceType: string;
};

const sourceTypeOptions = ["apple_watch", "garmin", "other"];

const formatValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "N/A" : String(value);

const toFormState = (observation: ObservationResult): SelfReportedFormState => ({
  distance: observation.observed_distance?.toString() ?? "",
  elapsedTime: observation.elapsed_time ?? "",
  elevationGain: observation.observed_elevation_gain?.toString() ?? "",
  lapTime: observation.lap_time ?? "",
  metadata: observation.raw_metadata ? JSON.stringify(observation.raw_metadata, null, 2) : "{}",
  movingTime: observation.moving_time ?? "",
  sourceLabel: observation.source_label ?? "",
  sourceTags: (observation.source_tags ?? []).join(", "),
  sourceType: normalizeSelfReportedSourceType(observation.source_type),
});

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
};

const parseOptionalInteger = (value: string) => {
  const parsed = parseOptionalNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const splitTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const normalizeSelfReportedSourceType = (sourceType: string | null | undefined) =>
  sourceType === "apple_watch" || sourceType === "garmin" ? sourceType : "other";

const LegResultDetail: React.FC = () => {
  const { resultType, runnerName, year, legNumber, resultId } = useParams({
    from: "/leg-results/$resultType/$runnerName/$year/$legNumber/$resultId",
  });
  const {
    data: { legResultObservations, results },
    loading,
    error,
  } = useRelayData();
  const selectedYear = Number(year);
  const selectedLegNumber = Number(legNumber);

  const [savedObservation, setSavedObservation] = useState<ObservationResult | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const officialResult = useMemo(
    () =>
      results.find(
        (result) =>
          result.runner_name === runnerName &&
          result.year === selectedYear &&
          result.leg_number === selectedLegNumber
      ) ?? null,
    [results, runnerName, selectedLegNumber, selectedYear]
  );

  const loadedObservation = useMemo(
    () =>
      legResultObservations.find(
        (observation) => observation.id === resultId
      ) ?? null,
    [legResultObservations, resultId]
  );
  const observation = savedObservation ?? loadedObservation;
  const isSelfReported = resultType === "self-reported";
  const [form, setForm] = useState<SelfReportedFormState | null>(null);

  React.useEffect(() => {
    if (observation && !form) {
      setForm(toFormState(observation));
    }
  }, [form, observation]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading leg result...</div>;
  }

  if (error) {
    return <div className="card p-6 text-red-700">{error}</div>;
  }

  if (resultType !== "official" && resultType !== "self-reported") {
    return <div className="card p-6 text-gray-700">Unknown leg result type.</div>;
  }

  if (resultType === "official" && !officialResult) {
    return <div className="card p-6 text-gray-700">No official leg result matched this route.</div>;
  }

  if (isSelfReported && !observation) {
    return <div className="card p-6 text-gray-700">No self reported leg result matched this route.</div>;
  }

  const title = `${resultTypeLabels[resultType]} Leg Result`;
  const displayRunnerName = observation?.runner_name ?? runnerName;

  const handleFormChange =
    (field: keyof SelfReportedFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((current) => current ? { ...current, [field]: event.target.value } : current);
    };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!observation?.id || !form) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    const parsedDistance = parseOptionalNumber(form.distance);
    const parsedElevation = parseOptionalInteger(form.elevationGain);

    if (parsedDistance !== null && (!Number.isFinite(parsedDistance) || parsedDistance <= 0)) {
      setSaveError("Distance must be a positive number.");
      setSaving(false);
      return;
    }

    if (parsedElevation !== null && (!Number.isFinite(parsedElevation) || parsedElevation < 0)) {
      setSaveError("Elevation gain must be a non-negative number.");
      setSaving(false);
      return;
    }

    let metadata: Record<string, unknown>;
    try {
      const parsedMetadata = form.metadata.trim() ? JSON.parse(form.metadata) : {};
      if (!parsedMetadata || Array.isArray(parsedMetadata) || typeof parsedMetadata !== "object") {
        throw new Error("Metadata must be a JSON object.");
      }
      metadata = parsedMetadata as Record<string, unknown>;
    } catch (metadataError) {
      setSaveError(metadataError instanceof Error ? metadataError.message : "Metadata must be valid JSON.");
      setSaving(false);
      return;
    }

    const otherDeviceLabel = form.sourceLabel.trim();
    if (form.sourceType === "other" && !otherDeviceLabel) {
      setSaveError("Describe the recording device when Recording Device is Other.");
      setSaving(false);
      return;
    }

    const updatePayload: ObservationUpdate = {
      distance: parsedDistance,
      elapsed_time: form.elapsedTime.trim() || null,
      elevation_gain: parsedElevation,
      lap_time: form.lapTime.trim() || null,
      moving_time: form.movingTime.trim() || null,
      raw_metadata: metadata,
      source_label: form.sourceType === "other" ? otherDeviceLabel : null,
      source_tags: splitTags(form.sourceTags),
      source_type: form.sourceType,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: updateError } = await supabase
        .from("leg_result_observations")
        .update(updatePayload)
        .eq("id", observation.id);

      if (updateError) {
        throw updateError;
      }

      const { data: refreshedObservation, error: refreshError } = await supabase
        .from("v_leg_result_observations_with_pace")
        .select("*")
        .eq("id", observation.id)
        .single();

      if (refreshError) {
        throw refreshError;
      }

      setSavedObservation(refreshedObservation);
      setForm(toFormState(refreshedObservation));
      setSaveMessage("Saved self reported leg result.");
    } catch (saveErr) {
      setSaveError(saveErr instanceof Error ? saveErr.message : "Could not save leg result.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Breadcrumbs
        current={title}
        items={[
          { label: `${selectedYear} Race`, to: "/races/$year", params: { year } },
          {
            label: `Leg ${selectedLegNumber}`,
            to: "/legs/$legNumber",
            params: { legNumber },
          },
          {
            label: "Leg Performance",
            to: "/runs/$runnerName/$year/$legNumber",
            params: { runnerName, year, legNumber },
          },
        ]}
      />

      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-700">
              {resultTypeLabels[resultType]}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">Leg Result</h1>
            <p className="mt-2 text-gray-600">
              {displayRunnerName} • {selectedYear} Race • Leg {selectedLegNumber}
            </p>
          </div>
          <Link
            to="/runs/$runnerName/$year/$legNumber"
            params={{ runnerName, year, legNumber }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <Activity className="h-4 w-4" />
            Back to Leg Performance
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-5 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
        </div>
        {isSelfReported && observation ? (
          <ResultGrid
            rows={[
              ["Runner", observation.runner_name ?? runnerName, <User className="h-4 w-4" />],
              ["Primary Time", observation.primary_time ?? "N/A", <Clock className="h-4 w-4" />],
              ["Pace", formatPace(observation.pace || 0), <Activity className="h-4 w-4" />],
              ["Distance", formatMiles(observation.display_distance), <MapIcon className="h-4 w-4" />],
              ["Elevation", formatFeet(observation.display_elevation_gain)],
              ["Source", formatSourceType(observation.source_type)],
            ]}
          />
        ) : officialResult ? (
          <ResultGrid
            rows={[
              ["Runner", officialResult.runner_name ?? runnerName, <User className="h-4 w-4" />],
              ["Lap Time", officialResult.lap_time ?? "N/A", <Clock className="h-4 w-4" />],
              ["Pace", formatPace(officialResult.pace || 0), <Activity className="h-4 w-4" />],
              ["GAP", formatGradeAdjustedPace(getGradeAdjustedPace({ pace: officialResult.pace, distanceMiles: officialResult.distance, elevationGainFeet: officialResult.elevation_gain }))],
              ["Distance", formatMiles(officialResult.distance), <MapIcon className="h-4 w-4" />],
              ["Elevation", formatFeet(officialResult.elevation_gain)],
            ]}
          />
        ) : null}
      </section>

      {isSelfReported && observation && (
        <section className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Compare to Official</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Data point</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Self reported</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Official</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <ComparisonRow label="Lap time" official={officialResult?.lap_time} selfReported={observation.lap_time} />
                <ComparisonRow label="Primary time" official={officialResult?.lap_time} selfReported={observation.primary_time} />
                <ComparisonRow label="Distance" official={formatMiles(officialResult?.distance)} selfReported={formatMiles(observation.display_distance)} />
                <ComparisonRow label="Elevation" official={formatFeet(officialResult?.elevation_gain)} selfReported={formatFeet(observation.display_elevation_gain)} />
                <ComparisonRow label="Pace" official={formatPace(officialResult?.pace || 0)} selfReported={formatPace(observation.pace || 0)} />
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isSelfReported && observation && form && (
        <section className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Save className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Self Reported Result</h2>
          </div>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Lap Time"><input className="field-input" value={form.lapTime} onChange={handleFormChange("lapTime")} placeholder="01:23:45" /></Field>
              <Field label="Moving Time"><input className="field-input" value={form.movingTime} onChange={handleFormChange("movingTime")} placeholder="01:23:45" /></Field>
              <Field label="Elapsed Time"><input className="field-input" value={form.elapsedTime} onChange={handleFormChange("elapsedTime")} placeholder="01:23:45" /></Field>
              <Field label="Distance"><input className="field-input" type="number" step="0.001" min="0" value={form.distance} onChange={handleFormChange("distance")} /></Field>
              <Field label="Elevation Gain"><input className="field-input" type="number" step="1" min="0" value={form.elevationGain} onChange={handleFormChange("elevationGain")} /></Field>
              <Field label="Recording Device">
                <select className="field-input" value={form.sourceType} onChange={handleFormChange("sourceType")}>
                  {sourceTypeOptions.map((sourceType) => <option key={sourceType} value={sourceType}>{formatSourceType(sourceType)}</option>)}
                </select>
              </Field>
              {form.sourceType === "other" ? (
                <Field label="Other Device"><input className="field-input" value={form.sourceLabel} onChange={handleFormChange("sourceLabel")} /></Field>
              ) : null}
              <Field label="Source Tags"><input className="field-input" value={form.sourceTags} onChange={handleFormChange("sourceTags")} placeholder="Apple Fitness, Strava" /></Field>
            </div>
            <Field label="Metadata JSON">
              <textarea className="field-input min-h-32 font-mono text-xs" value={form.metadata} onChange={handleFormChange("metadata")} />
            </Field>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save self reported result"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
};

const ResultGrid: React.FC<{ rows: [string, React.ReactNode, React.ReactNode?][] }> = ({ rows }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {rows.map(([label, value, icon]) => (
      <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">{icon}{label}</p>
        <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      </div>
    ))}
  </div>
);

const ComparisonRow: React.FC<{ label: string; official: string | number | null | undefined; selfReported: string | number | null | undefined }> = ({ label, official, selfReported }) => (
  <tr>
    <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
    <td className="px-4 py-3 text-gray-800">{formatValue(selfReported)}</td>
    <td className="px-4 py-3 text-gray-800">{formatValue(official)}</td>
  </tr>
);

const Field: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <label className="block text-sm font-medium text-gray-700">
    <span className="mb-1 block">{label}</span>
    {children}
  </label>
);

export default LegResultDetail;
