import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in'

export interface AuthResult {
  error: string | null
}

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  session: Session | null
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult & { needsConfirmation: boolean }>
  signInWithOtp: (email: string) => Promise<AuthResult>
  signInWithGoogle: (from: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const msg = (error: AuthError | null): string | null => (error ? error.message : null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'disabled')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Accounts are not configured.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: msg(error) }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Accounts are not configured.', needsConfirmation: false }
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { error: msg(error), needsConfirmation: !error && !data.session }
  }, [])

  const signInWithOtp = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Accounts are not configured.' }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: msg(error) }
  }, [])

  const signInWithGoogle = useCallback(async (from: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Accounts are not configured.' }
    const path = from.startsWith('/') ? from : '/'
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + path, skipBrowserRedirect: true },
    })
    if (error) return { error: msg(error) }
    if (data.url) {
      try {
        window.location.assign(data.url)
      } catch {
        // jsdom cannot navigate externally; tests assert the recorded OAuth call instead.
      }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, user: session?.user ?? null, signInWithPassword, signUp, signInWithOtp, signInWithGoogle, signOut }),
    [status, session, signInWithPassword, signUp, signInWithOtp, signInWithGoogle, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
