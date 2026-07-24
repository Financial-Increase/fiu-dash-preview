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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      book_orders: {
        Row: {
          address: string
          carrier: string
          city: string
          contact_id: string
          created_at: string
          date_ordered: string
          date_shipped: string | null
          delivered: boolean
          fulfillment_status: string
          id: string
          label_url: string | null
          quantity: number
          shippo_transaction_id: string | null
          source_transaction_id: string | null
          state: string
          tracking_number: string
          tracking_status: string
          zip: string
        }
        Insert: {
          address?: string
          carrier?: string
          city?: string
          contact_id: string
          created_at?: string
          date_ordered?: string
          date_shipped?: string | null
          delivered?: boolean
          fulfillment_status?: string
          id?: string
          label_url?: string | null
          quantity?: number
          shippo_transaction_id?: string | null
          source_transaction_id?: string | null
          state?: string
          tracking_number?: string
          tracking_status?: string
          zip?: string
        }
        Update: {
          address?: string
          carrier?: string
          city?: string
          contact_id?: string
          created_at?: string
          date_ordered?: string
          date_shipped?: string | null
          delivered?: boolean
          fulfillment_status?: string
          id?: string
          label_url?: string | null
          quantity?: number
          shippo_transaction_id?: string | null
          source_transaction_id?: string | null
          state?: string
          tracking_number?: string
          tracking_status?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_date: string
          call_type: string
          contact_id: string
          created_at: string
          duration_minutes: number | null
          host_team_member_id: string
          id: string
          notes: string
          scheduled_for: string | null
          source: string
          status: string
        }
        Insert: {
          call_date?: string
          call_type?: string
          contact_id: string
          created_at?: string
          duration_minutes?: number | null
          host_team_member_id?: string
          id?: string
          notes?: string
          scheduled_for?: string | null
          source?: string
          status?: string
        }
        Update: {
          call_date?: string
          call_type?: string
          contact_id?: string
          created_at?: string
          duration_minutes?: number | null
          host_team_member_id?: string
          id?: string
          notes?: string
          scheduled_for?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_host_team_member_id_fkey"
            columns: ["host_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_ledger: {
        Row: {
          amount: number
          created_at: string
          description: string
          entry_date: string
          entry_type: string
          id: string
          team_member_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          entry_date?: string
          entry_type?: string
          id?: string
          team_member_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          entry_date?: string
          entry_type?: string
          id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compensation_ledger_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          contact_id: string
          created_at: string
          created_by_name: string
          id: string
          note_text: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by_name?: string
          id?: string
          note_text: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by_name?: string
          id?: string
          note_text?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          source_1: string
          source_2: string
          source_3: string
          source_4: string
          source_5: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string
          source_1?: string
          source_2?: string
          source_3?: string
          source_4?: string
          source_5?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          source_1?: string
          source_2?: string
          source_3?: string
          source_4?: string
          source_5?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      highlevel_subscriptions: {
        Row: {
          alt_id: string | null
          alt_type: string | null
          amount: number | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          entity_id: string | null
          entity_source_domain: string | null
          entity_source_id: string | null
          entity_source_name: string | null
          entity_source_page_id: string | null
          entity_source_page_url: string | null
          entity_source_step_id: string | null
          entity_source_sub_type: string | null
          entity_source_type: string | null
          entity_type: string | null
          ghl_created_at: string | null
          ghl_updated_at: string | null
          id: string
          ip_address: string | null
          is_late: boolean
          last_failed_payment_at: string | null
          late_since: string | null
          line_item_index: number | null
          line_item_name: string | null
          line_item_product_id: string | null
          line_item_quantity: number | null
          line_item_tax_index: number | null
          live_mode: boolean | null
          payment_provider_account: string | null
          payment_provider_type: string | null
          raw_payload: Json | null
          recurring_interval: string | null
          recurring_interval_count: number | null
          recurring_price_id: string | null
          recurring_product_id: string | null
          recurring_product_name: string | null
          resolved_at: string | null
          status: string | null
          subscription_end_date: string | null
          subscription_id: string | null
          subscription_start_date: string | null
          trial_end_date: string | null
          trial_period: number | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          alt_id?: string | null
          alt_type?: string | null
          amount?: number | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          entity_source_domain?: string | null
          entity_source_id?: string | null
          entity_source_name?: string | null
          entity_source_page_id?: string | null
          entity_source_page_url?: string | null
          entity_source_step_id?: string | null
          entity_source_sub_type?: string | null
          entity_source_type?: string | null
          entity_type?: string | null
          ghl_created_at?: string | null
          ghl_updated_at?: string | null
          id: string
          ip_address?: string | null
          is_late?: boolean
          last_failed_payment_at?: string | null
          late_since?: string | null
          line_item_index?: number | null
          line_item_name?: string | null
          line_item_product_id?: string | null
          line_item_quantity?: number | null
          line_item_tax_index?: number | null
          live_mode?: boolean | null
          payment_provider_account?: string | null
          payment_provider_type?: string | null
          raw_payload?: Json | null
          recurring_interval?: string | null
          recurring_interval_count?: number | null
          recurring_price_id?: string | null
          recurring_product_id?: string | null
          recurring_product_name?: string | null
          resolved_at?: string | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_id?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_period?: number | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          alt_id?: string | null
          alt_type?: string | null
          amount?: number | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string | null
          entity_source_domain?: string | null
          entity_source_id?: string | null
          entity_source_name?: string | null
          entity_source_page_id?: string | null
          entity_source_page_url?: string | null
          entity_source_step_id?: string | null
          entity_source_sub_type?: string | null
          entity_source_type?: string | null
          entity_type?: string | null
          ghl_created_at?: string | null
          ghl_updated_at?: string | null
          id?: string
          ip_address?: string | null
          is_late?: boolean
          last_failed_payment_at?: string | null
          late_since?: string | null
          line_item_index?: number | null
          line_item_name?: string | null
          line_item_product_id?: string | null
          line_item_quantity?: number | null
          line_item_tax_index?: number | null
          live_mode?: boolean | null
          payment_provider_account?: string | null
          payment_provider_type?: string | null
          raw_payload?: Json | null
          recurring_interval?: string | null
          recurring_interval_count?: number | null
          recurring_price_id?: string | null
          recurring_product_id?: string | null
          recurring_product_name?: string | null
          resolved_at?: string | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_id?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_period?: number | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      highlevel_transactions: {
        Row: {
          address1: string | null
          card_brand: string | null
          card_last4: string | null
          city: string | null
          contact_id: string | null
          contact_source: string | null
          contact_type: string | null
          country: string | null
          created_at: string
          currency_code: string | null
          currency_symbol: string | null
          date_created: string | null
          discount_amount: number | null
          email: string | null
          first_medium: string | null
          first_name: string | null
          first_referrer: string | null
          first_session_source: string | null
          first_session_url: string | null
          first_utm_content: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          first_utm_term: string | null
          full_address: string | null
          full_name: string | null
          funnel_id: string | null
          funnel_step_id: string | null
          funnel_sub_source: string | null
          funnel_transaction_type: string | null
          global_product_ids: Json | null
          global_product_price_ids: Json | null
          id: string
          last_medium: string | null
          last_name: string | null
          last_referrer: string | null
          last_session_source: string | null
          last_session_url: string | null
          last_utm_content: string | null
          last_utm_medium: string | null
          last_utm_source: string | null
          last_utm_term: string | null
          line_items: Json | null
          location_address: string | null
          location_city: string | null
          location_country: string | null
          location_id: string | null
          location_name: string | null
          location_postal_code: string | null
          location_state: string | null
          miscellaneous_charges: number | null
          payment_created_at: string | null
          payment_created_on: string | null
          payment_gateway: string | null
          payment_method: string | null
          payment_source: string | null
          payment_status: string | null
          phone: string | null
          postal_code: string | null
          raw_payload: Json | null
          state: string | null
          sub_total_amount: number | null
          tags: string | null
          tax_amount: number | null
          timezone: string | null
          total_amount: number | null
          transaction_id: string | null
          workflow_id: string | null
          workflow_name: string | null
        }
        Insert: {
          address1?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          contact_id?: string | null
          contact_source?: string | null
          contact_type?: string | null
          country?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          date_created?: string | null
          discount_amount?: number | null
          email?: string | null
          first_medium?: string | null
          first_name?: string | null
          first_referrer?: string | null
          first_session_source?: string | null
          first_session_url?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          full_address?: string | null
          full_name?: string | null
          funnel_id?: string | null
          funnel_step_id?: string | null
          funnel_sub_source?: string | null
          funnel_transaction_type?: string | null
          global_product_ids?: Json | null
          global_product_price_ids?: Json | null
          id?: string
          last_medium?: string | null
          last_name?: string | null
          last_referrer?: string | null
          last_session_source?: string | null
          last_session_url?: string | null
          last_utm_content?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          line_items?: Json | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          location_id?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_state?: string | null
          miscellaneous_charges?: number | null
          payment_created_at?: string | null
          payment_created_on?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_source?: string | null
          payment_status?: string | null
          phone?: string | null
          postal_code?: string | null
          raw_payload?: Json | null
          state?: string | null
          sub_total_amount?: number | null
          tags?: string | null
          tax_amount?: number | null
          timezone?: string | null
          total_amount?: number | null
          transaction_id?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Update: {
          address1?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          contact_id?: string | null
          contact_source?: string | null
          contact_type?: string | null
          country?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          date_created?: string | null
          discount_amount?: number | null
          email?: string | null
          first_medium?: string | null
          first_name?: string | null
          first_referrer?: string | null
          first_session_source?: string | null
          first_session_url?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          full_address?: string | null
          full_name?: string | null
          funnel_id?: string | null
          funnel_step_id?: string | null
          funnel_sub_source?: string | null
          funnel_transaction_type?: string | null
          global_product_ids?: Json | null
          global_product_price_ids?: Json | null
          id?: string
          last_medium?: string | null
          last_name?: string | null
          last_referrer?: string | null
          last_session_source?: string | null
          last_session_url?: string | null
          last_utm_content?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          line_items?: Json | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          location_id?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_state?: string | null
          miscellaneous_charges?: number | null
          payment_created_at?: string | null
          payment_created_on?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_source?: string | null
          payment_status?: string | null
          phone?: string | null
          postal_code?: string | null
          raw_payload?: Json | null
          state?: string | null
          sub_total_amount?: number | null
          tags?: string | null
          tax_amount?: number | null
          timezone?: string | null
          total_amount?: number | null
          transaction_id?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      membership_records: {
        Row: {
          cancellation_date: string | null
          contact_id: string
          created_at: string
          id: string
          member_since: string | null
          membership_status: string
          months_active: number
          utm_source: string
        }
        Insert: {
          cancellation_date?: string | null
          contact_id: string
          created_at?: string
          id?: string
          member_since?: string | null
          membership_status?: string
          months_active?: number
          utm_source?: string
        }
        Update: {
          cancellation_date?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          member_since?: string | null
          membership_status?: string
          months_active?: number
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filter_views: {
        Row: {
          created_at: string
          dashboard: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard: string
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      summit_registrations: {
        Row: {
          attended: boolean
          contact_id: string
          created_at: string
          id: string
          summit: string
          ticket_type: string
          utm_source: string
        }
        Insert: {
          attended?: boolean
          contact_id: string
          created_at?: string
          id?: string
          summit?: string
          ticket_type?: string
          utm_source?: string
        }
        Update: {
          attended?: boolean
          contact_id?: string
          created_at?: string
          id?: string
          summit?: string
          ticket_type?: string
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "summit_registrations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_collaborators: {
        Row: {
          created_at: string
          id: string
          task_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_collaborators_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborators_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          author_name: string
          comment_text: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          comment_text: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          comment_text?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          link_url: string | null
          owner_id: string
          position: number
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          link_url?: string | null
          owner_id: string
          position?: number
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          link_url?: string | null
          owner_id?: string
          position?: number
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          page_permissions: string[]
          role: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          page_permissions?: string[]
          role?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          page_permissions?: string[]
          role?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          contact_id: string
          created_at: string
          date: string
          description: string
          id: string
          nmi_transaction_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          category?: string
          contact_id: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          nmi_transaction_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          category?: string
          contact_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          nmi_transaction_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      velocity_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_date: string | null
          status: string
          velocity_member_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          paid_date?: string | null
          status?: string
          velocity_member_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_date?: string | null
          status?: string
          velocity_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "velocity_installments_velocity_member_id_fkey"
            columns: ["velocity_member_id"]
            isOneToOne: false
            referencedRelation: "velocity_members"
            referencedColumns: ["id"]
          },
        ]
      }
      velocity_members: {
        Row: {
          cohort: string
          contact_id: string
          created_at: string
          deposit: number
          deposit_date: string | null
          deposit_status: string
          end_date: string
          id: string
          start_date: string
          total_sale: number
          velocity_status: string
        }
        Insert: {
          cohort?: string
          contact_id: string
          created_at?: string
          deposit?: number
          deposit_date?: string | null
          deposit_status?: string
          end_date: string
          id?: string
          start_date: string
          total_sale?: number
          velocity_status?: string
        }
        Update: {
          cohort?: string
          contact_id?: string
          created_at?: string
          deposit?: number
          deposit_date?: string | null
          deposit_status?: string
          end_date?: string
          id?: string
          start_date?: string
          total_sale?: number
          velocity_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "velocity_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      velocity_sales: {
        Row: {
          attended: boolean
          call_date: string | null
          cohort: string
          contact_id: string
          created_at: string
          enrolled: boolean
          id: string
          lead_source: string
          sale_amount: number
        }
        Insert: {
          attended?: boolean
          call_date?: string | null
          cohort?: string
          contact_id: string
          created_at?: string
          enrolled?: boolean
          id?: string
          lead_source?: string
          sale_amount?: number
        }
        Update: {
          attended?: boolean
          call_date?: string | null
          cohort?: string
          contact_id?: string
          created_at?: string
          enrolled?: boolean
          id?: string
          lead_source?: string
          sale_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "velocity_sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_registrations: {
        Row: {
          attended: boolean
          contact_id: string
          created_at: string
          date_registered: string
          id: string
          membership_status: string
          workshop_date: string | null
        }
        Insert: {
          attended?: boolean
          contact_id: string
          created_at?: string
          date_registered?: string
          id?: string
          membership_status?: string
          workshop_date?: string | null
        }
        Update: {
          attended?: boolean
          contact_id?: string
          created_at?: string
          date_registered?: string
          id?: string
          membership_status?: string
          workshop_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_registrations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_task: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      can_manage_task: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      current_team_member_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_own_profile: {
        Args: { p_email: string; p_name: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
