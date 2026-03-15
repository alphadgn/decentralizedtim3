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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_request_at: string | null
          name: string
          requests_month: number
          requests_today: number
          revoked_at: string | null
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_request_at?: string | null
          name?: string
          requests_month?: number
          requests_today?: number
          revoked_at?: string | null
          tier?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_request_at?: string | null
          name?: string
          requests_month?: number
          requests_today?: number
          revoked_at?: string | null
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          approved_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          attempt_count: number
          blocked_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          attempt_count?: number
          blocked_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          attempt_count?: number
          blocked_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      ip_rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: string
          request_count: number
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address: string
          request_count?: number
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      node_registrations: {
        Row: {
          created_at: string
          endpoint_url: string | null
          id: string
          node_name: string
          region: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint_url?: string | null
          id?: string
          node_name: string
          region: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint_url?: string | null
          id?: string
          node_name?: string
          region?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      node_stakes: {
        Row: {
          created_at: string
          drift_avg_ms: number
          id: string
          last_observation_at: string | null
          node_id: string
          reputation: string
          slashed_amount: number
          stake_amount: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drift_avg_ms?: number
          id?: string
          last_observation_at?: string | null
          node_id: string
          reputation?: string
          slashed_amount?: number
          stake_amount?: number
          trust_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          drift_avg_ms?: number
          id?: string
          last_observation_at?: string | null
          node_id?: string
          reputation?: string
          slashed_amount?: number
          stake_amount?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_stakes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "node_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          acknowledged: boolean
          alert_type: string
          created_at: string
          endpoint: string | null
          id: string
          ip_address: string | null
          message: string
          metadata: Json | null
          severity: string
        }
        Insert: {
          acknowledged?: boolean
          alert_type: string
          created_at?: string
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          message: string
          metadata?: Json | null
          severity?: string
        }
        Update: {
          acknowledged?: boolean
          alert_type?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          ip_address?: string | null
          message?: string
          metadata?: Json | null
          severity?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          api_key_id: string | null
          chain_index: number
          created_at: string
          current_hash: string | null
          endpoint: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          method: string | null
          previous_hash: string | null
          request_signature: string | null
          response_code: number | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          chain_index?: number
          created_at?: string
          current_hash?: string | null
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          previous_hash?: string | null
          request_signature?: string | null
          response_code?: number | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          chain_index?: number
          created_at?: string
          current_hash?: string | null
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string | null
          previous_hash?: string | null
          request_signature?: string | null
          response_code?: number | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      time_anchors: {
        Row: {
          block_number: number | null
          blockchain: string
          consensus_hash: string
          created_at: string
          epoch: number
          id: string
          tx_hash: string | null
          validator_signatures: Json
        }
        Insert: {
          block_number?: number | null
          blockchain?: string
          consensus_hash: string
          created_at?: string
          epoch: number
          id?: string
          tx_hash?: string | null
          validator_signatures?: Json
        }
        Update: {
          block_number?: number | null
          blockchain?: string
          consensus_hash?: string
          created_at?: string
          epoch?: number
          id?: string
          tx_hash?: string | null
          validator_signatures?: Json
        }
        Relationships: []
      }
      trade_events: {
        Row: {
          api_key_id: string | null
          canonical_timestamp: number
          created_at: string
          event_hash: string
          exchange_id: string
          id: string
          sequence_number: number
          signature: string
          verification_proof: string | null
        }
        Insert: {
          api_key_id?: string | null
          canonical_timestamp: number
          created_at?: string
          event_hash: string
          exchange_id: string
          id?: string
          sequence_number: number
          signature: string
          verification_proof?: string | null
        }
        Update: {
          api_key_id?: string | null
          canonical_timestamp?: number
          created_at?: string
          event_hash?: string
          exchange_id?: string
          id?: string
          sequence_number?: number
          signature?: string
          verification_proof?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          api_key_expiry_alerts: boolean
          created_at: string
          dashboard_auto_refresh: boolean
          email_notifications: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_expiry_alerts?: boolean
          created_at?: string
          dashboard_auto_refresh?: boolean
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_expiry_alerts?: boolean
          created_at?: string
          dashboard_auto_refresh?: boolean
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      node_stakes_public: {
        Row: {
          created_at: string | null
          drift_avg_ms: number | null
          id: string | null
          last_observation_at: string | null
          node_id: string | null
          reputation: string | null
          stake_amount: number | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          drift_avg_ms?: number | null
          id?: string | null
          last_observation_at?: string | null
          node_id?: string | null
          reputation?: string | null
          stake_amount?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          drift_avg_ms?: number | null
          id?: string | null
          last_observation_at?: string | null
          node_id?: string | null
          reputation?: string | null
          stake_amount?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "node_stakes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "node_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      compute_security_log_hash: {
        Args: {
          p_api_key_id: string
          p_chain_index: number
          p_created_at: string
          p_endpoint: string
          p_event_type: string
          p_ip_address: string
          p_metadata: Json
          p_method: string
          p_previous_hash: string
          p_response_code: number
          p_severity: string
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      nextval_trade_seq: { Args: never; Returns: number }
      run_hourly_chain_integrity_scan: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user" | "auditor" | "support"
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
    Enums: {
      app_role: ["super_admin", "admin", "user", "auditor", "support"],
    },
  },
} as const
