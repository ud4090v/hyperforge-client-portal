import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Json = string | number | boolean | null | Record<string, unknown> | Json[]

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          auth_id: string | null
          email: string
          name: string | null
          tier: string
          created_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          email: string
          name?: string | null
          tier?: string
          created_at?: string
        }
        Update: {
          id?: string
          auth_id?: string | null
          email?: string
          name?: string | null
          tier?: string
          created_at?: string
        }
      }
      customer_projects: {
        Row: {
          id: string
          customer_id: string
          plane_project_id: string
          plane_project_slug: string | null
          template_slug: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          plane_project_id: string
          plane_project_slug?: string | null
          template_slug?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          plane_project_id?: string
          plane_project_slug?: string | null
          template_slug?: string | null
          created_at?: string
        }
      }
      consult_sessions: {
        Row: {
          id: string
          customer_id: string
          status: 'scheduled' | 'active' | 'warned' | 'ended'
          started_at: string | null
          warned_at: string | null
          ended_at: string | null
          summary: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          status?: 'scheduled' | 'active' | 'warned' | 'ended'
          started_at?: string | null
          warned_at?: string | null
          ended_at?: string | null
          summary?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          status?: 'scheduled' | 'active' | 'warned' | 'ended'
          started_at?: string | null
          warned_at?: string | null
          ended_at?: string | null
          summary?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          customer_id: string | null
          project_id: string | null
          endpoint: string
          action: string
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          project_id?: string | null
          endpoint: string
          action: string
          ip_address?: string | null
          created_at?: string
        }
        Update: never
      }
      templates: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          complexity: 'low' | 'medium' | 'high' | null
          active: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          complexity?: 'low' | 'medium' | 'high' | null
          active?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          complexity?: 'low' | 'medium' | 'high' | null
          active?: boolean
          sort_order?: number
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Browser client (singleton) ──────────────────────────────────────────────

// Use unknown generic to avoid Supabase internal type constraint issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBrowserClient(): SupabaseClient<any> {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    )
  }

  browserClient = _createBrowserClient(url, key)
  return browserClient
}

// ─── Server client (per-request) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServerClient(cookieStore: ReadonlyRequestCookies): SupabaseClient<any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    )
  }

  return _createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // In Server Components, cookies are read-only
        // Cookie mutation happens in middleware or Route Handlers
      },
    },
  })
}
