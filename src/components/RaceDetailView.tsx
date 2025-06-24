import { Link, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Edit, Save, Upload, X } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useRelayData } from "../hooks/useRelayData";
import { formatPace } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import UploadResultsView from "./UploadResultsView";

const RaceDetailView: React.FC = () => {
  const params = useParams({ strict: false }) as { year?: string };
  const search = useSearch({ strict: false }) as { edit?: boolean };
  const year = params.year as string;
  const [isEditing, setIsEditing] = useState(search.edit || false);
  const [showUpload, setShowUpload] = useState(false);
  
  const {
    data: { yearlySummary, results },
    loading,
    error,
  } = useRelayData();

  const raceYear = parseInt(year);
  const raceData = yearlySummary.find((race) => race.year === raceYear);
  const raceResults = results
    .filter((r) => r.year === raceYear)
    .sort((a, b) => (a.leg_number || 0) - (b.leg_number || 0));

  const [editedRace, setEditedRace] = useState<any>(raceData || {});
  const [editedResults, setEditedResults] = useState<any[]>(raceResults || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (raceData) {
      setEditedRace(raceData);
    }
    if (raceResults) {
      setEditedResults(raceResults);
    }
  }, [raceData, raceResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!raceData && !isEditing) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Race Not Found</h2>
        <p className="text-gray-600 mb-6">
          No race data found for {year}. Would you like to add it?
        </p>
        <Button onClick={() => setIsEditing(true)}>Add Race Data</Button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Save race placement data
      const { error: placementError } = await supabase
        .from("placements")
        .upsert([
          {
            year: raceYear,
            division: editedRace.division || "",
            division_place: editedRace.division_place || 0,
            division_teams: editedRace.division_teams || 0,
            overall_place: editedRace.overall_place || 0,
            overall_teams: editedRace.overall_teams || 0,
            bib: editedRace.bib || 0,
          },
        ]);

      if (placementError) throw placementError;

      // Save results data
      if (editedResults.length > 0) {
        const resultsToUpsert = editedResults.map((result) => ({
          year: raceYear,
          leg_number: result.leg_number || 0,
          leg_version: result.leg_version || 1,
          runner: result.runner_name || "",
          lap_time: result.lap_time || "",
        }));

        const { error: resultsError } = await supabase
          .from("results")
          .upsert(resultsToUpsert);

        if (resultsError) throw resultsError;
      }

      setMessage("Race data saved successfully!");
      setIsEditing(false);
    } catch (error) {
      setMessage(`Error saving: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (showUpload) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setShowUpload(false)}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Upload Results for {year}</h1>
          </div>
        </div>
        <UploadResultsView />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/history">
            <Button variant="ghost" className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {year} Relay Race
            </h1>
            {raceData && (
              <p className="text-gray-600">
                Division: {raceData.division}
                {raceData.bib && ` • Bib #${raceData.bib}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowUpload(true)}
            className="flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload CSV</span>
          </Button>
          {isEditing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save"}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditedRace(raceData || {});
                  setEditedResults(raceResults || []);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes("successfully")
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Race Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Race Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>Total Time</Label>
              <p className="text-2xl font-bold">
                {raceData?.total_time?.toString() || "N/A"}
              </p>
            </div>
            <div>
              <Label>Overall Placement</Label>
              <p className="text-xl">
                {raceData?.overall_place || "N/A"} / {raceData?.overall_teams || "N/A"}
                {raceData?.overall_percentile && (
                  <span className="text-sm text-gray-600 block">
                    Top {Math.round(raceData.overall_percentile)}%
                  </span>
                )}
              </p>
            </div>
            <div>
              <Label>Division Placement</Label>
              <p className="text-xl">
                {raceData?.division_place || "N/A"} / {raceData?.division_teams || "N/A"}
                {raceData?.division_percentile && (
                  <span className="text-sm text-gray-600 block">
                    Top {Math.round(raceData.division_percentile)}%
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leg Results */}
      <Card>
        <CardHeader>
          <CardTitle>Leg Results</CardTitle>
        </CardHeader>
        <CardContent>
          {raceResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leg
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Runner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pace
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Elevation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {raceResults.map((leg: Tables<"v_results_with_pace">) => (
                    <tr key={leg.leg_number}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {leg.leg_number} (v{leg.leg_version})
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.runner_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.lap_time || "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPace(leg.pace || 0)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.distance ? `${leg.distance} mi` : "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {leg.elevation_gain ? `+${leg.elevation_gain} ft` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No leg results available</p>
              <Button
                onClick={() => setIsEditing(true)}
                className="mt-4"
              >
                Add Results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RaceDetailView;