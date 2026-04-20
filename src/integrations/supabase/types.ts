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
      app_ratings: {
        Row: {
          created_at: string
          feedback_message: string | null
          id: string
          star_rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_message?: string | null
          id?: string
          star_rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_message?: string | null
          id?: string
          star_rating?: number
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_date: string | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          provider_id: string
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_date?: string | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          provider_id: string
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_date?: string | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          provider_id?: string
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_id: string
          cover_message: string | null
          created_at: string
          id: string
          job_post_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          cover_message?: string | null
          created_at?: string
          id?: string
          job_post_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          cover_message?: string | null
          created_at?: string
          id?: string
          job_post_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posts: {
        Row: {
          budget: number | null
          budget_type: string
          category_id: string
          city: string | null
          client_id: string
          county: string | null
          created_at: string
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          budget_type?: string
          category_id: string
          city?: string | null
          client_id: string
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          budget_type?: string
          category_id?: string
          city?: string | null
          client_id?: string
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_responses: {
        Row: {
          created_at: string
          id: string
          job_post_id: string
          message: string | null
          proposed_price: number | null
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_post_id: string
          message?: string | null
          proposed_price?: number | null
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_post_id?: string
          message?: string | null
          proposed_price?: number | null
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_responses_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_seeker_profiles: {
        Row: {
          bio: string | null
          certifications: string | null
          created_at: string
          cv_url: string | null
          education: string | null
          experience_description: string | null
          experience_years: number | null
          id: string
          preferred_categories: string[] | null
          preferred_city: string | null
          preferred_county: string | null
          skills: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          cv_url?: string | null
          education?: string | null
          experience_description?: string | null
          experience_years?: number | null
          id?: string
          preferred_categories?: string[] | null
          preferred_city?: string | null
          preferred_county?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          certifications?: string | null
          created_at?: string
          cv_url?: string | null
          education?: string | null
          experience_description?: string | null
          experience_years?: number | null
          id?: string
          preferred_categories?: string[] | null
          preferred_city?: string | null
          preferred_county?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount_kes: number
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone_number: string
          raw_callback: Json | null
          result_code: number | null
          result_desc: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kes: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone_number: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone_number?: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "premium_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          client_id: string
          created_at: string
          id: string
          payment_method: string
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id: string
          client_id: string
          created_at?: string
          id?: string
          payment_method?: string
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          client_id?: string
          created_at?: string
          id?: string
          payment_method?: string
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_subscriptions: {
        Row: {
          amount_kes: number
          created_at: string
          expires_at: string | null
          id: string
          mpesa_receipt: string | null
          payment_method: string
          payment_reference: string | null
          role_type: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          expires_at?: string | null
          id?: string
          mpesa_receipt?: string | null
          payment_method?: string
          payment_reference?: string | null
          role_type: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          mpesa_receipt?: string | null
          payment_method?: string
          payment_reference?: string | null
          role_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          start_time: string
          user_id: string
        }
        Insert: {
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          user_id: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_profiles: {
        Row: {
          availability_status: string
          business_name: string
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          description: string | null
          id: string
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          profile_image_url: string | null
          service_radius_km: number | null
          service_type: string | null
          skills: string[] | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          availability_status?: string
          business_name: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          profile_image_url?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          availability_status?: string
          business_name?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          profile_image_url?: string | null
          service_radius_km?: number | null
          service_type?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      provider_statuses: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          text_content: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          text_content?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          text_content?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      provider_verifications: {
        Row: {
          admin_notes: string | null
          created_at: string
          document_type: string
          document_url: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          document_type: string
          document_url: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          document_type?: string
          document_url?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          provider_id: string
          rating: number
        }
        Insert: {
          booking_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id: string
          rating: number
        }
        Update: {
          booking_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string
          city: string | null
          county: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          price: number | null
          price_type: string
          provider_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          price_type?: string
          provider_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          price?: number | null
          price_type?: string
          provider_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      status_boosts: {
        Row: {
          amount_kes: number
          boost_end: string
          boost_start: string
          boost_tier: string
          created_at: string
          id: string
          is_active: boolean
          payment_method: string
          payment_reference: string | null
          payment_status: string
          status_id: string
          user_id: string
        }
        Insert: {
          amount_kes?: number
          boost_end: string
          boost_start?: string
          boost_tier?: string
          created_at?: string
          id?: string
          is_active?: boolean
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          status_id: string
          user_id: string
        }
        Update: {
          amount_kes?: number
          boost_end?: string
          boost_start?: string
          boost_tier?: string
          created_at?: string
          id?: string
          is_active?: boolean
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_boosts_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "provider_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_likes: {
        Row: {
          created_at: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_likes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "provider_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_replies_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "provider_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          id: string
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "provider_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_suspensions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reason: string
          suspended_by: string
          suspended_until: string | null
          suspension_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason: string
          suspended_by: string
          suspended_until?: string | null
          suspension_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string
          suspended_by?: string
          suspended_until?: string | null
          suspension_type?: string
          user_id?: string
        }
        Relationships: []
      }
      video_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          category_id: string | null
          city: string | null
          comment_count: number
          county: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          like_count: number
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string
          view_count: number
        }
        Insert: {
          category_id?: string | null
          city?: string | null
          comment_count?: number
          county?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          like_count?: number
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_url: string
          view_count?: number
        }
        Update: {
          category_id?: string | null
          city?: string | null
          comment_count?: number
          county?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          like_count?: number
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_subscription: {
        Args: { _role_type: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: { Args: { status_id: string }; Returns: undefined }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
      nearby_services: {
        Args: {
          _category_id?: string
          _lat: number
          _limit_count?: number
          _lng: number
          _min_rating?: number
          _offset_count?: number
          _radius_km?: number
        }
        Returns: {
          avg_rating: number
          business_name: string
          category_icon: string
          category_id: string
          category_name: string
          city: string
          county: string
          description: string
          distance_km: number
          is_verified: boolean
          latitude: number
          longitude: number
          price: number
          price_type: string
          profile_image_url: string
          provider_id: string
          review_count: number
          service_id: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "provider" | "job_seeker" | "client" | "admin"
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
      app_role: ["provider", "job_seeker", "client", "admin"],
    },
  },
} as const
