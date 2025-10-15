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
      api_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
      count_variances: {
        Row: {
          assigned_to: string | null
          corrective_action: string | null
          count_item_id: string
          created_at: string | null
          id: string
          outlet_id: string
          product_id: string
          resolved_at: string | null
          resolved_by: string | null
          root_cause: string | null
          severity: string | null
          status: string | null
          updated_at: string | null
          variance: number
          variance_value: number
        }
        Insert: {
          assigned_to?: string | null
          corrective_action?: string | null
          count_item_id: string
          created_at?: string | null
          id?: string
          outlet_id: string
          product_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          variance: number
          variance_value: number
        }
        Update: {
          assigned_to?: string | null
          corrective_action?: string | null
          count_item_id?: string
          created_at?: string | null
          id?: string
          outlet_id?: string
          product_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          updated_at?: string | null
          variance?: number
          variance_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "count_variances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_variances_count_item_id_fkey"
            columns: ["count_item_id"]
            isOneToOne: false
            referencedRelation: "stock_count_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_variances_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_variances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_variances_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_rate_cards: {
        Row: {
          courier_id: string
          created_at: string | null
          destination_city: string
          estimated_days: number | null
          id: string
          is_active: boolean | null
          origin_city: string
          rate: number
          updated_at: string | null
          weight_from: number
          weight_to: number
        }
        Insert: {
          courier_id: string
          created_at?: string | null
          destination_city: string
          estimated_days?: number | null
          id?: string
          is_active?: boolean | null
          origin_city: string
          rate: number
          updated_at?: string | null
          weight_from: number
          weight_to: number
        }
        Update: {
          courier_id?: string
          created_at?: string | null
          destination_city?: string
          estimated_days?: number | null
          id?: string
          is_active?: boolean | null
          origin_city?: string
          rate?: number
          updated_at?: string | null
          weight_from?: number
          weight_to?: number
        }
        Relationships: [
          {
            foreignKeyName: "courier_rate_cards_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          api_endpoint: string
          code: string
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          pricing_config: Json | null
          supported_cities: Json | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          code: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          pricing_config?: Json | null
          supported_cities?: Json | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          code?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pricing_config?: Json | null
          supported_cities?: Json | null
          updated_at?: string | null
        }
        Relationships: []
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
          last_whatsapp_sent: string | null
          name: string
          phone: string | null
          phone_last_5_chr: string | null
          return_count: number | null
          shopify_customer_id: number | null
          suspicious_reason: string | null
          total_orders: number | null
          Type: string | null
          updated_at: string | null
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          delivered_count?: number | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          last_whatsapp_sent?: string | null
          name: string
          phone?: string | null
          phone_last_5_chr?: string | null
          return_count?: number | null
          shopify_customer_id?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          Type?: string | null
          updated_at?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          delivered_count?: number | null
          email?: string | null
          id?: string
          is_suspicious?: boolean | null
          last_whatsapp_sent?: string | null
          name?: string
          phone?: string | null
          phone_last_5_chr?: string | null
          return_count?: number | null
          shopify_customer_id?: number | null
          suspicious_reason?: string | null
          total_orders?: number | null
          Type?: string | null
          updated_at?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          courier: string
          courier_booking_id: string | null
          courier_id: string | null
          courier_response: Json | null
          created_at: string
          dispatch_date: string | null
          dispatched_by: string | null
          estimated_delivery: string | null
          id: string
          last_tracking_update: string | null
          notes: string | null
          order_id: string
          status: string | null
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          courier: string
          courier_booking_id?: string | null
          courier_id?: string | null
          courier_response?: Json | null
          created_at?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          estimated_delivery?: string | null
          id?: string
          last_tracking_update?: string | null
          notes?: string | null
          order_id: string
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          courier?: string
          courier_booking_id?: string | null
          courier_id?: string | null
          courier_response?: Json | null
          created_at?: string
          dispatch_date?: string | null
          dispatched_by?: string | null
          estimated_delivery?: string | null
          id?: string
          last_tracking_update?: string | null
          notes?: string | null
          order_id?: string
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
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
      goods_received_notes: {
        Row: {
          created_at: string | null
          discrepancy_flag: boolean | null
          grn_number: string
          id: string
          inspected_at: string | null
          inspected_by: string | null
          notes: string | null
          outlet_id: string
          po_id: string
          quality_passed: boolean | null
          received_by: string
          received_date: string | null
          rejection_reason: string | null
          status: string | null
          supplier_id: string
          total_items_expected: number
          total_items_received: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discrepancy_flag?: boolean | null
          grn_number: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          notes?: string | null
          outlet_id: string
          po_id: string
          quality_passed?: boolean | null
          received_by: string
          received_date?: string | null
          rejection_reason?: string | null
          status?: string | null
          supplier_id: string
          total_items_expected: number
          total_items_received: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discrepancy_flag?: boolean | null
          grn_number?: string
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          notes?: string | null
          outlet_id?: string
          po_id?: string
          quality_passed?: boolean | null
          received_by?: string
          received_date?: string | null
          rejection_reason?: string | null
          status?: string | null
          supplier_id?: string
          total_items_expected?: number
          total_items_received?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_received_notes_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_received_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          batch_number: string | null
          created_at: string | null
          defect_type: string | null
          expiry_date: string | null
          grn_id: string
          id: string
          notes: string | null
          po_item_id: string | null
          product_id: string
          quality_status: string | null
          quantity_accepted: number | null
          quantity_expected: number
          quantity_received: number
          quantity_rejected: number | null
          unit_cost: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string | null
          defect_type?: string | null
          expiry_date?: string | null
          grn_id: string
          id?: string
          notes?: string | null
          po_item_id?: string | null
          product_id: string
          quality_status?: string | null
          quantity_accepted?: number | null
          quantity_expected: number
          quantity_received: number
          quantity_rejected?: number | null
          unit_cost: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string | null
          defect_type?: string | null
          expiry_date?: string | null
          grn_id?: string
          id?: string
          notes?: string | null
          po_item_id?: string | null
          product_id?: string
          quality_status?: string | null
          quantity_accepted?: number | null
          quantity_expected?: number
          quantity_received?: number
          quantity_rejected?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      locations: {
        Row: {
          area: string
          available_couriers: string[] | null
          city: string
          created_at: string
          id: string
          is_serviceable: boolean
          name: string
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          area: string
          available_couriers?: string[] | null
          city: string
          created_at?: string
          id?: string
          is_serviceable?: boolean
          name: string
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          available_couriers?: string[] | null
          city?: string
          created_at?: string
          id?: string
          is_serviceable?: boolean
          name?: string
          postal_code?: string | null
          updated_at?: string
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
          comments: Json | null
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
          last_shopify_sync: string | null
          notes: string | null
          order_number: string
          order_type: string | null
          shopify_fulfillment_id: number | null
          shopify_order_id: number | null
          shopify_order_number: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          synced_to_shopify: boolean | null
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
          comments?: Json | null
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
          last_shopify_sync?: string | null
          notes?: string | null
          order_number: string
          order_type?: string | null
          shopify_fulfillment_id?: number | null
          shopify_order_id?: number | null
          shopify_order_number?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          synced_to_shopify?: boolean | null
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
          comments?: Json | null
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
          last_shopify_sync?: string | null
          notes?: string | null
          order_number?: string
          order_type?: string | null
          shopify_fulfillment_id?: number | null
          shopify_order_id?: number | null
          shopify_order_number?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          synced_to_shopify?: boolean | null
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
          shopify_product_id: number | null
          shopify_variant_id: number | null
          sku: string
          synced_from_shopify: boolean | null
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
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku: string
          synced_from_shopify?: boolean | null
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
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          sku?: string
          synced_from_shopify?: boolean | null
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
      purchase_order_items: {
        Row: {
          created_at: string | null
          discount_rate: number | null
          id: string
          notes: string | null
          po_id: string
          product_id: string
          quantity_ordered: number
          quantity_received: number | null
          tax_rate: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_rate?: number | null
          id?: string
          notes?: string | null
          po_id: string
          product_id: string
          quantity_ordered: number
          quantity_received?: number | null
          tax_rate?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_rate?: number | null
          id?: string
          notes?: string | null
          po_id?: string
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          tax_rate?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string
          discount_amount: number | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          outlet_id: string
          payment_status: string | null
          po_number: string
          shipping_cost: number | null
          status: string | null
          supplier_id: string
          tax_amount: number | null
          terms_conditions: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by: string
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          outlet_id: string
          payment_status?: string | null
          po_number: string
          shipping_cost?: number | null
          status?: string | null
          supplier_id: string
          tax_amount?: number | null
          terms_conditions?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          outlet_id?: string
          payment_status?: string | null
          po_number?: string
          shipping_cost?: number | null
          status?: string | null
          supplier_id?: string
          tax_amount?: number | null
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_discrepancies: {
        Row: {
          created_at: string | null
          discrepancy_type: string
          expected_quantity: number | null
          financial_impact: number | null
          grn_id: string
          id: string
          product_id: string
          received_quantity: number | null
          reported_by: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          supplier_notified: boolean | null
          supplier_response: string | null
          unit_cost: number | null
          variance: number | null
        }
        Insert: {
          created_at?: string | null
          discrepancy_type: string
          expected_quantity?: number | null
          financial_impact?: number | null
          grn_id: string
          id?: string
          product_id: string
          received_quantity?: number | null
          reported_by: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          supplier_notified?: boolean | null
          supplier_response?: string | null
          unit_cost?: number | null
          variance?: number | null
        }
        Update: {
          created_at?: string | null
          discrepancy_type?: string
          expected_quantity?: number | null
          financial_impact?: number | null
          grn_id?: string
          id?: string
          product_id?: string
          received_quantity?: number | null
          reported_by?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          supplier_notified?: boolean | null
          supplier_response?: string | null
          unit_cost?: number | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receiving_discrepancies_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_received_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_discrepancies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_discrepancies_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_discrepancies_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      scan_results: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          raw_data: string
          scan_mode: string
          scan_type: string
          scanned_by: string | null
          tracking_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          raw_data: string
          scan_mode: string
          scan_type: string
          scanned_by?: string | null
          tracking_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          raw_data?: string
          scan_mode?: string
          scan_type?: string
          scanned_by?: string | null
          tracking_id?: string | null
        }
        Relationships: []
      }
      shopify_sync_log: {
        Row: {
          completed_at: string | null
          error_details: Json | null
          id: string
          records_failed: number | null
          records_processed: number | null
          started_at: string | null
          status: string
          sync_direction: string
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          error_details?: Json | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status: string
          sync_direction: string
          sync_type: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          error_details?: Json | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
          sync_direction?: string
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      stock_count_items: {
        Row: {
          count_id: string
          counted_at: string | null
          counted_by: string
          counted_quantity: number
          created_at: string | null
          id: string
          notes: string | null
          outlet_id: string
          product_id: string
          recount_count: number | null
          recount_required: boolean | null
          system_quantity: number
          unit_cost: number | null
          variance: number | null
          variance_percentage: number | null
          variance_reason: string | null
          variance_value: number | null
        }
        Insert: {
          count_id: string
          counted_at?: string | null
          counted_by: string
          counted_quantity: number
          created_at?: string | null
          id?: string
          notes?: string | null
          outlet_id: string
          product_id: string
          recount_count?: number | null
          recount_required?: boolean | null
          system_quantity: number
          unit_cost?: number | null
          variance?: number | null
          variance_percentage?: number | null
          variance_reason?: string | null
          variance_value?: number | null
        }
        Update: {
          count_id?: string
          counted_at?: string | null
          counted_by?: string
          counted_quantity?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          outlet_id?: string
          product_id?: string
          recount_count?: number | null
          recount_required?: boolean | null
          system_quantity?: number
          unit_cost?: number | null
          variance?: number | null
          variance_percentage?: number | null
          variance_reason?: string | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_schedules: {
        Row: {
          assigned_to: string | null
          count_type: string
          created_at: string | null
          frequency: string | null
          id: string
          next_count_date: string | null
          outlet_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          count_type: string
          created_at?: string | null
          frequency?: string | null
          id?: string
          next_count_date?: string | null
          outlet_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          count_type?: string
          created_at?: string | null
          frequency?: string | null
          id?: string
          next_count_date?: string | null
          outlet_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_schedules_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_schedules_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          count_number: string
          count_type: string
          created_at: string | null
          id: string
          items_with_variance: number | null
          notes: string | null
          outlet_id: string
          started_at: string | null
          started_by: string
          status: string | null
          total_items_counted: number | null
          total_variance_value: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          count_number: string
          count_type: string
          created_at?: string | null
          id?: string
          items_with_variance?: number | null
          notes?: string | null
          outlet_id: string
          started_at?: string | null
          started_by: string
          status?: string | null
          total_items_counted?: number | null
          total_variance_value?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          count_number?: string
          count_type?: string
          created_at?: string | null
          id?: string
          items_with_variance?: number | null
          notes?: string | null
          outlet_id?: string
          started_at?: string | null
          started_by?: string
          status?: string | null
          total_items_counted?: number | null
          total_variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      supplier_performance: {
        Row: {
          accuracy_rate: number | null
          average_lead_time_days: number | null
          created_at: string | null
          date: string | null
          id: string
          on_time_delivery_rate: number | null
          orders_on_time: number | null
          orders_with_discrepancies: number | null
          quality_rejection_rate: number | null
          supplier_id: string
          total_amount_ordered: number | null
          total_items_ordered: number | null
          total_items_received: number | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_rate?: number | null
          average_lead_time_days?: number | null
          created_at?: string | null
          date?: string | null
          id?: string
          on_time_delivery_rate?: number | null
          orders_on_time?: number | null
          orders_with_discrepancies?: number | null
          quality_rejection_rate?: number | null
          supplier_id: string
          total_amount_ordered?: number | null
          total_items_ordered?: number | null
          total_items_received?: number | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_rate?: number | null
          average_lead_time_days?: number | null
          created_at?: string | null
          date?: string | null
          id?: string
          on_time_delivery_rate?: number | null
          orders_on_time?: number | null
          orders_with_discrepancies?: number | null
          quality_rejection_rate?: number | null
          supplier_id?: string
          total_amount_ordered?: number | null
          total_items_ordered?: number | null
          total_items_received?: number | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_performance_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_details: Json | null
          city: string | null
          code: string
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          rating: number | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: Json | null
          city?: string | null
          code: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: Json | null
          city?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      whatsapp_message_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          customer_id: string | null
          id: string
          last_error: string | null
          message_text: string
          order_id: string | null
          phone_number: string
          sent_at: string | null
          status: string | null
          template_name: string | null
          variables: Json | null
          whatsapp_message_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_error?: string | null
          message_text: string
          order_id?: string | null
          phone_number: string
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          variables?: Json | null
          whatsapp_message_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_error?: string | null
          message_text?: string
          order_id?: string | null
          phone_number?: string
          sent_at?: string | null
          status?: string | null
          template_name?: string | null
          variables?: Json | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          button_config: Json | null
          category: string
          created_at: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          template_id: string
          variables: Json | null
        }
        Insert: {
          body_text: string
          button_config?: Json | null
          category: string
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name: string
          template_id: string
          variables?: Json | null
        }
        Update: {
          body_text?: string
          button_config?: Json | null
          category?: string
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          template_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_variance_severity: {
        Args: { variance_value: number }
        Returns: string
      }
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
      normalize_phone: {
        Args: { p_phone: string }
        Returns: string
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
