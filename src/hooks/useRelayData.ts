import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

export type JoinedResult = Tables<"results"> & {
  leg_definitions: Tables<"leg_definitions">;
  runners: Tables<"runners"> | null;
};

export const useRelayData = () => {
  const [teamPerformance, setTeamPerformance] = useState<Tables<"team_performance_summary">[]>([]);
  const [legResults, setLegResults] = useState<JoinedResult[]>([]);
  const [placements, setPlacements] = useState<Tables<"placements">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch team performance summary
        const { data: performanceData, error: performanceError } =
          await supabase
            .from("team_performance_summary")
            .select("*")
            .order("year", { ascending: false });

        if (performanceError) throw performanceError;

        // Fetch leg results with definitions and runner information
        const { data: resultsData, error: resultsError } = await supabase
          .from("results")
          .select(
            `
            *,
            leg_definitions (
              *
            ),
            runners (
              *
            )
          `
          )
          .order("year", { ascending: false })
          .order("leg_number", { ascending: true });

        if (resultsError) throw resultsError;

        // Fetch placements
        const { data: placementsData, error: placementsError } = await supabase
          .from("placements")
          .select("*")
          .order("year", { ascending: false });

        if (placementsError) throw placementsError;

        // Transform the data
        setTeamPerformance(performanceData || []);

        const transformedResults =
          resultsData?.filter(result => result.runners?.name !== 'Unknown Runner' && result.runners?.name) || [];

        setLegResults(transformedResults);
        setPlacements(placementsData || []);
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

  return { teamPerformance, legResults, placements, loading, error };
};


