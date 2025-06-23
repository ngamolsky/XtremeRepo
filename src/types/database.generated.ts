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
          variables?: Json
          operationName?: string
          query?: string
          extensions?: Json
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
      photo_tags: {
        Row: {
          photo_id: string
          runner_id: string
        }
        Insert: {
          photo_id: string
          runner_id: string
        }
        Update: {
          photo_id?: string
          runner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_tags_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_tags_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          is_public: boolean | null
          leg_number: number | null
          leg_version: number | null
          mime_type: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          year: number
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          leg_number?: number | null
          leg_version?: number | null
          mime_type?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          year: number
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          leg_number?: number | null
          leg_version?: number | null
          mime_type?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_leg_number_fkey"
            columns: ["leg_number", "leg_version"]
            isOneToOne: false
            referencedRelation: "leg_definitions"
            referencedColumns: ["number", "version"]
          },
        ]
      }
      placements: {
        Row: {
          bib: number | null
          division: string | null
          division_place: number | null
          division_teams: number | null
          overall_place: number | null
          overall_teams: number | null
          year: number
        }
        Insert: {
          bib?: number | null
          division?: string | null
          division_place?: number | null
          division_teams?: number | null
          overall_place?: number | null
          overall_teams?: number | null
          year: number
        }
        Update: {
          bib?: number | null
          division?: string | null
          division_place?: number | null
          division_teams?: number | null
          overall_place?: number | null
          overall_teams?: number | null
          year?: number
        }
        Relationships: []
      }
      results: {
        Row: {
          lap_time: unknown | null
          leg_number: number
          leg_version: number
          user_id: string | null
          year: number
        }
        Insert: {
          lap_time?: unknown | null
          leg_number: number
          leg_version: number
          user_id?: string | null
          year: number
        }
        Update: {
          lap_time?: unknown | null
          leg_number?: number
          leg_version?: number
          user_id?: string | null
          year?: number
        }
        Relationships: [
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
          average_pace: unknown | null
          division_place: number | null
          division_teams: number | null
          improvement: number | null
          overall_place: number | null
          overall_teams: number | null
          total_time: unknown | null
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
          distance: number | null
          elevation_gain: number | null
          lap_time: unknown | null
          leg_number: number | null
          leg_version: number | null
          pace: number | null
          runner_id: string | null
          runner_name: string | null
          time_in_minutes: number | null
          year: number | null
        }
        Relationships: [
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
      v_runner_stats: {
        Row: {
          average_pace: number | null
          average_time: number | null
          best_pace: number | null
          best_pace_legs_with_versions: Json | null
          best_time: number | null
          legs_run: Json | null
          runner_id: string | null
          runner_name: string | null
          total_distance: number | null
          total_races: number | null
          total_time_minutes: number | null
          unique_legs: number | null
          unique_years: number | null
        }
        Relationships: [
          {
            foreignKeyName: "results_user_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
        ]
      }
      v_yearly_summary: {
        Row: {
          average_pace: unknown | null
          bib: number | null
          division: string | null
          division_percentile: number | null
          division_place: number | null
          division_teams: number | null
          improvement: number | null
          overall_percentile: number | null
          overall_place: number | null
          overall_teams: number | null
          total_time: unknown | null
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
        Args: { time_interval: unknown }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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

