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
          query?: string
          operationName?: string
          extensions?: Json
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
            referencedColumns: ["email"]
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
          created_at: string
          email: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
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
    }
    Functions: {
      [_ in never]: never
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

