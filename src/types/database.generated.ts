export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      leg_definitions: {
        Row: {
          distance: number | null
          elevation_gain: number | null
          number: number
          version: number
        }
        Insert: {
          distance?: number | null
          elevation_gain?: number | null
          number: number
          version: number
        }
        Update: {
          distance?: number | null
          elevation_gain?: number | null
          number?: number
          version?: number
        }
        Relationships: []
      }
      leg_result_observations: {
        Row: {
          created_at: string
          distance: number | null
          elapsed_time: string | null
          elevation_gain: number | null
          id: string
          lap_time: string | null
          leg_number: number
          leg_version: number
          moving_time: string | null
          notes: string | null
          raw_metadata: Json
          runner_id: string | null
          source_label: string | null
          source_type: string
          submitted_by_runner_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          distance?: number | null
          elapsed_time?: string | null
          elevation_gain?: number | null
          id?: string
          lap_time?: string | null
          leg_number: number
          leg_version: number
          moving_time?: string | null
          notes?: string | null
          raw_metadata?: Json
          runner_id?: string | null
          source_label?: string | null
          source_type?: string
          submitted_by_runner_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          distance?: number | null
          elapsed_time?: string | null
          elevation_gain?: number | null
          id?: string
          lap_time?: string | null
          leg_number?: number
          leg_version?: number
          moving_time?: string | null
          notes?: string | null
          raw_metadata?: Json
          runner_id?: string | null
          source_label?: string | null
          source_type?: string
          submitted_by_runner_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leg_result_observations_leg_definitions_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
          {
            foreignKeyName: "leg_result_observations_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_result_observations_submitted_by_runner_id_fkey"
            columns: ["submitted_by_runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_result_observations_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      placements: {
        Row: {
          bib: number | null
          division: string | null
          division_place: number | null
          division_teams: number | null
          notes: string | null
          overall_place: number | null
          overall_teams: number | null
          race_start_time: string
          year: number
        }
        Insert: {
          bib?: number | null
          division?: string | null
          division_place?: number | null
          division_teams?: number | null
          notes?: string | null
          overall_place?: number | null
          overall_teams?: number | null
          race_start_time?: string
          year: number
        }
        Update: {
          bib?: number | null
          division?: string | null
          division_place?: number | null
          division_teams?: number | null
          notes?: string | null
          overall_place?: number | null
          overall_teams?: number | null
          race_start_time?: string
          year?: number
        }
        Relationships: []
      }
      race_participations: {
        Row: {
          created_at: string
          notes: string | null
          runner_id: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          notes?: string | null
          runner_id: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          notes?: string | null
          runner_id?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "race_participations_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_participations_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      race_photo_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          photo_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          photo_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          photo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_photo_notes_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "race_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      race_photos: {
        Row: {
          alt_text: string | null
          caption: string | null
          category: string
          content_type: string | null
          created_at: string
          event_name: string
          featured: boolean
          height: number | null
          id: string
          original_filename: string | null
          race: string
          size_bytes: number | null
          sort_order: number
          source: string | null
          storage_bucket: string
          storage_path: string
          tags: string[]
          taken_on: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
          year: number
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          category?: string
          content_type?: string | null
          created_at?: string
          event_name?: string
          featured?: boolean
          height?: number | null
          id?: string
          original_filename?: string | null
          race?: string
          size_bytes?: number | null
          sort_order?: number
          source?: string | null
          storage_bucket?: string
          storage_path: string
          tags?: string[]
          taken_on?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
          year: number
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          category?: string
          content_type?: string | null
          created_at?: string
          event_name?: string
          featured?: boolean
          height?: number | null
          id?: string
          original_filename?: string | null
          race?: string
          size_bytes?: number | null
          sort_order?: number
          source?: string | null
          storage_bucket?: string
          storage_path?: string
          tags?: string[]
          taken_on?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
          year?: number
        }
        Relationships: []
      }
      results: {
        Row: {
          canonical_observation_id: string | null
          lap_time: string | null
          leg_number: number
          leg_version: number
          notes: string | null
          source_type: string
          user_id: string | null
          year: number
        }
        Insert: {
          canonical_observation_id?: string | null
          lap_time?: string | null
          leg_number: number
          leg_version: number
          notes?: string | null
          source_type?: string
          user_id?: string | null
          year: number
        }
        Update: {
          canonical_observation_id?: string | null
          lap_time?: string | null
          leg_number?: number
          leg_version?: number
          notes?: string | null
          source_type?: string
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_canonical_observation_id_fkey"
            columns: ["canonical_observation_id"]
            isOneToOne: false
            referencedRelation: "leg_result_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_canonical_observation_id_fkey"
            columns: ["canonical_observation_id"]
            isOneToOne: false
            referencedRelation: "v_leg_result_observations_with_pace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_leg_definitions_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      runners: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      team_performance_summary: {
        Row: {
          average_pace: string | null
          division_place: number | null
          division_teams: number | null
          improvement: number | null
          overall_place: number | null
          overall_teams: number | null
          race_start_time: string | null
          total_time: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      v_leg_result_observations_with_pace: {
        Row: {
          auth_user_id: string | null
          canonical_distance: number | null
          canonical_elevation_gain: number | null
          canonical_lap_time: string | null
          canonical_runner_id: string | null
          canonical_runner_name: string | null
          created_at: string | null
          display_distance: number | null
          display_elevation_gain: number | null
          elapsed_time: string | null
          has_canonical_result: boolean | null
          id: string | null
          lap_time: string | null
          leg_number: number | null
          leg_version: number | null
          moving_time: string | null
          notes: string | null
          observed_distance: number | null
          observed_elevation_gain: number | null
          pace: number | null
          primary_time: string | null
          primary_time_type: string | null
          race_start_time: string | null
          raw_metadata: Json | null
          runner_id: string | null
          runner_name: string | null
          source_label: string | null
          source_type: string | null
          submitted_by_runner_id: string | null
          submitted_by_runner_name: string | null
          time_in_minutes: number | null
          updated_at: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leg_result_observations_leg_definitions_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
          {
            foreignKeyName: "leg_result_observations_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_result_observations_submitted_by_runner_id_fkey"
            columns: ["submitted_by_runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leg_result_observations_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["canonical_runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      v_leg_version_stats: {
        Row: {
          average_pace: number | null
          best_pace: number | null
          best_pace_runner_years: Json | null
          distance: number | null
          elevation_gain: number | null
          leg_number: number | null
          leg_version: number | null
          runs: number | null
          total_distance: number | null
          total_time: number | null
          unique_runners: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_leg_definitions_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
        ]
      }
      v_results_with_pace: {
        Row: {
          auth_user_id: string | null
          canonical_observation_id: string | null
          distance: number | null
          elevation_gain: number | null
          lap_time: string | null
          leg_finish_time: string | null
          leg_number: number | null
          leg_start_time: string | null
          leg_version: number | null
          notes: string | null
          pace: number | null
          race_start_time: string | null
          runner_id: string | null
          runner_name: string | null
          source_type: string | null
          time_in_minutes: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_canonical_observation_id_fkey"
            columns: ["canonical_observation_id"]
            isOneToOne: false
            referencedRelation: "leg_result_observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_canonical_observation_id_fkey"
            columns: ["canonical_observation_id"]
            isOneToOne: false
            referencedRelation: "v_leg_result_observations_with_pace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_leg_definitions_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      v_runner_participations: {
        Row: {
          auth_user_id: string | null
          has_known_leg: boolean | null
          known_legs: Json | null
          notes: string | null
          runner_id: string | null
          runner_name: string | null
          status: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "race_participations_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_participations_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
      v_runner_stats: {
        Row: {
          average_pace: number | null
          average_time: number | null
          best_pace: number | null
          best_pace_legs_with_versions: Json | null
          best_time: number | null
          known_leg_runs: number | null
          legs_run: Json | null
          participation_years: Json | null
          runner_id: string | null
          runner_name: string | null
          total_distance: number | null
          total_races: number | null
          total_time_minutes: number | null
          unique_legs: number | null
          unique_years: number | null
          unknown_leg_years: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "race_participations_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      v_yearly_summary: {
        Row: {
          average_pace: string | null
          bib: number | null
          division: string | null
          division_percentile: number | null
          division_place: number | null
          division_teams: number | null
          improvement: number | null
          notes: string | null
          overall_percentile: number | null
          overall_place: number | null
          overall_teams: number | null
          participant_count: number | null
          race_start_time: string | null
          total_time: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_year_fkey"
            columns: ["year"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["year"]
          },
        ]
      }
    }
    Functions: {
      parse_time_to_minutes: {
        Args: { time_interval: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
