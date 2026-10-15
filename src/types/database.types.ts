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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      drop_claims: {
        Row: {
          cancelled_at: string | null
          claimed_at: string
          drop_id: string
          expires_at: string
          id: string
          merchant_id: string
          price_snapshot: number
          redeemed_at: string | null
          redeemed_by: string | null
          request_id: string
          status: string
          terms_snapshot: string
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          claimed_at?: string
          drop_id: string
          expires_at: string
          id?: string
          merchant_id: string
          price_snapshot: number
          redeemed_at?: string | null
          redeemed_by?: string | null
          request_id: string
          status?: string
          terms_snapshot: string
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          claimed_at?: string
          drop_id?: string
          expires_at?: string
          id?: string
          merchant_id?: string
          price_snapshot?: number
          redeemed_at?: string | null
          redeemed_by?: string | null
          request_id?: string
          status?: string
          terms_snapshot?: string
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_claims_drop_id_merchant_id_fkey"
            columns: ["drop_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id", "merchant_id"]
          },
          {
            foreignKeyName: "drop_claims_drop_id_merchant_id_venue_id_fkey"
            columns: ["drop_id", "merchant_id", "venue_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id", "merchant_id", "venue_id"]
          },
        ]
      }
      drops: {
        Row: {
          claim_limit: number
          claim_revision: number
          created_at: string
          currency: string
          description: string
          discount_type: string
          drop_price: number
          ends_at: string
          experience_id: string | null
          id: string
          merchant_id: string
          original_price: number | null
          per_user_limit: number
          redemption_ends_at: string | null
          redemption_lifetime_seconds: number
          slug: string
          starts_at: string
          status: string
          terms: string
          title: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          claim_limit: number
          claim_revision?: number
          created_at?: string
          currency?: string
          description: string
          discount_type?: string
          drop_price: number
          ends_at: string
          experience_id?: string | null
          id?: string
          merchant_id: string
          original_price?: number | null
          per_user_limit?: number
          redemption_ends_at?: string | null
          redemption_lifetime_seconds?: number
          slug: string
          starts_at: string
          status?: string
          terms: string
          title: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          claim_limit?: number
          claim_revision?: number
          created_at?: string
          currency?: string
          description?: string
          discount_type?: string
          drop_price?: number
          ends_at?: string
          experience_id?: string | null
          id?: string
          merchant_id?: string
          original_price?: number | null
          per_user_limit?: number
          redemption_ends_at?: string | null
          redemption_lifetime_seconds?: number
          slug?: string
          starts_at?: string
          status?: string
          terms?: string
          title?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drops_experience_id_merchant_id_venue_id_fkey"
            columns: ["experience_id", "merchant_id", "venue_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id", "merchant_id", "venue_id"]
          },
          {
            foreignKeyName: "drops_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drops_venue_id_merchant_id_fkey"
            columns: ["venue_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id", "merchant_id"]
          },
        ]
      }
      experience_schedules: {
        Row: {
          closes_at: string
          created_at: string
          experience_id: string
          id: string
          opens_at: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          experience_id: string
          id?: string
          opens_at: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          experience_id?: string
          id?: string
          opens_at?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "experience_schedules_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_vibes: {
        Row: {
          experience_id: string
          vibe_id: string
        }
        Insert: {
          experience_id: string
          vibe_id: string
        }
        Update: {
          experience_id?: string
          vibe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_vibes_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_vibes_vibe_id_fkey"
            columns: ["vibe_id"]
            isOneToOne: false
            referencedRelation: "vibes"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          booking_required: boolean
          category_id: string
          created_at: string
          currency: string
          description: string
          duration_minutes: number | null
          ends_at: string | null
          featured: boolean
          id: string
          image_paths: string[]
          max_group_size: number | null
          max_price: number | null
          merchant_id: string
          min_group_size: number
          min_price: number
          minimum_age: number
          search_document: unknown
          setting: string
          slug: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          booking_required?: boolean
          category_id: string
          created_at?: string
          currency?: string
          description: string
          duration_minutes?: number | null
          ends_at?: string | null
          featured?: boolean
          id?: string
          image_paths?: string[]
          max_group_size?: number | null
          max_price?: number | null
          merchant_id: string
          min_group_size?: number
          min_price?: number
          minimum_age?: number
          search_document?: unknown
          setting?: string
          slug: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          booking_required?: boolean
          category_id?: string
          created_at?: string
          currency?: string
          description?: string
          duration_minutes?: number | null
          ends_at?: string | null
          featured?: boolean
          id?: string
          image_paths?: string[]
          max_group_size?: number | null
          max_price?: number | null
          merchant_id?: string
          min_group_size?: number
          min_price?: number
          minimum_age?: number
          search_document?: unknown
          setting?: string
          slug?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiences_venue_id_merchant_id_fkey"
            columns: ["venue_id", "merchant_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id", "merchant_id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          experience_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          experience_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_members: {
        Row: {
          created_at: string
          merchant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          merchant_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          merchant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_members_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          business_name: string
          business_type: string
          created_at: string
          description: string | null
          id: string
          instagram_url: string | null
          is_demo: boolean
          logo_url: string | null
          slug: string
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          business_name: string
          business_type: string
          created_at?: string
          description?: string | null
          id?: string
          instagram_url?: string | null
          is_demo?: boolean
          logo_url?: string | null
          slug: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          business_name?: string
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          instagram_url?: string | null
          is_demo?: boolean
          logo_url?: string | null
          slug?: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          created_at: string
          experience_id: string
          id: string
          plan_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          experience_id: string
          id?: string
          plan_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          experience_id?: string
          id?: string
          plan_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_participants: {
        Row: {
          created_at: string
          id: string
          nickname: string
          participant_token_hash: string
          plan_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nickname: string
          participant_token_hash: string
          plan_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          participant_token_hash?: string
          plan_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_participants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_votes: {
        Row: {
          created_at: string
          participant_id: string
          plan_id: string
          plan_item_id: string
          updated_at: string
          vote: string
        }
        Insert: {
          created_at?: string
          participant_id: string
          plan_id: string
          plan_item_id: string
          updated_at?: string
          vote: string
        }
        Update: {
          created_at?: string
          participant_id?: string
          plan_id?: string
          plan_item_id?: string
          updated_at?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_votes_plan_id_participant_id_fkey"
            columns: ["plan_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "plan_participants"
            referencedColumns: ["plan_id", "id"]
          },
          {
            foreignKeyName: "plan_votes_plan_id_plan_item_id_fkey"
            columns: ["plan_id", "plan_item_id"]
            isOneToOne: false
            referencedRelation: "plan_items"
            referencedColumns: ["plan_id", "id"]
          },
        ]
      }
      plans: {
        Row: {
          area_id: string | null
          created_at: string
          group_size: number | null
          group_type: string | null
          id: string
          max_budget: number | null
          min_budget: number | null
          owner_id: string
          share_expires_at: string | null
          share_id: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          vibe_id: string | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          group_size?: number | null
          group_type?: string | null
          id?: string
          max_budget?: number | null
          min_budget?: number | null
          owner_id?: string
          share_expires_at?: string | null
          share_id?: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          vibe_id?: string | null
        }
        Update: {
          area_id?: string | null
          created_at?: string
          group_size?: number | null
          group_type?: string | null
          id?: string
          max_budget?: number | null
          min_budget?: number | null
          owner_id?: string
          share_expires_at?: string | null
          share_id?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          vibe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_vibe_id_fkey"
            columns: ["vibe_id"]
            isOneToOne: false
            referencedRelation: "vibes"
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
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          area_id: string
          created_at: string
          google_maps_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          merchant_id: string
          name: string
          phone: string | null
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address: string
          area_id: string
          created_at?: string
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_id: string
          name: string
          phone?: string | null
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          area_id?: string
          created_at?: string
          google_maps_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_id?: string
          name?: string
          phone?: string | null
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      vibes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_merchant: {
        Args: {
          p_business_name: string
          p_business_type: string
          p_owner_id: string
          p_slug: string
        }
        Returns: string
      }
      admin_moderate_content: {
        Args: {
          p_id: string
          p_kind: string
          p_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      admin_set_experience_featured: {
        Args: { p_featured: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_merchant_member: {
        Args: { p_merchant_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      cancel_my_claim: { Args: { p_claim_id: string }; Returns: Json }
      cast_plan_vote: {
        Args: {
          p_item_id: string
          p_participant_token: string
          p_share_id: string
          p_vote: string
        }
        Returns: undefined
      }
      claim_drop: {
        Args: { p_drop_id: string; p_request_id?: string }
        Returns: Json
      }
      get_drop_availability: { Args: { p_drop_id: string }; Returns: Json }
      get_merchant_contact: { Args: { p_merchant_id: string }; Returns: Json }
      get_my_pass: { Args: { p_claim_id: string }; Returns: Json }
      get_my_pass_details: { Args: { p_claim_id: string }; Returns: Json }
      list_my_passes: { Args: { p_limit?: number; p_offset?: number }; Returns: Json }
      get_shared_plan: { Args: { p_share_id: string }; Returns: Json }
      join_shared_plan: {
        Args: { p_nickname: string; p_share_id: string }
        Returns: Json
      }
      merchant_claim_stats: {
        Args: { p_from: string; p_merchant_id: string; p_until: string }
        Returns: Json
      }
      merchant_set_content_status: {
        Args: { p_id: string; p_kind: string; p_status: string }
        Returns: undefined
      }
      redeem_drop_code: { Args: { p_code: string }; Returns: Json }
      rotate_plan_share_id: { Args: { p_plan_id: string }; Returns: string }
      set_merchant_contact: {
        Args: {
          p_contact_name: string
          p_email: string
          p_merchant_id: string
          p_phone: string
        }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
