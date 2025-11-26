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
          gps_distance_from_address: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          gps_verification_notes: string | null
          gps_verified: boolean | null
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
          gps_distance_from_address?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_verification_notes?: string | null
          gps_verified?: boolean | null
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
          gps_distance_from_address?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_verification_notes?: string | null
          gps_verified?: boolean | null
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
      auto_purchase_orders: {
        Row: {
          auto_approved: boolean | null
          avg_daily_consumption: number
          calculated_reorder_point: number
          created_at: string | null
          created_by: string | null
          current_stock: number
          error_message: string | null
          id: string
          lead_time_days: number
          metadata: Json | null
          po_id: string | null
          processing_duration_ms: number | null
          recommended_quantity: number
          trigger_reason: string
          trigger_type: string | null
        }
        Insert: {
          auto_approved?: boolean | null
          avg_daily_consumption: number
          calculated_reorder_point: number
          created_at?: string | null
          created_by?: string | null
          current_stock: number
          error_message?: string | null
          id?: string
          lead_time_days: number
          metadata?: Json | null
          po_id?: string | null
          processing_duration_ms?: number | null
          recommended_quantity: number
          trigger_reason: string
          trigger_type?: string | null
        }
        Update: {
          auto_approved?: boolean | null
          avg_daily_consumption?: number
          calculated_reorder_point?: number
          created_at?: string | null
          created_by?: string | null
          current_stock?: number
          error_message?: string | null
          id?: string
          lead_time_days?: number
          metadata?: Json | null
          po_id?: string | null
          processing_duration_ms?: number | null
          recommended_quantity?: number
          trigger_reason?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_purchase_orders_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automated_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          created_at: string
          finished_product_id: string
          id: string
          notes: string | null
          packaging_item_id: string | null
          quantity_required: number
          raw_material_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_product_id: string
          id?: string
          notes?: string | null
          packaging_item_id?: string | null
          quantity_required: number
          raw_material_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_product_id?: string
          id?: string
          notes?: string | null
          packaging_item_id?: string | null
          quantity_required?: number
          raw_material_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawer_events: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          event_type: string
          id: string
          notes: string | null
          reference_id: string | null
          session_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          event_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          session_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          event_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawer_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
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
      courier_awbs: {
        Row: {
          batch_count: number
          courier_code: string
          created_at: string
          error_message: string | null
          generated_at: string
          generated_by: string | null
          html_images: string | null
          id: string
          order_ids: string[]
          pdf_data: string | null
          pdf_url: string | null
          status: string
          total_orders: number
          tracking_ids: string[]
        }
        Insert: {
          batch_count?: number
          courier_code: string
          created_at?: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          html_images?: string | null
          id?: string
          order_ids: string[]
          pdf_data?: string | null
          pdf_url?: string | null
          status?: string
          total_orders?: number
          tracking_ids: string[]
        }
        Update: {
          batch_count?: number
          courier_code?: string
          created_at?: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          html_images?: string | null
          id?: string
          order_ids?: string[]
          pdf_data?: string | null
          pdf_url?: string | null
          status?: string
          total_orders?: number
          tracking_ids?: string[]
        }
        Relationships: []
      }
      courier_booking_attempts: {
        Row: {
          attempt_number: number
          booking_request: Json
          booking_response: Json | null
          courier_code: string
          courier_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          label_url: string | null
          order_id: string
          outlet_id: string | null
          status: string
          tracking_id: string | null
          user_id: string | null
        }
        Insert: {
          attempt_number?: number
          booking_request?: Json
          booking_response?: Json | null
          courier_code: string
          courier_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          label_url?: string | null
          order_id: string
          outlet_id?: string | null
          status: string
          tracking_id?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_number?: number
          booking_request?: Json
          booking_response?: Json | null
          courier_code?: string
          courier_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          label_url?: string | null
          order_id?: string
          outlet_id?: string | null
          status?: string
          tracking_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_booking_attempts_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_booking_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_booking_attempts_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_booking_queue: {
        Row: {
          courier_id: string
          created_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          max_retries: number
          next_retry_at: string
          order_id: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          max_retries?: number
          next_retry_at: string
          order_id: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          max_retries?: number
          next_retry_at?: string
          order_id?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_booking_queue_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_booking_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_load_sheets: {
        Row: {
          courier_id: string
          created_at: string
          error_message: string | null
          generated_at: string
          generated_by: string | null
          id: string
          load_sheet_data: string | null
          load_sheet_url: string | null
          order_ids: string[]
          status: string
          tracking_ids: string[]
        }
        Insert: {
          courier_id: string
          created_at?: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          load_sheet_data?: string | null
          load_sheet_url?: string | null
          order_ids?: string[]
          status?: string
          tracking_ids?: string[]
        }
        Update: {
          courier_id?: string
          created_at?: string
          error_message?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          load_sheet_data?: string | null
          load_sheet_url?: string | null
          order_ids?: string[]
          status?: string
          tracking_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "courier_load_sheets_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_load_sheets_generated_by_fkey"
            columns: ["generated_by"]
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
      courier_tracking_history: {
        Row: {
          checked_at: string
          courier_id: string
          created_at: string | null
          current_location: string | null
          dispatch_id: string
          id: string
          order_id: string
          raw_response: Json | null
          status: string
          tracking_id: string
        }
        Insert: {
          checked_at?: string
          courier_id: string
          created_at?: string | null
          current_location?: string | null
          dispatch_id: string
          id?: string
          order_id: string
          raw_response?: Json | null
          status: string
          tracking_id: string
        }
        Update: {
          checked_at?: string
          courier_id?: string
          created_at?: string | null
          current_location?: string | null
          dispatch_id?: string
          id?: string
          order_id?: string
          raw_response?: Json | null
          status?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_tracking_history_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_tracking_history_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_tracking_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          api_endpoint: string
          auth_config: Json | null
          auth_type: string | null
          auto_download_label: boolean | null
          awb_endpoint: string | null
          booking_endpoint: string | null
          bulk_booking_endpoint: string | null
          bulk_tracking_endpoint: string | null
          cancellation_endpoint: string | null
          code: string
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean
          label_config: Json | null
          label_endpoint: string | null
          label_format: string | null
          load_sheet_endpoint: string | null
          name: string
          pricing_config: Json | null
          rates_endpoint: string | null
          shipper_advice_list_endpoint: string | null
          shipper_advice_save_endpoint: string | null
          supported_cities: Json | null
          tariff_endpoint: string | null
          tracking_endpoint: string | null
          update_endpoint: string | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          auth_config?: Json | null
          auth_type?: string | null
          auto_download_label?: boolean | null
          awb_endpoint?: string | null
          booking_endpoint?: string | null
          bulk_booking_endpoint?: string | null
          bulk_tracking_endpoint?: string | null
          cancellation_endpoint?: string | null
          code: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          label_config?: Json | null
          label_endpoint?: string | null
          label_format?: string | null
          load_sheet_endpoint?: string | null
          name: string
          pricing_config?: Json | null
          rates_endpoint?: string | null
          shipper_advice_list_endpoint?: string | null
          shipper_advice_save_endpoint?: string | null
          supported_cities?: Json | null
          tariff_endpoint?: string | null
          tracking_endpoint?: string | null
          update_endpoint?: string | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          auth_config?: Json | null
          auth_type?: string | null
          auto_download_label?: boolean | null
          awb_endpoint?: string | null
          booking_endpoint?: string | null
          bulk_booking_endpoint?: string | null
          bulk_tracking_endpoint?: string | null
          cancellation_endpoint?: string | null
          code?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          label_config?: Json | null
          label_endpoint?: string | null
          label_format?: string | null
          load_sheet_endpoint?: string | null
          name?: string
          pricing_config?: Json | null
          rates_endpoint?: string | null
          shipper_advice_list_endpoint?: string | null
          shipper_advice_save_endpoint?: string | null
          supported_cities?: Json | null
          tariff_endpoint?: string | null
          tracking_endpoint?: string | null
          update_endpoint?: string | null
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
          label_data: string | null
          label_format: string | null
          label_url: string | null
          last_tracking_update: string | null
          notes: string | null
          order_id: string
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
          label_data?: string | null
          label_format?: string | null
          label_url?: string | null
          last_tracking_update?: string | null
          notes?: string | null
          order_id: string
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
          label_data?: string | null
          label_format?: string | null
          label_url?: string | null
          last_tracking_update?: string | null
          notes?: string | null
          order_id?: string
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
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
          packaging_item_id: string | null
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
          packaging_item_id?: string | null
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
          packaging_item_id?: string | null
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
            foreignKeyName: "grn_items_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
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
          last_shopify_sync: string | null
          outlet_id: string
          product_id: string
          quantity: number
          reserved_quantity: number
          shopify_location_id: number | null
          updated_at: string
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          last_shopify_sync?: string | null
          outlet_id: string
          product_id: string
          quantity?: number
          reserved_quantity?: number
          shopify_location_id?: number | null
          updated_at?: string
        }
        Update: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          last_shopify_sync?: string | null
          outlet_id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          shopify_location_id?: number | null
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
      label_print_logs: {
        Row: {
          id: string
          label_data: Json
          label_type: string
          notes: string | null
          packaging_item_id: string | null
          print_format: string | null
          printed_at: string
          printed_by: string | null
          product_id: string | null
          production_batch_id: string | null
          quantity_printed: number
        }
        Insert: {
          id?: string
          label_data: Json
          label_type: string
          notes?: string | null
          packaging_item_id?: string | null
          print_format?: string | null
          printed_at?: string
          printed_by?: string | null
          product_id?: string | null
          production_batch_id?: string | null
          quantity_printed: number
        }
        Update: {
          id?: string
          label_data?: Json
          label_type?: string
          notes?: string | null
          packaging_item_id?: string | null
          print_format?: string | null
          printed_at?: string
          printed_by?: string | null
          product_id?: string | null
          production_batch_id?: string | null
          quantity_printed?: number
        }
        Relationships: [
          {
            foreignKeyName: "label_print_logs_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_print_logs_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_print_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_print_logs_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
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
      low_stock_notifications: {
        Row: {
          current_stock: number
          id: string
          metadata: Json | null
          notification_type: string
          packaging_item_id: string | null
          po_created: string | null
          product_id: string | null
          reorder_level: number
          response_at: string | null
          response_received: boolean | null
          sent_at: string
          suggested_quantity: number
          supplier_id: string
        }
        Insert: {
          current_stock: number
          id?: string
          metadata?: Json | null
          notification_type: string
          packaging_item_id?: string | null
          po_created?: string | null
          product_id?: string | null
          reorder_level: number
          response_at?: string | null
          response_received?: boolean | null
          sent_at?: string
          suggested_quantity: number
          supplier_id: string
        }
        Update: {
          current_stock?: number
          id?: string
          metadata?: Json | null
          notification_type?: string
          packaging_item_id?: string | null
          po_created?: string | null
          product_id?: string | null
          reorder_level?: number
          response_at?: string | null
          response_received?: boolean | null
          sent_at?: string
          suggested_quantity?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_notifications_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_notifications_po_created_fkey"
            columns: ["po_created"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_notifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_orders_log: {
        Row: {
          detected_at: string | null
          detection_method: string | null
          error_message: string | null
          id: string
          order_number: string
          shopify_order_id: number | null
          sync_status: string | null
          synced_at: string | null
        }
        Insert: {
          detected_at?: string | null
          detection_method?: string | null
          error_message?: string | null
          id?: string
          order_number: string
          shopify_order_id?: number | null
          sync_status?: string | null
          synced_at?: string | null
        }
        Update: {
          detected_at?: string | null
          detection_method?: string | null
          error_message?: string | null
          id?: string
          order_number?: string
          shopify_order_id?: number | null
          sync_status?: string | null
          synced_at?: string | null
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
      order_confirmations: {
        Row: {
          confirmation_type: string
          created_at: string | null
          customer_id: string
          customer_response: string | null
          error_message: string | null
          id: string
          message_content: string | null
          message_id: string | null
          order_id: string
          response_at: string | null
          retry_count: number | null
          retry_scheduled_at: string | null
          sent_at: string | null
          sent_via: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          confirmation_type: string
          created_at?: string | null
          customer_id: string
          customer_response?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          message_id?: string | null
          order_id: string
          response_at?: string | null
          retry_count?: number | null
          retry_scheduled_at?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          confirmation_type?: string
          created_at?: string | null
          customer_id?: string
          customer_response?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          message_id?: string | null
          order_id?: string
          response_at?: string | null
          retry_count?: number | null
          retry_scheduled_at?: string | null
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_confirmations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      order_update_failures: {
        Row: {
          attempted_update: Json
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          order_id: string
        }
        Insert: {
          attempted_update: Json
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id: string
        }
        Update: {
          attempted_update?: Json
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_update_failures_order_id_fkey"
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
          auto_block_reason: string | null
          auto_blocked: boolean | null
          booked_at: string | null
          booked_by: string | null
          cancellation_reason: string | null
          city: string
          comments: Json | null
          confirmation_required: boolean | null
          courier: Database["public"]["Enums"]["courier_type"] | null
          created_at: string | null
          customer_address: string
          customer_email: string | null
          customer_id: string | null
          customer_ip: string | null
          customer_name: string
          customer_new_address: string | null
          customer_phone: string | null
          customer_phone_last_5_chr: string | null
          delivered_at: string | null
          delivery_notes: string | null
          dispatched_at: string | null
          fraud_flags: Json | null
          gps_distance_from_address: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          gps_verified: boolean | null
          gps_verified_at: string | null
          gpt_score: number | null
          id: string
          items: Json
          last_shopify_sync: string | null
          notes: string | null
          order_number: string
          order_type: string | null
          risk_level: string | null
          risk_score: number | null
          shopify_fulfillment_id: number | null
          shopify_last_sync_at: string | null
          shopify_order_id: number | null
          shopify_order_number: string | null
          shopify_sync_status: string | null
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
          auto_block_reason?: string | null
          auto_blocked?: boolean | null
          booked_at?: string | null
          booked_by?: string | null
          cancellation_reason?: string | null
          city: string
          comments?: Json | null
          confirmation_required?: boolean | null
          courier?: Database["public"]["Enums"]["courier_type"] | null
          created_at?: string | null
          customer_address: string
          customer_email?: string | null
          customer_id?: string | null
          customer_ip?: string | null
          customer_name: string
          customer_new_address?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          fraud_flags?: Json | null
          gps_distance_from_address?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_verified?: boolean | null
          gps_verified_at?: string | null
          gpt_score?: number | null
          id?: string
          items: Json
          last_shopify_sync?: string | null
          notes?: string | null
          order_number: string
          order_type?: string | null
          risk_level?: string | null
          risk_score?: number | null
          shopify_fulfillment_id?: number | null
          shopify_last_sync_at?: string | null
          shopify_order_id?: number | null
          shopify_order_number?: string | null
          shopify_sync_status?: string | null
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
          auto_block_reason?: string | null
          auto_blocked?: boolean | null
          booked_at?: string | null
          booked_by?: string | null
          cancellation_reason?: string | null
          city?: string
          comments?: Json | null
          confirmation_required?: boolean | null
          courier?: Database["public"]["Enums"]["courier_type"] | null
          created_at?: string | null
          customer_address?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_ip?: string | null
          customer_name?: string
          customer_new_address?: string | null
          customer_phone?: string | null
          customer_phone_last_5_chr?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          dispatched_at?: string | null
          fraud_flags?: Json | null
          gps_distance_from_address?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          gps_verified?: boolean | null
          gps_verified_at?: string | null
          gpt_score?: number | null
          id?: string
          items?: Json
          last_shopify_sync?: string | null
          notes?: string | null
          order_number?: string
          order_type?: string | null
          risk_level?: string | null
          risk_score?: number | null
          shopify_fulfillment_id?: number | null
          shopify_last_sync_at?: string | null
          shopify_order_id?: number | null
          shopify_order_number?: string | null
          shopify_sync_status?: string | null
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
            foreignKeyName: "orders_booked_by_fkey"
            columns: ["booked_by"]
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
      outlet_staff: {
        Row: {
          assigned_by: string | null
          can_access_pos: boolean
          created_at: string | null
          id: string
          outlet_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          can_access_pos?: boolean
          created_at?: string | null
          id?: string
          outlet_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          can_access_pos?: boolean
          created_at?: string | null
          id?: string
          outlet_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_staff_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
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
      packaging_items: {
        Row: {
          auto_reorder_enabled: boolean | null
          avg_daily_usage: number | null
          barcode: string | null
          barcode_format: string | null
          cost: number
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          lead_time_days: number | null
          material: string | null
          name: string
          preferred_supplier_id: string | null
          reorder_level: number
          safety_stock_level: number | null
          size: string | null
          sku: string
          supplier_id: string | null
          type: string
          updated_at: string
          usage_velocity_updated_at: string | null
        }
        Insert: {
          auto_reorder_enabled?: boolean | null
          avg_daily_usage?: number | null
          barcode?: string | null
          barcode_format?: string | null
          cost?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          material?: string | null
          name: string
          preferred_supplier_id?: string | null
          reorder_level?: number
          safety_stock_level?: number | null
          size?: string | null
          sku: string
          supplier_id?: string | null
          type: string
          updated_at?: string
          usage_velocity_updated_at?: string | null
        }
        Update: {
          auto_reorder_enabled?: boolean | null
          avg_daily_usage?: number | null
          barcode?: string | null
          barcode_format?: string | null
          cost?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          material?: string | null
          name?: string
          preferred_supplier_id?: string | null
          reorder_level?: number
          safety_stock_level?: number | null
          size?: string | null
          sku?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
          usage_velocity_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_items_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          new_stock: number
          notes: string | null
          packaging_item_id: string
          performed_by: string | null
          previous_stock: number
          quantity: number
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          new_stock: number
          notes?: string | null
          packaging_item_id: string
          performed_by?: string | null
          previous_stock: number
          quantity: number
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          new_stock?: number
          notes?: string | null
          packaging_item_id?: string
          performed_by?: string | null
          previous_stock?: number
          quantity?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_stock_movements_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_receipts: {
        Row: {
          created_at: string | null
          id: string
          printed_at: string | null
          printed_by: string | null
          receipt_data: Json
          receipt_number: string
          receipt_type: string
          sale_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          printed_at?: string | null
          printed_by?: string | null
          receipt_data: Json
          receipt_number: string
          receipt_type: string
          sale_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          printed_at?: string | null
          printed_by?: string | null
          receipt_data?: Json
          receipt_number?: string
          receipt_type?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_receipts_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_receipts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          amount_paid: number
          cashier_id: string
          change_amount: number | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          outlet_id: string
          payment_method: string
          payment_reference: string | null
          receipt_printed: boolean | null
          sale_date: string | null
          sale_number: string
          session_id: string
          status: string
          subtotal: number
          tax_amount: number | null
          total_amount: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid: number
          cashier_id: string
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          outlet_id: string
          payment_method: string
          payment_reference?: string | null
          receipt_printed?: boolean | null
          sale_date?: string | null
          sale_number: string
          session_id: string
          status?: string
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          cashier_id?: string
          change_amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          outlet_id?: string
          payment_method?: string
          payment_reference?: string | null
          receipt_printed?: boolean | null
          sale_date?: string | null
          sale_number?: string
          session_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          cash_difference: number | null
          cashier_id: string
          closed_at: string | null
          closing_cash: number | null
          created_at: string | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opening_cash: number
          outlet_id: string
          register_number: string | null
          session_number: string
          status: string
        }
        Insert: {
          cash_difference?: number | null
          cashier_id: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_cash?: number
          outlet_id: string
          register_number?: string | null
          session_number: string
          status?: string
        }
        Update: {
          cash_difference?: number | null
          cashier_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_cash?: number
          outlet_id?: string
          register_number?: string | null
          session_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_method: string
          payment_reference: string | null
          processed_at: string | null
          sale_id: string
          transaction_status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_method: string
          payment_reference?: string | null
          processed_at?: string | null
          sale_id: string
          transaction_status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string
          payment_reference?: string | null
          processed_at?: string | null
          sale_id?: string
          transaction_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
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
      product_barcodes: {
        Row: {
          barcode_format: string
          barcode_type: string
          barcode_value: string
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          barcode_format?: string
          barcode_type: string
          barcode_value: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          barcode_format?: string
          barcode_type?: string
          barcode_value?: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packaging: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          packaging_item_id: string
          product_id: string
          quantity_required: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          packaging_item_id: string
          product_id: string
          quantity_required?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          packaging_item_id?: string
          product_id?: string
          quantity_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_packaging_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_packaging_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: string
          completed_at: string | null
          created_at: string
          expiry_date: string | null
          finished_product_id: string
          id: string
          notes: string | null
          outlet_id: string
          produced_by: string | null
          production_date: string
          quantity_produced: number
          status: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          completed_at?: string | null
          created_at?: string
          expiry_date?: string | null
          finished_product_id: string
          id?: string
          notes?: string | null
          outlet_id: string
          produced_by?: string | null
          production_date?: string
          quantity_produced: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          expiry_date?: string | null
          finished_product_id?: string
          id?: string
          notes?: string | null
          outlet_id?: string
          produced_by?: string | null
          production_date?: string
          quantity_produced?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_produced_by_fkey"
            columns: ["produced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_material_usage: {
        Row: {
          created_at: string
          id: string
          packaging_item_id: string | null
          production_batch_id: string
          quantity_used: number
          raw_material_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          packaging_item_id?: string | null
          production_batch_id: string
          quantity_used: number
          raw_material_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          packaging_item_id?: string | null
          production_batch_id?: string
          quantity_used?: number
          raw_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_material_usage_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_material_usage_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_material_usage_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          auto_reorder_enabled: boolean | null
          avg_daily_sales: number | null
          barcode: string | null
          barcode_format: string | null
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          name: string
          packaging_metadata: Json | null
          preferred_supplier_id: string | null
          price: number
          product_type: string | null
          reorder_level: number
          requires_packaging: boolean | null
          safety_stock_level: number | null
          sales_velocity_updated_at: string | null
          shopify_inventory_item_id: number | null
          shopify_product_id: number | null
          shopify_variant_id: number | null
          size: string | null
          sku: string
          supplier_id: string | null
          sync_to_shopify: boolean | null
          synced_from_shopify: boolean | null
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          auto_reorder_enabled?: boolean | null
          avg_daily_sales?: number | null
          barcode?: string | null
          barcode_format?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name: string
          packaging_metadata?: Json | null
          preferred_supplier_id?: string | null
          price: number
          product_type?: string | null
          reorder_level?: number
          requires_packaging?: boolean | null
          safety_stock_level?: number | null
          sales_velocity_updated_at?: string | null
          shopify_inventory_item_id?: number | null
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          size?: string | null
          sku: string
          supplier_id?: string | null
          sync_to_shopify?: boolean | null
          synced_from_shopify?: boolean | null
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          auto_reorder_enabled?: boolean | null
          avg_daily_sales?: number | null
          barcode?: string | null
          barcode_format?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          name?: string
          packaging_metadata?: Json | null
          preferred_supplier_id?: string | null
          price?: number
          product_type?: string | null
          reorder_level?: number
          requires_packaging?: boolean | null
          safety_stock_level?: number | null
          sales_velocity_updated_at?: string | null
          shopify_inventory_item_id?: number | null
          shopify_product_id?: number | null
          shopify_variant_id?: number | null
          size?: string | null
          sku?: string
          supplier_id?: string | null
          sync_to_shopify?: boolean | null
          synced_from_shopify?: boolean | null
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      purchase_order_items: {
        Row: {
          created_at: string | null
          discount_rate: number | null
          id: string
          notes: string | null
          packaging_item_id: string | null
          po_id: string
          product_id: string | null
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
          packaging_item_id?: string | null
          po_id: string
          product_id?: string | null
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
          packaging_item_id?: string | null
          po_id?: string
          product_id?: string | null
          quantity_ordered?: number
          quantity_received?: number | null
          tax_rate?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      sales_velocity_history: {
        Row: {
          created_at: string | null
          date: string
          id: string
          outlet_id: string | null
          packaging_item_id: string | null
          product_id: string | null
          quantity_sold: number
          quantity_used: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          outlet_id?: string | null
          packaging_item_id?: string | null
          product_id?: string | null
          quantity_sold?: number
          quantity_used?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          outlet_id?: string | null
          packaging_item_id?: string | null
          product_id?: string | null
          quantity_sold?: number
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_velocity_history_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_velocity_history_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_velocity_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      scans: {
        Row: {
          barcode: string
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          outlet_id: string | null
          product_id: string | null
          scan_method: string
          scan_type: string
          scanned_by: string
          status: string | null
        }
        Insert: {
          barcode: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          outlet_id?: string | null
          product_id?: string | null
          scan_method: string
          scan_type: string
          scanned_by: string
          status?: string | null
        }
        Update: {
          barcode?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          outlet_id?: string | null
          product_id?: string | null
          scan_method?: string
          scan_type?: string
          scanned_by?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipper_advice_logs: {
        Row: {
          advice_type: string
          courier_id: string
          courier_response: Json | null
          created_at: string
          error_message: string | null
          id: string
          order_id: string | null
          remarks: string | null
          requested_at: string
          requested_by: string | null
          status: string
          tracking_id: string
        }
        Insert: {
          advice_type: string
          courier_id: string
          courier_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          remarks?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          tracking_id: string
        }
        Update: {
          advice_type?: string
          courier_id?: string
          courier_response?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          remarks?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipper_advice_logs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipper_advice_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipper_advice_logs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      shopify_webhook_registry: {
        Row: {
          address: string
          created_at: string
          error_message: string | null
          id: string
          last_triggered: string | null
          status: string
          topic: string
          webhook_id: number
        }
        Insert: {
          address: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_triggered?: string | null
          status?: string
          topic: string
          webhook_id: number
        }
        Update: {
          address?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_triggered?: string | null
          status?: string
          topic?: string
          webhook_id?: number
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
          scan_timestamp: string | null
          scanned: boolean | null
          scanned_by: string | null
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
          scan_timestamp?: string | null
          scanned?: boolean | null
          scanned_by?: string | null
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
          scan_timestamp?: string | null
          scanned?: boolean | null
          scanned_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      supplier_products: {
        Row: {
          created_at: string
          id: string
          is_primary_supplier: boolean | null
          minimum_order_quantity: number | null
          notes: string | null
          packaging_item_id: string | null
          product_id: string | null
          supplier_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary_supplier?: boolean | null
          minimum_order_quantity?: number | null
          notes?: string | null
          packaging_item_id?: string | null
          product_id?: string | null
          supplier_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary_supplier?: boolean | null
          minimum_order_quantity?: number | null
          notes?: string | null
          packaging_item_id?: string | null
          product_id?: string | null
          supplier_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          can_accept_orders: boolean | null
          can_view_analytics: boolean | null
          can_view_inventory: boolean | null
          created_at: string
          last_login: string | null
          supplier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_accept_orders?: boolean | null
          can_view_analytics?: boolean | null
          can_view_inventory?: boolean | null
          created_at?: string
          last_login?: string | null
          supplier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_accept_orders?: boolean | null
          can_view_analytics?: boolean | null
          can_view_inventory?: boolean | null
          created_at?: string
          last_login?: string | null
          supplier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_supplier_id_fkey"
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
          lead_time_days: number | null
          minimum_order_value: number | null
          name: string
          notes: string | null
          notification_preferences: Json | null
          payment_terms: string | null
          phone: string | null
          rating: number | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
          whatsapp_number: string | null
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
          lead_time_days?: number | null
          minimum_order_value?: number | null
          name: string
          notes?: string | null
          notification_preferences?: Json | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
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
          lead_time_days?: number | null
          minimum_order_value?: number | null
          name?: string
          notes?: string | null
          notification_preferences?: Json | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
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
      sync_conflicts: {
        Row: {
          conflict_type: string
          created_at: string | null
          ecomnet_data: Json
          entity_id: string
          entity_type: string
          id: string
          resolution_notes: string | null
          resolution_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          shopify_data: Json
        }
        Insert: {
          conflict_type: string
          created_at?: string | null
          ecomnet_data: Json
          entity_id: string
          entity_type: string
          id?: string
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shopify_data: Json
        }
        Update: {
          conflict_type?: string
          created_at?: string | null
          ecomnet_data?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          resolution_notes?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shopify_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          action: string
          created_at: string
          direction: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          payload: Json | null
          priority: string | null
          processed_at: string | null
          retry_count: number
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          direction: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      calculate_reorder_quantity: {
        Args: {
          p_avg_daily_sales: number
          p_current_stock: number
          p_lead_time_days: number
          p_safety_stock: number
        }
        Returns: number
      }
      calculate_variance_severity: {
        Args: { variance_value: number }
        Returns: string
      }
      ensure_supplier_role: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      generate_receipt_number: { Args: never; Returns: string }
      generate_sale_number: { Args: never; Returns: string }
      generate_session_number: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_product_lifecycle: {
        Args: { p_barcode: string }
        Returns: {
          barcode_format: string
          barcode_type: string
          barcode_value: string
          generated_at: string
          generated_by_name: string
          product_id: string
          product_name: string
          product_sku: string
          status: string
        }[]
      }
      get_user_roles: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      has_outlet_access: {
        Args: { _outlet_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_supplier: { Args: { _user_id: string }; Returns: boolean }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      mark_expired_confirmations: { Args: never; Returns: number }
      match_barcode_to_product: { Args: { p_barcode: string }; Returns: string }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      trigger_smart_reorder_now: { Args: never; Returns: Json }
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
        | "confirmed"
        | "booked"
        | "dispatched"
        | "delivered"
        | "returned"
        | "cancelled"
      return_status: "in_transit" | "received" | "processed" | "completed"
      user_role:
        | "super_admin"
        | "super_manager"
        | "warehouse_manager"
        | "store_manager"
        | "dispatch_manager"
        | "returns_manager"
        | "staff"
        | "supplier"
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
        "confirmed",
        "booked",
        "dispatched",
        "delivered",
        "returned",
        "cancelled",
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
        "supplier",
      ],
      verification_status: ["pending", "approved", "disapproved"],
    },
  },
} as const
