import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, UserPlus } from 'lucide-react'
import AuthShell from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Field } from '../../components/ui/label'
import { register } from '../../lib/auth'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    const res = await register(form)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    navigate('/', { replace: true })
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a login for this device."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label="Full name">
          <Input value={form.name} onChange={set('name')} required placeholder="e.g. K. Selvaraj" />
        </Field>
        <Field label="Email address">
          <Input type="email" value={form.email} onChange={set('email')} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password">
            <Input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <UserPlus /> Create account
        </Button>
      </form>
    </AuthShell>
  )
}
