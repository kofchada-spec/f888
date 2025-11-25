export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          calories: number
          created_at: string
          date: string
          distance_km: number
          duration_min: number
          end_time: string | null
          id: string
          start_time: string | null
          steps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          calories?: number
          created_at?: string
          date?: string
          distance_km?: number
          duration_min?: number
          end_time?: string | null
          id?: string
          start_time?: string | null
          steps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          calories?: number
          created_at?: string
          date?: string
          distance_km?: number
          duration_min?: number
          end_time?: string | null
          id?: string
          start_time?: string | null
          steps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          created_at: string
          description: string
          id: string
          page_url: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_years: number | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          first_name: string | null
          gender: string | null
          height_m: number | null
          id: string
          last_name: string | null
          onboarding_complete: boolean | null
          profile_complete: boolean | null
          profile_completed: boolean | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age_years?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          first_name?: string | null
          gender?: string | null
          height_m?: number | null
          id?: string
          last_name?: string | null
          onboarding_complete?: boolean | null
          profile_complete?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age_years?: number | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          first_name?: string | null
          gender?: string | null
          height_m?: number | null
          id?: string
          last_name?: string | null
          onboarding_complete?: boolean | null
          profile_complete?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      route_generations: {
        Row: {
          activity_type: string
          generated_at: string | null
          id: string
          month_year: string
          trip_type: string
          user_id: string
        }
        Insert: {
          activity_type: string
          generated_at?: string | null
          id?: string
          month_year: string
          trip_type: string
          user_id: string
        }
        Update: {
          activity_type?: string
          generated_at?: string | null
          id?: string
          month_year?: string
          trip_type?: string
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          trial_end: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          progress: number | null
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          progress?: number | null
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          progress?: number | null
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          activities_goal: number | null
          activity_type: string
          calories_goal: number | null
          created_at: string | null
          distance_goal: number | null
          id: string
          period: string
          steps_goal: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activities_goal?: number | null
          activity_type: string
          calories_goal?: number | null
          created_at?: string | null
          distance_goal?: number | null
          id?: string
          period: string
          steps_goal?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activities_goal?: number | null
          activity_type?: string
          calories_goal?: number | null
          created_at?: string | null
          distance_goal?: number | null
          id?: string
          period?: string
          steps_goal?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          current_streak_days: number | null
          id: string
          last_activity_date: string | null
          longest_streak_days: number | null
          total_activities: number | null
          total_calories: number | null
          total_distance_km: number | null
          total_run_calories: number | null
          total_run_distance_km: number | null
          total_run_steps: number | null
          total_run_time_minutes: number | null
          total_runs: number | null
          total_time_minutes: number | null
          total_walk_calories: number | null
          total_walk_distance_km: number | null
          total_walk_steps: number | null
          total_walk_time_minutes: number | null
          total_walks: number | null
          updated_at: string | null
          user_id: string
          weekly_goal_km: number | null
          weekly_progress_km: number | null
        }
        Insert: {
          created_at?: string | null
          current_streak_days?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak_days?: number | null
          total_activities?: number | null
          total_calories?: number | null
          total_distance_km?: number | null
          total_run_calories?: number | null
          total_run_distance_km?: number | null
          total_run_steps?: number | null
          total_run_time_minutes?: number | null
          total_runs?: number | null
          total_time_minutes?: number | null
          total_walk_calories?: number | null
          total_walk_distance_km?: number | null
          total_walk_steps?: number | null
          total_walk_time_minutes?: number | null
          total_walks?: number | null
          updated_at?: string | null
          user_id: string
          weekly_goal_km?: number | null
          weekly_progress_km?: number | null
        }
        Update: {
          created_at?: string | null
          current_streak_days?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak_days?: number | null
          total_activities?: number | null
          total_calories?: number | null
          total_distance_km?: number | null
          total_run_calories?: number | null
          total_run_distance_km?: number | null
          total_run_steps?: number | null
          total_run_time_minutes?: number | null
          total_runs?: number | null
          total_time_minutes?: number | null
          total_walk_calories?: number | null
          total_walk_distance_km?: number | null
          total_walk_steps?: number | null
          total_walk_time_minutes?: number | null
          total_walks?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_goal_km?: number | null
          weekly_progress_km?: number | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle_start: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          platform: string | null
          started_at: string | null
          status: string
          subscription_type: string
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle_start?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform?: string | null
          started_at?: string | null
          status?: string
          subscription_type?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle_start?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          platform?: string | null
          started_at?: string | null
          status?: string
          subscription_type?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      walk_activities: {
        Row: {
          activity_type: string
          calories_burned: number | null
          created_at: string | null
          distance_km: number | null
          duration_minutes: number | null
          id: string
          steps: number | null
          user_id: string
        }
        Insert: {
          activity_type?: string
          calories_burned?: number | null
          created_at?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          steps?: number | null
          user_id: string
        }
        Update: {
          activity_type?: string
          calories_burned?: number | null
          created_at?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          steps?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_streak: { Args: { p_user_id: string }; Returns: number }
      get_current_billing_cycle: {
        Args: { p_user_id: string }
        Returns: unknown
      }
      get_monthly_generation_count: {
        Args: { p_trip_type?: string; p_user_id: string }
        Returns: number
      }
      get_next_reset_date: { Args: { p_user_id: string }; Returns: string }
      get_user_activity_stats: { Args: { p_user_id: string }; Returns: Json }
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
  public: {
    Enums: {},
  },
} as const
