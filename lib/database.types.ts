// Hand-written from supabase/migrations/20261017120000_intervous_v2.sql in the shape that
// `supabase gen types typescript` produces, so it can be swapped for the generated file later.
// Text columns that carry a CHECK constraint are narrowed to their allowed values.
// The pre-v2 tables (companies, company_info, company_tags, company_tag_map, keys, profiles)
// are written from how the app uses them; the legacy jobs columns are typed nullable because
// the live nullability was never read.
//
// Usage: createClient<Database>(url, anonKey); Tables<'jobs'>, TablesInsert<'job_events'>, ...

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type JobPhase =
  | 'draft'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'no_reply'
  | 'withdrawn'
  | 'skipped'
export type WorkMode = 'onsite' | 'hybrid' | 'remote'
export type JobChannel = 'ats' | 'portal' | 'referral' | 'recruiter' | 'linkedin' | 'email' | 'other'
export type SalaryPeriod = 'year' | 'month' | 'day' | 'hour'
export type JobSource = 'web' | 'cli' | 'import'
export type EventKind =
  | 'cv_built'
  | 'applied'
  | 'auto_ack'
  | 'reply'
  | 'assessment'
  | 'interview_scheduled'
  | 'interview_done'
  | 'follow_up_sent'
  | 'rejection'
  | 'offer'
  | 'withdrawn'
  | 'skipped'
  | 'posting_closed'
  | 'phase_change'
  | 'note'
export type EventDirection = 'in' | 'out' | 'self'
export type EventSource = 'web' | 'cli' | 'import' | 'auto'
export type DocumentKind = 'cv_pdf' | 'cv_source' | 'jd_snapshot' | 'cover_letter' | 'other'
export type RequirementImportance = 'required' | 'nice'
export type RequirementVerdict = 'met' | 'partial' | 'gap' | 'caution'
export type GapState = 'open' | 'worded_around' | 'not_claimed' | 'no_longer_true'
export type MetricStatus = 'verified' | 'needs_care' | 'unverified'

