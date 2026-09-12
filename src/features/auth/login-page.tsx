import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Mode = 'sign-in' | 'sign-up'

export function LoginPage() {
  const { status, signInWithPassword, signUp, signInWithOtp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (status === 'signed-in') return <Navigate to={from} replace />

  if (status === 'disabled') {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Accounts are not configured</CardTitle>
          <CardDescription>
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable sign-in. Your watchlist
            stays in this browser meanwhile.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'sign-in') {
        const result = await signInWithPassword(email, password)
        if (result.error) setError(result.error)
        else navigate(from, { replace: true })
      } else {
        const result = await signUp(email, password)
        if (result.error) setError(result.error)
        else if (result.needsConfirmation) setNotice('Check your email to confirm the account, then sign in.')
        else navigate(from, { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await signInWithGoogle(from)
      if (result.error) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  const magicLink = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await signInWithOtp(email)
      if (result.error) setError(result.error)
      else setNotice(`Magic link sent to ${email}. Open it on this device.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</CardTitle>
        <CardDescription>Sync your watchlist and dashboard across devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" aria-label={mode === 'sign-in' ? 'Sign in' : 'Create account'}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              {notice}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Button>
            <Button type="button" variant="ghost" disabled={busy || !email} onClick={magicLink}>
              Email me a magic link
            </Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          {mode === 'sign-in' ? 'No account yet? ' : 'Already have an account? '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
              setError(null)
              setNotice(null)
            }}
          >
            {mode === 'sign-in' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </CardContent>
    </Card>
  )
}
