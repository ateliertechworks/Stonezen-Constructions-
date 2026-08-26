import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import AuthShell from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Field } from '../../components/ui/label'
import { resetPassword } from '../../lib/auth'

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [token, setToken] = useState(location.state?.token || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    const res = resetPassword(token, password)
    if (!res.ok) return setError(res.error)
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Enter the reset code you were issued."
      footer={
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label="Reset code">
          <Input value={token} onChange={(e) => setToken(e.target.value)} required className="tracking-[0.25em] uppercase" />
        </Field>
        <Field label="New password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          <ShieldCheck /> Update password
        </Button>
      </form>
    </AuthShell>
  )
}
