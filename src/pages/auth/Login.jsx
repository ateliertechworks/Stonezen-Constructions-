import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, LogIn } from 'lucide-react'
import AuthShell from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Field } from '../../components/ui/label'
import { login, bootstrap } from '../../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  // The demo credentials are a development convenience; a deployed build must
  // not ship a working password in its own login form.
  const demo = import.meta.env.DEV
  // Whether an owner account exists is the server's answer now, not this
  // browser's, so it arrives after the first render rather than during it.
  const [firstRun, setFirstRun] = useState(false)
  const [offline, setOffline] = useState(false)
  const [email, setEmail] = useState(demo ? 'stonezenconstructions@gmail.com' : '')
  const [password, setPassword] = useState(demo ? 'stonezen' : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    bootstrap().then((b) => {
      if (cancelled) return
      setFirstRun(b.needsFirstRunSetup === true)
      setOffline(b.unreachable === true)
    })
    return () => { cancelled = true }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    navigate(location.state?.from || '/', { replace: true })
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      aside={
        <p className="glass-note rounded-xl border border-white/25 bg-white/[0.12] px-3 py-2 text-center text-[11.5px] text-slate-500 backdrop-blur-[10px] lg:rounded-lg lg:border-0 lg:bg-slate-50 lg:backdrop-blur-none">
          {offline
            ? 'Cannot reach the Stonezen server. Check your connection and try again.'
            : firstRun
              ? 'No account exists yet — create the owner account to begin.'
              : 'Your data is stored on the Stonezen server and shared across your devices.'}
        </p>
      }
      footer={
        <>
          {firstRun ? 'New install?' : "Don't have an account?"}{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            {firstRun ? 'Create the owner account' : 'Create one'}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        <Field label="Email address">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[12.5px] font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <LogIn /> Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
