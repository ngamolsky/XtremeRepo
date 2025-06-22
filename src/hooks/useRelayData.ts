import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

export type RelayData = {
  results: Tables<"v_results_with_pace">[];
  runnerStats: Tables<"v_runner_stats">[];
  legVersionStats: Tables<"v_leg_version_stats">[];
  yearlySummary: Tables<"v_yearly_summary">[];
};

export const useRelayData = () => {
  const [data, setData] = useState<RelayData>({
    results: [],
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
          resultsRes,
          runnerStatsRes,
          legVersionStatsRes,
          yearlySummaryRes,
        ] = await Promise.all([
          supabase.from("v_results_with_pace").select("*"),
          supabase.from("v_runner_stats").select("*"),
          supabase.from("v_leg_version_stats").select("*"),
          supabase.from("v_yearly_summary").select("*").order("year", { ascending: false }),
        ]);

        if (resultsRes.error) throw resultsRes.error;
        if (runnerStatsRes.error) throw runnerStatsRes.error;
        if (legVersionStatsRes.error) throw legVersionStatsRes.error;
        if (yearlySummaryRes.error) throw yearlySummaryRes.error;

        setData({
          results: resultsRes.data || [],
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


