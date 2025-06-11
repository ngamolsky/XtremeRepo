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
        
        // Check if Supabase is properly configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
          throw new Error('Please connect to Supabase by clicking the "Connect to Supabase" button in the top right corner.');
        }
        
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
        setTeamPerformance(performanceData as TeamPerformance[]);
        
        const transformedResults = resultsData?.map(result => ({
          year: result.year,
          leg_number: result.leg_number,
          leg_version: result.leg_version,
          runner: result.runner || 'Unknown',
          lap_time: result.lap_time || '00:00:00',
          distance: (result.leg_definitions as any)?.distance || 0,
          elevation_gain: (result.leg_definitions as any)?.elevation_gain || 0
        })) || [];
        
        setLegResults(transformedResults);
        setPlacements(placementsData as YearlyPlacement[]);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { teamPerformance, legResults, placements, loading, error };
};