/** Private storage bucket for CV PDFs and LaTeX sources. Object name: <uid>/<slug>/<kind>/<sha12>-<file> */
export const INTERVOUS_DOCS_BUCKET = 'intervous-docs'

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: number
          user_id: string | null
          company_name: string | null
          role: string | null
          location: string | null
          /** legacy, mirrors applied_on as 'YYYY-MM-DD' (NULL for drafts) */
          application_date: string | null
          /** legacy, derived from phase: 'Not Applied' | 'Active' | 'Inactive' */
          status: string | null
          /** legacy, derived from phase */
          stage: string | null
          url: string | null
          /** source of truth for where the application stands (NULL only before the backfill) */
          phase: JobPhase | null
          slug: string | null
          company_id: string | null
          team: string | null
          work_mode: WorkMode | null
          country_code: string | null
          channel: JobChannel | null
          channel_detail: string | null
          role_family: string | null
          seniority: string | null
          years_required: number | null
          visa_needed: boolean | null
          salary_text: string | null
          salary_min: number | null
          salary_max: number | null
          salary_currency: string | null
          salary_period: SalaryPeriod | null
          applied_on: string | null
          cv_built_on: string | null
          closes_on: string | null
          posting_live: boolean | null
          posting_checked_at: string | null
          next_action: string | null
          next_action_due: string | null
          cv_variant: string | null
          notes: string | null
          status_evidence: string | null
          /** field names whose value is not confirmed, e.g. ['phase', 'applied_on'] */
          uncertain: string[]
          source: JobSource
          last_activity_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          user_id?: string | null
          company_name?: string | null
          role?: string | null
          location?: string | null
          application_date?: string | null
          status?: string | null
          stage?: string | null
          url?: string | null
          phase?: JobPhase | null
          slug?: string | null
          company_id?: string | null
          team?: string | null
          work_mode?: WorkMode | null
          country_code?: string | null
          channel?: JobChannel | null
          channel_detail?: string | null
          role_family?: string | null
          seniority?: string | null
          years_required?: number | null
          visa_needed?: boolean | null
          salary_text?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          salary_period?: SalaryPeriod | null
          applied_on?: string | null
          cv_built_on?: string | null
          closes_on?: string | null
          posting_live?: boolean | null
          posting_checked_at?: string | null
          next_action?: string | null
          next_action_due?: string | null
          cv_variant?: string | null
          notes?: string | null
          status_evidence?: string | null
          uncertain?: string[]
          source?: JobSource
          last_activity_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string | null
          company_name?: string | null
          role?: string | null
          location?: string | null
          application_date?: string | null
          status?: string | null
          stage?: string | null
          url?: string | null
          phase?: JobPhase | null
          slug?: string | null
          company_id?: string | null
          team?: string | null
          work_mode?: WorkMode | null
          country_code?: string | null
          channel?: JobChannel | null
          channel_detail?: string | null
          role_family?: string | null
          seniority?: string | null
          years_required?: number | null
          visa_needed?: boolean | null
          salary_text?: string | null
          salary_min?: number | null
          salary_max?: number | null
          salary_currency?: string | null
          salary_period?: SalaryPeriod | null
          applied_on?: string | null
          cv_built_on?: string | null
          closes_on?: string | null
          posting_live?: boolean | null
          posting_checked_at?: string | null
          next_action?: string | null
          next_action_due?: string | null
          cv_variant?: string | null
          notes?: string | null
          status_evidence?: string | null
          uncertain?: string[]
          source?: JobSource
          last_activity_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      user_settings: {
        Row: {
          user_id: string
          follow_up_after_days: number
          no_reply_after_days: number
          mature_after_days: number
          draft_stale_after_days: number
          weekly_target: number
          timezone: string
          campaign_start: string
          updated_at: string
        }
        Insert: {
          user_id?: string
          follow_up_after_days?: number
          no_reply_after_days?: number
          mature_after_days?: number
          draft_stale_after_days?: number
          weekly_target?: number
          timezone?: string
          campaign_start?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          follow_up_after_days?: number
          no_reply_after_days?: number
          mature_after_days?: number
          draft_stale_after_days?: number
          weekly_target?: number
          timezone?: string
          campaign_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          job_id: number | null
          company_id: string | null
          name: string
          role: string | null
          email: string | null
          linkedin_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          job_id?: number | null
          company_id?: string | null
          name: string
          role?: string | null
          email?: string | null
          linkedin_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: number | null
          company_id?: string | null
          name?: string
          role?: string | null
          email?: string | null
          linkedin_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contacts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      job_events: {
        Row: {
          id: number
          job_id: number
          user_id: string
          kind: EventKind
          direction: EventDirection | null
          /** 'YYYY-MM-DD' */
          occurred_on: string
          occurred_at: string | null
          date_uncertain: boolean
          from_phase: string | null
          to_phase: JobPhase | null
          title: string | null
          body: string | null
          contact_id: string | null
          source: EventSource
          created_at: string
        }
        Insert: {
          /** generated always: never send it */
          id?: never
          job_id: number
          user_id?: string
          kind: EventKind
          /** inferred from kind when omitted */
          direction?: EventDirection | null
          occurred_on?: string
          occurred_at?: string | null
          date_uncertain?: boolean
          /** filled with the current phase when to_phase is set */
          from_phase?: string | null
          /** inferred from kind when omitted (except for phase_change) */
          to_phase?: JobPhase | null
          title?: string | null
          body?: string | null
          contact_id?: string | null
          source?: EventSource
          created_at?: string
        }
        Update: {
          id?: never
          job_id?: number
          user_id?: string
          kind?: EventKind
          direction?: EventDirection | null
          occurred_on?: string
          occurred_at?: string | null
          date_uncertain?: boolean
          from_phase?: string | null
          to_phase?: JobPhase | null
          title?: string | null
          body?: string | null
          contact_id?: string | null
          source?: EventSource
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_events_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_events_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_events_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      job_documents: {
        Row: {
          id: string
          job_id: number
          user_id: string
          kind: DocumentKind
          label: string | null
          /** object name in bucket intervous-docs */
          storage_path: string | null
          /** inline text, e.g. the JD snapshot as Markdown */
          content: string | null
          mime_type: string | null
          size_bytes: number | null
          sha256: string
          source_url: string | null
          captured_at: string | null
          /** true: this exact file was sent; null: unknown */
          submitted: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: number
          user_id?: string
          kind: DocumentKind
          label?: string | null
          storage_path?: string | null
          content?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          sha256: string
          source_url?: string | null
          captured_at?: string | null
          submitted?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: number
          user_id?: string
          kind?: DocumentKind
          label?: string | null
          storage_path?: string | null
          content?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          sha256?: string
          source_url?: string | null
          captured_at?: string | null
          submitted?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_documents_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_documents_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
        ]
      }
      job_answers: {
        Row: {
          id: string
          job_id: number
          user_id: string
          position: number
          question: string
          /** NULL = given somewhere (portal, chat) but never saved */
          answer: string | null
          char_limit: number | null
          submitted: boolean | null
          source_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: number
          user_id?: string
          position?: number
          question: string
          answer?: string | null
          char_limit?: number | null
          submitted?: boolean | null
          source_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: number
          user_id?: string
          position?: number
          question?: string
          answer?: string | null
          char_limit?: number | null
          submitted?: boolean | null
          source_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_answers_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_answers_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
        ]
      }
      job_requirements: {
        Row: {
          id: string
          job_id: number
          user_id: string
          position: number
          requirement: string
          importance: RequirementImportance | null
          verdict: RequirementVerdict
          /** met/partial: what was shown; caution: the correct fact */
          evidence: string | null
          /** lowercase snake_case key, e.g. 'years_experience' */
          topic: string | null
          gap_state: GapState | null
          /** exact phrase from the JD, for highlighting */
          anchor_text: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: number
          user_id?: string
          position?: number
          requirement: string
          importance?: RequirementImportance | null
          verdict: RequirementVerdict
          evidence?: string | null
          topic?: string | null
          gap_state?: GapState | null
          anchor_text?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: number
          user_id?: string
          position?: number
          requirement?: string
          importance?: RequirementImportance | null
          verdict?: RequirementVerdict
          evidence?: string | null
          topic?: string | null
          gap_state?: GapState | null
          anchor_text?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_requirements_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_requirements_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
        ]
      }
      proof_points: {
        Row: {
          id: string
          user_id: string
          key: string
          name: string
          summary: string | null
          metric: string | null
          /** canonical true numbers, e.g. {"exact_match": "73.8%"} */
          facts: Json
          aliases: string[]
          metric_status: MetricStatus
          caveat: string | null
          link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          key: string
          name: string
          summary?: string | null
          metric?: string | null
          facts?: Json
          aliases?: string[]
          metric_status?: MetricStatus
          caveat?: string | null
          link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          key?: string
          name?: string
          summary?: string | null
          metric?: string | null
          facts?: Json
          aliases?: string[]
          metric_status?: MetricStatus
          caveat?: string | null
          link?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_proof_points: {
        Row: {
          job_id: number
          proof_point_id: string
          user_id: string
          position: number
          /** how it was worded in this application, e.g. "300+ cases, 93%" */
          detail: string | null
        }
        Insert: {
          job_id: number
          proof_point_id: string
          user_id?: string
          position?: number
          detail?: string | null
        }
        Update: {
          job_id?: number
          proof_point_id?: string
          user_id?: string
          position?: number
          detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'job_proof_points_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_proof_points_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'job_overview'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_proof_points_proof_point_id_fkey'
            columns: ['proof_point_id']
            isOneToOne: false
            referencedRelation: 'proof_points'
            referencedColumns: ['id']
          },
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          website: string | null
          logo_url: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          website?: string | null
          logo_url?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          website?: string | null
          logo_url?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      company_info: {
        Row: {
          company_id: string
          description: string | null
          industry: string | null
          headquarters: string | null
          founded: string | null
          employee_count: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          description?: string | null
          industry?: string | null
          headquarters?: string | null
          founded?: string | null
          employee_count?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          description?: string | null
          industry?: string | null
          headquarters?: string | null
          founded?: string | null
          employee_count?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'company_info_company_id_fkey'
            columns: ['company_id']
            isOneToOne: true
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      company_tags: {
        Row: {
          id: string
          name: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      company_tag_map: {
        Row: {
          company_id: string
          tag_id: string
          created_by: string | null
        }
        Insert: {
          company_id: string
          tag_id: string
          created_by?: string | null
        }
        Update: {
          company_id?: string
          tag_id?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'company_tag_map_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'company_tag_map_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'company_tags'
            referencedColumns: ['id']
          },
        ]
      }
      keys: {
        Row: {
          user_id: string
          open_ai: string | null
          deep_seek: string | null
          mistral: string | null
          tavily: string | null
        }
        Insert: {
          user_id: string
          open_ai?: string | null
          deep_seek?: string | null
          mistral?: string | null
          tavily?: string | null
        }
        Update: {
          user_id?: string
          open_ai?: string | null
          deep_seek?: string | null
          mistral?: string | null
          tavily?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          avatar_url: string | null
        }
        Insert: {
          id: string
          avatar_url?: string | null
        }
        Update: {
          id?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      /** read model for Today, Applications, Insights and the CLI (RLS applies: security_invoker) */
      job_overview: {
        Row: {
          id: number | null
          slug: string | null
          user_id: string | null
          company_name: string | null
          company_id: string | null
          role: string | null
          location: string | null
          country_code: string | null
          url: string | null
          phase: JobPhase | null
          stage: string | null
          channel: JobChannel | null
          role_family: string | null
          visa_needed: boolean | null
          years_required: number | null
          applied_on: string | null
          cv_built_on: string | null
          closes_on: string | null
          next_action: string | null
          next_action_due: string | null
          posting_live: boolean | null
          uncertain: string[] | null
          last_activity_at: string | null
          created_at: string | null
          updated_at: string | null
          source: JobSource | null
          /** first inbound event that is not an auto-acknowledgement */
          first_response_on: string | null
          /** latest inbound (non auto_ack) event on or before today */
          last_inbound_on: string | null
          last_follow_up_on: string | null
          /** latest non-phase_change event on or before today */
          last_event_on: string | null
          /** earliest interview_scheduled from the start of today on */
          next_interview_at: string | null
          /** gaps whose gap_state is not no_longer_true */
          open_gaps: number | null
          cautions: number | null
          answer_count: number | null
          /** answers whose text was never saved */
          unsaved_answers: number | null
          has_cv: boolean | null
          has_sent_cv: boolean | null
          has_jd: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      /** One atomic write for the CLI and the importer. See section 4.3/6.3 of docs/SPEC.md for the payload. */
      iv_upsert_application: {
        Args: { p: Json }
        Returns: Json
      }
      iv_phase_from_legacy: {
        Args: { p_status: string; p_stage: string }
        Returns: string
      }
      iv_legacy_status: {
        Args: { p_phase: string }
        Returns: string
      }
      iv_legacy_stage: {
        Args: { p_phase: string; p_old_stage: string }
        Returns: string
      }
      iv_implied_phase: {
        Args: { p_kind: string; p_current: string }
        Returns: string
      }
      iv_parse_date: {
        Args: { s: string }
        Returns: string
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

/** What iv_upsert_application returns. */
export type UpsertApplicationResult = {
  id: number
  slug: string
  created: boolean
  adopted: boolean
  phase: JobPhase
  company: string | null
  company_id: string | null
  company_created: boolean
}

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never

export type JobRow = Tables<'jobs'>
export type JobOverviewRow = Tables<'job_overview'>
export type JobEventRow = Tables<'job_events'>
export type JobDocumentRow = Tables<'job_documents'>
export type JobAnswerRow = Tables<'job_answers'>
export type JobRequirementRow = Tables<'job_requirements'>
export type ProofPointRow = Tables<'proof_points'>
export type JobProofPointRow = Tables<'job_proof_points'>
export type ContactRow = Tables<'contacts'>
export type UserSettingsRow = Tables<'user_settings'>
