export interface Database {
  public: {
    Tables: {
      results: {
        Row: {
          year: number;
          leg_number: number;
          leg_version: number;
          runner: string | null;
          lap_time: string | null;
        };
      };
      leg_definitions: {
        Row: {
          number: number;
          version: number;
          distance: number | null;
          elevation_gain: number | null;
        };
      };
      placements: {
        Row: {
          year: number;
          division: string | null;
          division_place: number | null;
          division_teams: number | null;
          overall_place: number | null;
          overall_teams: number | null;
          bib: number | null;
        };
      };
    };
    Views: {
      team_performance_summary: {
        Row: {
          year: number | null;
          total_time: string | null;
          average_pace: string | null;
          division_place: number | null;
          division_teams: number | null;
          overall_place: number | null;
          overall_teams: number | null;
          improvement: number | null;
        };
      };
    };
  };
}

export type TeamPerformance =
  Database["public"]["Views"]["team_performance_summary"]["Row"];
export type LegResult = Database["public"]["Tables"]["results"]["Row"] & {
  distance?: number;
  elevation_gain?: number;
};
export type YearlyPlacement = Database["public"]["Tables"]["placements"]["Row"];
export type LegDefinition =
  Database["public"]["Tables"]["leg_definitions"]["Row"];
