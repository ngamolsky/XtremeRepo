import { MergeDeep } from 'type-fest'
import { Database as DatabaseGenerated } from './database.generated'


export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Tables: {
        leg_result_observations: {
          Row: {
            elapsed_time: string | null
            lap_time: string | null
            moving_time: string | null
          }
          Insert: {
            elapsed_time?: string | null
            lap_time?: string | null
            moving_time?: string | null
          }
          Update: {
            elapsed_time?: string | null
            lap_time?: string | null
            moving_time?: string | null
          }
        }
        results: {
          Row: {
            lap_time: string
          }
          Insert: {
            lap_time?: string | null
          }
          Update: {
            lap_time?: string | null
          }
        }
      },
      Views: {
        team_performance_summary: {
          Row: {
            total_time: string
            average_pace: string
          }
        }
        v_results_with_pace: {
          Row: {
            lap_time: string
          }
        }
        v_leg_result_observations_with_pace: {
          Row: {
            canonical_lap_time: string | null
            elapsed_time: string | null
            lap_time: string | null
            moving_time: string | null
            primary_time: string | null
          }
        }
        v_bogey_events: {
          Row: {
            event_id: string
            year: number
            runner_id: string | null
            runner_name: string | null
            leg_number: number
            leg_version: number
            event_type: "passed_by_us" | "passed_us"
            other_team_result_id: string
            other_team_name: string | null
            other_bib: string | null
            other_division: string | null
            seconds_swung: number | null
            our_elapsed_before_seconds: number
            our_elapsed_after_seconds: number
            other_elapsed_before_seconds: number
            other_elapsed_after_seconds: number
            our_start_offset_seconds: number | null
            other_start_offset_seconds: number | null
            start_offsets_known: boolean
            time_basis: "known_start_offsets" | "same_start_assumed"
          }
        }
      }
    }
  }
>


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
