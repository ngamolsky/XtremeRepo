import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TeamPerformance, LegResult, YearlyPlacement } from '../types/database';

export const useRelayData = () => {
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [legResults, setLegResults] = useState<LegResult[]>([]);
  const [placements, setPlacements] = useState<YearlyPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch team performance summary
        const { data: performanceData, error: performanceError } = await supabase
          .from('team_performance_summary')
          .select('*')
          .order('year', { ascending: false });

        if (performanceError) throw performanceError;

        // Fetch leg results with definitions
        const { data: resultsData, error: resultsError } = await supabase
          .from('results')
          .select(`
            *,
            leg_definitions (
              distance,
              elevation_gain
            )
          `)
          .order('year', { ascending: false })
          .order('leg_number', { ascending: true });

        if (resultsError) throw resultsError;

        // Fetch placements
        const { data: placementsData, error: placementsError } = await supabase
          .from('placements')
          .select('*')
          .order('year', { ascending: false });

        if (placementsError) throw placementsError;

        // Transform the data
        setTeamPerformance(performanceData || []);
        
        const transformedResults = resultsData?.map(result => ({
          ...result,
          distance: (result.leg_definitions as any)?.distance || 0,
          elevation_gain: (result.leg_definitions as any)?.elevation_gain || 0
        })) || [];
        
        setLegResults(transformedResults);
        setPlacements(placementsData || []);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
        console.error('Error fetching relay data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { teamPerformance, legResults, placements, loading, error };
};