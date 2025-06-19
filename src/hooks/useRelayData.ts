import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tables } from "../types/database.types";

export const useRelayData = () => {
  const [teamPerformance, setTeamPerformance] = useState<Tables<"team_performance_summary">[]>([]);
  const [legResults, setLegResults] = useState<Tables<"results">[]>([]);
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
              distance,
              elevation_gain
            ),
            runners (
              name,
              email
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
          resultsData?.map((result) => ({
            ...result,
            distance: result.leg_definitions.distance || 0,
            elevation_gain: result.leg_definitions.elevation_gain || 0,
            runner: result.runners?.name || 'Unknown Runner',
            total_leg_time_minutes: result.lap_time
              ? parseTimeToMinutes(result.lap_time)
              : 0,
          })) || [];

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

// Helper to parse lap_time string to minutes
function parseTimeToMinutes(timeString: unknown): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  const parts = timeString.split(":");
  if (parts.length === 3) {
    // hh:mm:ss
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    return hours * 60 + minutes + seconds / 60;
  } else if (parts.length === 2) {
    // mm:ss
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes + seconds / 60;
  }
  return 0;
}
