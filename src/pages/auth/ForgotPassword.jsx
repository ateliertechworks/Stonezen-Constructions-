import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react'
import AuthShell from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Field } from '../../components/ui/label'
import { requestReset } from '../../lib/auth'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const res = requestReset(email)
    if (!res.ok) return setError(res.error)
    setError('')
    setIssued(res)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll issue a reset code for this account."
      footer={
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      {issued ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Reset code issued for <strong>{issued.email}</strong>.
              <div className="mt-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-center text-lg font-bold tracking-[0.25em] text-emerald-700">
                {issued.token}
              </div>
              <p className="mt-2 text-[11.5px] text-emerald-700">
                This build has no mail server, so the code is shown here directly.
              </p>
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={() => navigate('/reset-password', { state: { token: issued.token } })}>
            Continue to reset
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <Field label="Email address">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            <KeyRound /> Send reset code
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
