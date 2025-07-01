export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          city: string
          created_at: string | null
          email: string | null
          id: string
          is_suspicious: boolean | null
          name: string
          phone: string | null
          return_count: number | null
          suspicious_reason: string | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          name: string
          phone?: string | null
          return_count?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          name?: string
          phone?: string | null
          return_count?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_to: string | null
          city: string
          courier: Database["public"]["Enums"]["courier_type"]
          created_at: string | null
          customer_address: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          dispatched_at: string | null
          gpt_score: number | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["order_status"] | null
          tags: string[] | null
          total_amount: number
          tracking_id: string | null
          updated_at: string | null
          verification_notes: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          city: string
          courier: Database["public"]["Enums"]["courier_type"]
          created_at?: string | null
          customer_address: string
          customer_id: string
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          dispatched_at?: string | null
          gpt_score?: number | null
          id?: string
          items: Json
          notes?: string | null
          order_number: string
          status?: Database["public"]["Enums"]["order_status"] | null
          tags?: string[] | null
          total_amount: number
          tracking_id?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          city?: string
          courier?: Database["public"]["Enums"]["courier_type"]
          created_at?: string | null
          customer_address?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          gpt_score?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          tags?: string[] | null
          total_amount?: number
          tracking_id?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      returns: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          reason: string | null
          received_at: string | null
          received_by: string | null
          return_status: Database["public"]["Enums"]["return_status"] | null
          tags: string[] | null
          tracking_id: string
          updated_at: string | null
          worth: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          reason?: string | null
          received_at?: string | null
          received_by?: string | null
          return_status?: Database["public"]["Enums"]["return_status"] | null
          tags?: string[] | null
          tracking_id: string
          updated_at?: string | null
          worth?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string | null
          received_at?: string | null
          received_by?: string | null
          return_status?: Database["public"]["Enums"]["return_status"] | null
          tags?: string[] | null
          tracking_id?: string
          updated_at?: string | null
          worth?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_performance: {
        Row: {
          addresses_verified: number | null
          created_at: string | null
          date: string | null
          id: string
          orders_processed: number | null
          returns_handled: number | null
          user_id: string
        }
        Insert: {
          addresses_verified?: number | null
          created_at?: string | null
          date?: string | null
          id?: string
          orders_processed?: number | null
          returns_handled?: number | null
          user_id: string
        }
        Update: {
          addresses_verified?: number | null
          created_at?: string | null
          date?: string | null
          id?: string
          orders_processed?: number | null
          returns_handled?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      courier_type: "postex" | "leopard" | "tcs" | "other"
      order_status:
        | "pending"
        | "booked"
        | "dispatched"
        | "delivered"
        | "cancelled"
        | "returned"
      return_status: "in_transit" | "received" | "processed" | "completed"
      user_role:
        | "owner"
        | "store_manager"
        | "dispatch_manager"
        | "returns_manager"
        | "staff"
      verification_status: "pending" | "approved" | "disapproved"
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
  public: {
    Enums: {
      courier_type: ["postex", "leopard", "tcs", "other"],
      order_status: [
        "pending",
        "booked",
        "dispatched",
        "delivered",
        "cancelled",
        "returned",
      ],
      return_status: ["in_transit", "received", "processed", "completed"],
      user_role: [
        "owner",
        "store_manager",
        "dispatch_manager",
        "returns_manager",
        "staff",
      ],
      verification_status: ["pending", "approved", "disapproved"],
    },
  },
} as const
