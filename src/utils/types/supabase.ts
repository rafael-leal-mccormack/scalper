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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      call_sessions: {
        Row: {
          call_sid: string
          call_type: string | null
          created_at: string | null
          customer_name: string | null
          customer_preferences: Json | null
          duration_seconds: number | null
          end_time: string | null
          error_message: string | null
          from_number: string
          id: string
          intent_detected: string | null
          language_detected: string | null
          notes: string | null
          outcome: string | null
          recording_url: string | null
          restaurant_id: string | null
          start_time: string | null
          status: string
          to_number: string
          updated_at: string | null
        }
        Insert: {
          call_sid: string
          call_type?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_preferences?: Json | null
          duration_seconds?: number | null
          end_time?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          intent_detected?: string | null
          language_detected?: string | null
          notes?: string | null
          outcome?: string | null
          recording_url?: string | null
          restaurant_id?: string | null
          start_time?: string | null
          status?: string
          to_number: string
          updated_at?: string | null
        }
        Update: {
          call_sid?: string
          call_type?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_preferences?: Json | null
          duration_seconds?: number | null
          end_time?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          intent_detected?: string | null
          language_detected?: string | null
          notes?: string | null
          outcome?: string | null
          recording_url?: string | null
          restaurant_id?: string | null
          start_time?: string | null
          status?: string
          to_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          language_detected: string | null
          restaurant_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language_detected?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language_detected?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          call_session_id: string | null
          chat_session_id: string | null
          created_at: string | null
          id: string
          message_count: number | null
          messages: Json
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          call_session_id?: string | null
          chat_session_id?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          messages?: Json
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          call_session_id?: string | null
          chat_session_id?: string | null
          created_at?: string | null
          id?: string
          message_count?: number | null
          messages?: Json
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          carrier: string
          carrier_order_id: string | null
          confidence_reasoning: string | null
          confidence_score: number | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: Json | null
          dispute_accepted: boolean | null
          dispute_amount: number | null
          disputed: boolean | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          provider_id: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          carrier: string
          carrier_order_id?: string | null
          confidence_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          dispute_accepted?: boolean | null
          dispute_amount?: number | null
          disputed?: boolean | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          provider_id?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          carrier?: string
          carrier_order_id?: string | null
          confidence_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          dispute_accepted?: boolean | null
          dispute_amount?: number | null
          disputed?: boolean | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          provider_id?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          question: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          question: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          question?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faqs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      food: {
        Row: {
          available: boolean | null
          calories: number | null
          created_at: string | null
          description: string
          embedding: string | null
          extra_info: string | null
          id: string
          ingredients: string[] | null
          price: number | null
          recommended: boolean | null
          restaurant_id: string | null
          seasonal: boolean | null
          tags: string[] | null
          title: string
        }
        Insert: {
          available?: boolean | null
          calories?: number | null
          created_at?: string | null
          description: string
          embedding?: string | null
          extra_info?: string | null
          id?: string
          ingredients?: string[] | null
          price?: number | null
          recommended?: boolean | null
          restaurant_id?: string | null
          seasonal?: boolean | null
          tags?: string[] | null
          title: string
        }
        Update: {
          available?: boolean | null
          calories?: number | null
          created_at?: string | null
          description?: string
          embedding?: string | null
          extra_info?: string | null
          id?: string
          ingredients?: string[] | null
          price?: number | null
          recommended?: boolean | null
          restaurant_id?: string | null
          seasonal?: boolean | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          menu_url: string | null
          name: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          menu_url?: string | null
          name?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          menu_url?: string | null
          name?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_references: {
        Row: {
          carrier: Database["public"]["Enums"]["carrier_type"] | null
          created_at: string
          customer: string | null
          id: string
          image_url: string | null
          order_date: string | null
          order_number: string | null
          provider_order_id: string | null
          restaurant_id: string | null
        }
        Insert: {
          carrier?: Database["public"]["Enums"]["carrier_type"] | null
          created_at?: string
          customer?: string | null
          id?: string
          image_url?: string | null
          order_date?: string | null
          order_number?: string | null
          provider_order_id?: string | null
          restaurant_id?: string | null
        }
        Update: {
          carrier?: Database["public"]["Enums"]["carrier_type"] | null
          created_at?: string
          customer?: string | null
          id?: string
          image_url?: string | null
          order_date?: string | null
          order_number?: string | null
          provider_order_id?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_references_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          failed_at: string | null
          id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string
          stripe_subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          failed_at?: string | null
          id?: string
          paid_at?: string | null
          status: string
          stripe_invoice_id: string
          stripe_subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          failed_at?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_stripe_subscription_id_fkey"
            columns: ["stripe_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["stripe_subscription_id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referee_user_id: string | null
          referral_code: string
          referred_at: string | null
          referrer_user_id: string
          restaurant_id: string | null
          signed_up_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referee_user_id?: string | null
          referral_code: string
          referred_at?: string | null
          referrer_user_id: string
          restaurant_id?: string | null
          signed_up_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referee_user_id?: string | null
          referral_code?: string
          referred_at?: string | null
          referrer_user_id?: string
          restaurant_id?: string | null
          signed_up_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["roles"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["roles"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["roles"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_configurations: {
        Row: {
          created_at: string
          motion_detection_config: Json
          restaurant_id: string
          toast_api_config: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          motion_detection_config?: Json
          restaurant_id: string
          toast_api_config?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          motion_detection_config?: Json
          restaurant_id?: string
          toast_api_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_configurations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          ai_provider: Database["public"]["Enums"]["ai_providers"] | null
          assistant_name: string | null
          chat_instructions: string | null
          created_at: string
          cuisine_type: string | null
          custom_instructions: string | null
          description: string | null
          features: Json | null
          greeting: string | null
          id: string
          language: string | null
          latitude: number | null
          longitude: number | null
          main_menu_id: string | null
          name: string | null
          operating_hours: Json | null
          phone: string | null
          social_media: string | null
          special_hours: Json | null
          specialties: string | null
          tone: string | null
          twilio_account_sid: string | null
          twilio_phone: string | null
          voice_id: string | null
          voice_instructions: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_provider?: Database["public"]["Enums"]["ai_providers"] | null
          assistant_name?: string | null
          chat_instructions?: string | null
          created_at?: string
          cuisine_type?: string | null
          custom_instructions?: string | null
          description?: string | null
          features?: Json | null
          greeting?: string | null
          id?: string
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          main_menu_id?: string | null
          name?: string | null
          operating_hours?: Json | null
          phone?: string | null
          social_media?: string | null
          special_hours?: Json | null
          specialties?: string | null
          tone?: string | null
          twilio_account_sid?: string | null
          twilio_phone?: string | null
          voice_id?: string | null
          voice_instructions?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_provider?: Database["public"]["Enums"]["ai_providers"] | null
          assistant_name?: string | null
          chat_instructions?: string | null
          created_at?: string
          cuisine_type?: string | null
          custom_instructions?: string | null
          description?: string | null
          features?: Json | null
          greeting?: string | null
          id?: string
          language?: string | null
          latitude?: number | null
          longitude?: number | null
          main_menu_id?: string | null
          name?: string | null
          operating_hours?: Json | null
          phone?: string | null
          social_media?: string | null
          special_hours?: Json | null
          specialties?: string | null
          tone?: string | null
          twilio_account_sid?: string | null
          twilio_phone?: string | null
          voice_id?: string | null
          voice_instructions?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_main_menu_id_fkey"
            columns: ["main_menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          failed_payment_count: number | null
          id: string
          last_failed_payment: string | null
          last_payment_date: string | null
          paused_at: string | null
          plan_type: string
          restaurant_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          failed_payment_count?: number | null
          id?: string
          last_failed_payment?: string | null
          last_payment_date?: string | null
          paused_at?: string | null
          plan_type: string
          restaurant_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          failed_payment_count?: number | null
          id?: string
          last_failed_payment?: string | null
          last_payment_date?: string | null
          paused_at?: string | null
          plan_type?: string
          restaurant_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      voices: {
        Row: {
          audio_url: string
          created_at: string | null
          id: string
          updated_at: string | null
          voice_id: string
          voice_name: string
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          voice_id: string
          voice_name: string
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_providers: "openai" | "gemini"
      carrier_type:
        | "uber_eats"
        | "doordash"
        | "grubhub"
        | "postmates"
        | "seamless"
        | "direct"
        | "unknown"
      roles: "admin" | "user" | "superadmin"
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
      ai_providers: ["openai", "gemini"],
      carrier_type: [
        "uber_eats",
        "doordash",
        "grubhub",
        "postmates",
        "seamless",
        "direct",
        "unknown",
      ],
      roles: ["admin", "user", "superadmin"],
    },
  },
} as const
