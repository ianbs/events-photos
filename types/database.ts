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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          is_active: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      event_rsvp_guest_batches: {
        Row: {
          batch_id: string
          created_at: string
          event_id: string
          input_hash: string
          saved_count: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          event_id: string
          input_hash: string
          saved_count: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          event_id?: string
          input_hash?: string
          saved_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_guest_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_admin_summaries"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvp_guest_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvp_identities: {
        Row: {
          created_at: string
          email: string | null
          event_id: string
          guest_id: string
          invitation_code: string | null
          invitation_hash: string | null
          invitation_revoked_at: string | null
          max_companions: number | null
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_id: string
          guest_id: string
          invitation_code?: string | null
          invitation_hash?: string | null
          invitation_revoked_at?: string | null
          max_companions?: number | null
          name?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_id?: string
          guest_id?: string
          invitation_code?: string | null
          invitation_hash?: string | null
          invitation_revoked_at?: string | null
          max_companions?: number | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvp_identities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_admin_summaries"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_rsvp_identities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvp_identities_event_id_guest_id_fkey"
            columns: ["event_id", "guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          attending: boolean
          companion_names: string[]
          companions: number
          event_id: string
          guest_id: string
          name: string
          updated_at: string
        }
        Insert: {
          attending: boolean
          companion_names?: string[]
          companions?: number
          event_id: string
          guest_id: string
          name: string
          updated_at?: string
        }
        Update: {
          attending?: boolean
          companion_names?: string[]
          companions?: number
          event_id?: string
          guest_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_guest_fkey"
            columns: ["event_id", "guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      events: {
        Row: {
          accent_color: string
          closing_message: string
          cover_storage_path: string | null
          created_at: string
          event_date: string
          id: string
          instructions: string | null
          is_active: boolean
          location: string | null
          logo_storage_path: string | null
          maps_url: string | null
          max_companions: number | null
          music_storage_path: string | null
          name: string
          organizer_contact: string | null
          photos_available_until: string | null
          primary_color: string
          slug: string
          whatsapp_message: string | null
        }
        Insert: {
          accent_color?: string
          closing_message?: string
          cover_storage_path?: string | null
          created_at?: string
          event_date: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          location?: string | null
          logo_storage_path?: string | null
          maps_url?: string | null
          max_companions?: number | null
          music_storage_path?: string | null
          name: string
          organizer_contact?: string | null
          photos_available_until?: string | null
          primary_color?: string
          slug: string
          whatsapp_message?: string | null
        }
        Update: {
          accent_color?: string
          closing_message?: string
          cover_storage_path?: string | null
          created_at?: string
          event_date?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          location?: string | null
          logo_storage_path?: string | null
          maps_url?: string | null
          max_companions?: number | null
          music_storage_path?: string | null
          name?: string
          organizer_contact?: string | null
          photos_available_until?: string | null
          primary_color?: string
          slug?: string
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string
          event_id: string
          guest_token: string
          id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guest_token?: string
          id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guest_token?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_admin_summaries"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          event_id: string
          file_size: number
          guest_id: string
          id: string
          mime_type: string
          original_filename: string
          storage_path: string
          storage_provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_size: number
          guest_id: string
          id?: string
          mime_type: string
          original_filename: string
          storage_path: string
          storage_provider?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_size?: number
          guest_id?: string
          id?: string
          mime_type?: string
          original_filename?: string
          storage_path?: string
          storage_provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_guest_fkey"
            columns: ["event_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_admin_summaries"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_admin_summaries: {
        Row: {
          event_id: string | null
          guest_count: number | null
          last_photo_at: string | null
          photo_count: number | null
          storage_bytes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_rsvp_guest: {
        Args: {
          p_code: string
          p_email?: string
          p_event_id: string
          p_max_companions?: number
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      create_rsvp_guest_batch: {
        Args: {
          p_batch_id: string
          p_event_id: string
          p_guests: Json
          p_input_hash: string
        }
        Returns: number
      }
      delete_rsvp_guest: {
        Args: { p_event_id: string; p_guest_id: string }
        Returns: boolean
      }
      ensure_rsvp_identity: {
        Args: {
          p_email?: string
          p_event_id: string
          p_invitation_hash?: string
          p_name?: string
        }
        Returns: string
      }
      finish_admin_event_deletion: {
        Args: {
          p_actor_id: string
          p_check_only?: boolean
          p_confirmation: string
          p_event_id: string
        }
        Returns: boolean
      }
      manage_admin_access: {
        Args: {
          p_actor_id: string
          p_is_active: boolean
          p_role: string
          p_user_id: string
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
