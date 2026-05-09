import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import type { CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(
        new URL('/auth/error?reason=config', requestUrl.origin)
      )
    }

    const cookieMethods: CookieMethodsServer = {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      },
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: cookieMethods,
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        new URL(
          `/auth/error?reason=${encodeURIComponent(error.message)}`,
          requestUrl.origin
        )
      )
    }
  }

  // Redirect to intended destination or dashboard
  return NextResponse.redirect(new URL(redirect, requestUrl.origin))
}
