import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

type SupabaseRowsResponse<T> = {
  data: T[] | null;
  error: { code?: string; message: string } | null;
};

export type RelayData = {
  legDefinitions: Tables<"leg_definitions">[];
  raceLegAssignments: Tables<"v_race_leg_assignments">[];
  legResultObservations: Tables<"v_leg_result_observations_with_pace">[];
  results: Tables<"v_results_with_pace">[];
  participations: Tables<"v_runner_participations">[];
  runnerStats: Tables<"v_runner_stats">[];
  legVersionStats: Tables<"v_leg_version_stats">[];
  yearlySummary: Tables<"v_yearly_summary">[];
};

const isMissingOptionalRelation = (error: { code?: string; message: string }) =>
  error.code === "PGRST205" ||
  error.code === "42P01" ||
  error.message.includes("Could not find the table") ||
  error.message.includes("does not exist");

const readOptionalRows = <T>(
  response: SupabaseRowsResponse<T>,
  relationName: string
): T[] => {
  if (!response.error) {
    return response.data || [];
  }

  if (isMissingOptionalRelation(response.error)) {
    console.warn(
      `${relationName} is not available yet; run the latest Supabase migration to enable self recorded leg data.`
    );
    return [];
  }

  throw response.error;
};

export const useRelayData = () => {
  const [data, setData] = useState<RelayData>({
    legDefinitions: [],
    raceLegAssignments: [],
    legResultObservations: [],
    results: [],
    participations: [],
    runnerStats: [],
    legVersionStats: [],
    yearlySummary: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          legDefinitionsRes,
          raceLegAssignmentsRes,
          legResultObservationsRes,
          resultsRes,
          participationsRes,
          runnerStatsRes,
          legVersionStatsRes,
          yearlySummaryRes,
        ] = await Promise.all([
          supabase.from("leg_definitions").select("*"),
          supabase.from("v_race_leg_assignments").select("*"),
          supabase.from("v_leg_result_observations_with_pace").select("*"),
          supabase.from("v_results_with_pace").select("*"),
          supabase.from("v_runner_participations").select("*"),
          supabase.from("v_runner_stats").select("*"),
          supabase.from("v_leg_version_stats").select("*"),
          supabase.from("v_yearly_summary").select("*").order("year", { ascending: false }),
        ]);

        if (legDefinitionsRes.error) throw legDefinitionsRes.error;
        if (resultsRes.error) throw resultsRes.error;
        if (participationsRes.error) throw participationsRes.error;
        if (runnerStatsRes.error) throw runnerStatsRes.error;
        if (legVersionStatsRes.error) throw legVersionStatsRes.error;
        if (yearlySummaryRes.error) throw yearlySummaryRes.error;

        setData({
          legDefinitions: legDefinitionsRes.data || [],
          raceLegAssignments: readOptionalRows(
            raceLegAssignmentsRes,
            "v_race_leg_assignments"
          ),
          legResultObservations: readOptionalRows(
            legResultObservationsRes,
            "v_leg_result_observations_with_pace"
          ),
          results: resultsRes.data || [],
          participations: participationsRes.data || [],
          runnerStats: runnerStatsRes.data || [],
          legVersionStats: legVersionStatsRes.data || [],
          yearlySummary: yearlySummaryRes.data || [],
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching data"
        );
        console.error("Error fetching relay data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
};
