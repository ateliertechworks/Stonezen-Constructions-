import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import AuthShell from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Field } from '../../components/ui/label'
import { resetPasswordWithCode } from '../../lib/auth'

/**
 * Reset is a single step against the recovery code issued in Settings.
 *
 * The earlier build issued a code and printed it on this screen, which meant
 * the page handed out the very secret it was checking. The code now has to
 * come from outside the app.
 */
export default function ForgotPassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', code: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    const res = await resetPasswordWithCode(form.email, form.code, form.password)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the recovery code for this account."
      aside={
        <p className="glass-note rounded-xl border border-white/25 bg-white/[0.12] px-3 py-2 text-center text-[11.5px] text-slate-500 backdrop-blur-[10px] lg:rounded-lg lg:border-0 lg:bg-slate-50 lg:backdrop-blur-none">
          Recovery codes are issued from Settings → Security while signed in.
        </p>
      }
      footer={
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
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
          <Input type="email" value={form.email} onChange={set('email')} required autoComplete="username" />
        </Field>
        <Field label="Recovery code">
          <Input
            value={form.code}
            onChange={set('code')}
            required
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            className="uppercase tracking-[0.12em]"
          />
        </Field>
        <Field label="New password">
          <Input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <ShieldCheck aria-hidden="true" /> {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}
