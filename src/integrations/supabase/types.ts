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
    PostgrestVersion: "12.2.3 (519615d)"
  }
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
          {
            foreignKeyName: "fk_activity_logs_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      address_verifications: {
        Row: {
          created_at: string
          flagged_reason: string | null
          gpt_score: number | null
          id: string
          order_id: string
          verification_notes: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          flagged_reason?: string | null
          gpt_score?: number | null
          id?: string
          order_id: string
          verification_notes?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          flagged_reason?: string | null
          gpt_score?: number | null
          id?: string
          order_id?: string
          verification_notes?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "address_verifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "address_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_address_verifications_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          message_content: string
          message_type: string
          order_id: string
          sender_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          message_content: string
          message_type: string
          order_id: string
          sender_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          message_content?: string
          message_type?: string
          order_id?: string
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          delivered_count: number | null
          email: string | null
          id: string
          is_suspicious: boolean | null
          name: string
          phone: string | null
          phone_last_5_chr: string | null
          return_count: number | null
          suspicious_reason: string | null
          total_orders: number | null
          Type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          delivered_count?: number | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          name: string
          phone?: string | null
          phone_last_5_chr?: string | null
          return_count?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          Type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          delivered_count?: number | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          name?: string
          phone?: string | null
          phone_last_5_chr?: string | null
          return_count?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          Type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          courier: string
          created_at: string
          dispatch_date: string | null
          dispatched_by: string | null
          id: string
          notes: string | null
          order_id: string
          status: string | null
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          courier: string
          created_at?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          courier?: string
          created_at?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dispatches_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          available_quantity: number | null
          created_at: string
          id: string
          last_restocked_at: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          outlet_id: string
          product_id: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          outlet_id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      leopard_table: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_phone_last_5_chr: string | null
          id: number
          merchant: string | null
          no_of_items: string | null
          order_id: string | null
          order_status: string | null
          tracking: string | null
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          id?: number
          merchant?: string | null
          no_of_items?: string | null
          order_id?: string | null
          order_status?: string | null
          tracking?: string | null
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          id?: number
          merchant?: string | null
          no_of_items?: string | null
          order_id?: string | null
          order_status?: string | null
          tracking?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          priority: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          priority?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          priority?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          order_id: string
          price: number
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          city: string
          courier: Database["public"]["Enums"]["courier_type"] | null
          created_at: string | null
          customer_address: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_new_address: string | null
          customer_phone: string
          customer_phone_last_5_chr: string | null
          delivered_at: string | null
          delivery_notes: string | null
          dispatched_at: string | null
          gpt_score: number | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          order_type: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          tags: string[] | null
          timestamp: string | null
          total_amount: number
          total_items: string | null
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
          courier?: Database["public"]["Enums"]["courier_type"] | null
          created_at?: string | null
          customer_address: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_new_address?: string | null
          customer_phone: string
          customer_phone_last_5_chr?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          gpt_score?: number | null
          id?: string
          items: Json
          notes?: string | null
          order_number: string
          order_type?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tags?: string[] | null
          timestamp?: string | null
          total_amount: number
          total_items?: string | null
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
          courier?: Database["public"]["Enums"]["courier_type"] | null
          created_at?: string | null
          customer_address?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_new_address?: string | null
          customer_phone?: string
          customer_phone_last_5_chr?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          gpt_score?: number | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          order_type?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tags?: string[] | null
          timestamp?: string | null
          total_amount?: number
          total_items?: string | null
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
            foreignKeyName: "fk_orders_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
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
      outlets: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          outlet_type: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          outlet_type: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          outlet_type?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlets_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      postex_table: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_phone_last_5_chr: string | null
          id: number
          merchant: string | null
          no_of_items: string | null
          order_id: string | null
          order_status: string | null
          tracking: string | null
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          id?: number
          merchant?: string | null
          no_of_items?: string | null
          order_id?: string | null
          order_status?: string | null
          tracking?: string | null
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          id?: number
          merchant?: string | null
          no_of_items?: string | null
          order_id?: string | null
          order_status?: string | null
          tracking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postex_table_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_number"]
          },
        ]
      }
      product: {
        Row: {
          compared_price: string | null
          id: number
          name: string | null
          price: string | null
          shopify_id: number
          type: string | null
        }
        Insert: {
          compared_price?: string | null
          id?: number
          name?: string | null
          price?: string | null
          shopify_id: number
          type?: string | null
        }
        Update: {
          compared_price?: string | null
          id?: number
          name?: string | null
          price?: string | null
          shopify_id?: number
          type?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          reorder_level: number
          sku: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          reorder_level?: number
          sku: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          reorder_level?: number
          sku?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "fk_returns_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
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
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movement_type: string
          notes: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movement_type: string
          notes?: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: string
          notes?: string | null
          outlet_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity_approved: number | null
          quantity_received: number | null
          quantity_requested: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity_approved?: number | null
          quantity_received?: number | null
          quantity_requested?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_requests: {
        Row: {
          approved_by: string | null
          completed_by: string | null
          created_at: string
          from_outlet_id: string
          id: string
          notes: string | null
          requested_by: string
          status: string
          to_outlet_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          completed_by?: string | null
          created_at?: string
          from_outlet_id: string
          id?: string
          notes?: string | null
          requested_by: string
          status?: string
          to_outlet_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          completed_by?: string | null
          created_at?: string
          from_outlet_id?: string
          id?: string
          notes?: string | null
          requested_by?: string
          status?: string
          to_outlet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_from_outlet_id_fkey"
            columns: ["from_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_requests_to_outlet_id_fkey"
            columns: ["to_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      suspicious_customers: {
        Row: {
          created_at: string
          customer_id: string
          flag_reason: string
          id: string
          is_verified: boolean | null
          last_contacted_at: string | null
          message_log: Json | null
          risk_score: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          flag_reason: string
          id?: string
          is_verified?: boolean | null
          last_contacted_at?: string | null
          message_log?: Json | null
          risk_score?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          flag_reason?: string
          id?: string
          is_verified?: boolean | null
          last_contacted_at?: string | null
          message_log?: Json | null
          risk_score?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_suspicious_customers_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspicious_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
            foreignKeyName: "fk_user_performance_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          role_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          role_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_roles: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      user_has_role: {
        Args: {
          check_role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Returns: boolean
      }
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
        | "unclear address"
        | "address clear"
      return_status: "in_transit" | "received" | "processed" | "completed"
      user_role:
        | "super_admin"
        | "super_manager"
        | "warehouse_manager"
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
      courier_type: ["postex", "leopard", "tcs", "other"],
      order_status: [
        "pending",
        "booked",
        "dispatched",
        "delivered",
        "cancelled",
        "returned",
        "unclear address",
        "address clear",
      ],
      return_status: ["in_transit", "received", "processed", "completed"],
      user_role: [
        "super_admin",
        "super_manager",
        "warehouse_manager",
        "store_manager",
        "dispatch_manager",
        "returns_manager",
        "staff",
      ],
      verification_status: ["pending", "approved", "disapproved"],
    },
  },
} as const
