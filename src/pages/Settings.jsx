import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon, Building2, Landmark, FileText, Database,
  Upload, Trash2, Save, RotateCcw, Download, LogOut, User, ShieldCheck,
  KeyRound, Copy, AlertTriangle,
} from 'lucide-react'

import { useStore } from '../lib/useStore'
import { updateSettings, clearData, exportData, importData } from '../lib/store'
import {
  getSession, logout, updateProfile, changePassword, generateRecoveryCode,
  hasRecoveryCode, bootstrap, setRegistrationOpen,
} from '../lib/auth'
import { download, cn } from '../lib/utils'

import PageHeader from '../components/ui/PageHeader'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Field } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function Settings() {
  const db = useStore()
  const navigate = useNavigate()
  const session = getSession()
  const fileRef = useRef(null)
  const logoRef = useRef(null)

  const [company, setCompany] = useState(db.settings.company)
  const [banking, setBanking] = useState(db.settings.banking)
  const [docs, setDocs] = useState(db.settings.docs)
  const [profile, setProfile] = useState({ name: session?.name || '', email: session?.email || '' })
  const [savedFlag, setSavedFlag] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // Security tab
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState(null)
  const [recovery, setRecovery] = useState(null)
  // Both are the server's answer, so they load in rather than being read
  // synchronously from this browser.
  const [regOpen, setRegOpen] = useState(false)
  const [hasCode, setHasCode] = useState(false)

  useEffect(() => {
    let cancelled = false
    bootstrap().then((b) => !cancelled && setRegOpen(b.registrationOpen === true))
    hasRecoveryCode().then((v) => !cancelled && setHasCode(v))
    return () => { cancelled = true }
  }, [])

  const submitPassword = async (e) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: 'The two passwords do not match.' })
    const res = await changePassword(pw.current, pw.next)
    if (!res.ok) return setPwMsg({ ok: false, text: res.error })
    setPw({ current: '', next: '', confirm: '' })
    setPwMsg({ ok: true, text: 'Password updated.' })
  }

  const issueRecoveryCode = async () => {
    const res = await generateRecoveryCode()
    if (res.ok) {
      setRecovery(res.code)
      setHasCode(true)
    }
  }

  const toggleRegistration = async (next) => {
    // Only reflect the switch once the server has accepted it, so a failed
    // write cannot leave the UI claiming registration is open when it is not.
    const res = await setRegistrationOpen(next)
    if (res.ok) setRegOpen(next)
    else flash(res.error || 'Could not change that setting')
  }

  const flash = (msg) => {
    setSavedFlag(msg)
    setTimeout(() => setSavedFlag(''), 2200)
  }

  const saveCompany = () => {
    updateSettings({ company })
    flash('Company details saved')
  }
  const saveBanking = () => {
    updateSettings({ banking })
    flash('Banking details saved')
  }
  const saveDocs = () => {
    updateSettings({ docs })
    flash('Document defaults saved')
  }
  const saveProfile = async () => {
    const res = await updateProfile(profile)
    flash(res.ok ? 'Profile updated' : res.error || 'Could not update profile')
  }

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) {
      flash('Logo must be under 500 KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCompany((c) => ({ ...c, logo: reader.result }))
    reader.readAsDataURL(file)
  }

  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importData(reader.result)
        flash('Data imported')
      } catch {
        flash('That file could not be read')
      }
    }
    reader.readAsText(file)
  }

  const set = (setter) => (k) => (e) => setter((s) => ({ ...s, [k]: e.target.value }))
  const setC = set(setCompany)
  const setB = set(setBanking)
  const setD = set(setDocs)

  return (
    <div>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Company profile, banking details, document defaults and data"
        actions={
          savedFlag && (
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700">
              {savedFlag}
            </span>
          )
        }
      />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 className="h-3.5 w-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="banking"><Landmark className="h-3.5 w-3.5" /> Banking</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5" /> Documents</TabsTrigger>
          <TabsTrigger value="account"><User className="h-3.5 w-3.5" /> Account</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-3.5 w-3.5" /> Data</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- company */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Company profile</CardTitle>
                <p className="text-[11.5px] text-slate-400">These details appear on every quotation and invoice.</p>
              </div>
              <Button size="sm" onClick={saveCompany}>
                <Save /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                {company.logo ? (
                  <img src={company.logo} alt="Company logo" className="h-16 w-16 rounded-xl border border-slate-200 object-contain" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand text-2xl font-extrabold tracking-tighter text-white">
                    SZ
                  </div>
                )}
                <div className="flex gap-2">
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  <Button size="sm" variant="outline" onClick={() => logoRef.current?.click()}>
                    <Upload /> Upload logo
                  </Button>
                  {company.logo && (
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setCompany((c) => ({ ...c, logo: '' }))}>
                      <Trash2 /> Remove
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company name">
                  <Input value={company.name} onChange={setC('name')} />
                </Field>
                <Field label="Tagline">
                  <Input value={company.tagline} onChange={setC('tagline')} />
                </Field>
                <Field label="Proprietor / CEO name">
                  <Input value={company.ceo} onChange={setC('ceo')} />
                </Field>
                <Field label="Designation line">
                  <Input value={company.designation} onChange={setC('designation')} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Textarea value={company.address} onChange={setC('address')} rows={2} />
                </Field>
                <Field label="Phone">
                  <Input value={company.phone} onChange={setC('phone')} />
                </Field>
                <Field label="Email">
                  <Input value={company.email} onChange={setC('email')} />
                </Field>
                <Field label="GSTIN">
                  <Input value={company.gstin} onChange={setC('gstin')} className="uppercase" />
                </Field>
                <Field label="Website">
                  <Input value={company.website} onChange={setC('website')} placeholder="stonezen.in" />
                </Field>
                <Field label="State">
                  <Input value={company.state} onChange={setC('state')} />
                </Field>
                <Field label="State code" hint="Used to decide CGST+SGST vs IGST">
                  <Input value={company.stateCode} onChange={setC('stateCode')} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------- banking */}
        <TabsContent value="banking">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Banking details</CardTitle>
                <p className="text-[11.5px] text-slate-400">Printed in the invoice footer so clients can pay directly.</p>
              </div>
              <Button size="sm" onClick={saveBanking}>
                <Save /> Save
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank name">
                <Input value={banking.bankName} onChange={setB('bankName')} />
              </Field>
              <Field label="Branch">
                <Input value={banking.branch} onChange={setB('branch')} />
              </Field>
              <Field label="Account number">
                <Input value={banking.accountNumber} onChange={setB('accountNumber')} className="tabular-nums" />
              </Field>
              <Field label="IFSC">
                <Input value={banking.ifsc} onChange={setB('ifsc')} className="uppercase" />
              </Field>
              <Field label="UPI / VPA" className="sm:col-span-2">
                <Input value={banking.upi} onChange={setB('upi')} placeholder="919597912002@federal" />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------- documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Document defaults</CardTitle>
                <p className="text-[11.5px] text-slate-400">Numbering prefixes and the defaults new documents start with.</p>
              </div>
              <Button size="sm" onClick={saveDocs}>
                <Save /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Numbering prefixes</p>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['quotationPrefix', 'Quotation'],
                    ['invoicePrefix', 'Invoice'],
                    ['paymentPrefix', 'Payment'],
                    ['expensePrefix', 'Expense'],
                    ['clientPrefix', 'Client'],
                    ['projectPrefix', 'Project'],
                  ].map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Input value={docs[key]} onChange={setD(key)} className="uppercase" />
                    </Field>
                  ))}
                </div>
                <p className="mt-1.5 text-[11.5px] text-slate-400">
                  Documents are numbered <code className="rounded bg-slate-100 px-1">PREFIX-YEAR-001</code> — next quotation will be{' '}
                  <strong>{docs.quotationPrefix}-{new Date().getFullYear()}-{String((db.counters.quotation || 0) + 1).padStart(3, '0')}</strong>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Default GST rate (%)">
                  <Input type="number" value={docs.defaultGst} onChange={setD('defaultGst')} className="text-right tabular-nums" />
                </Field>
                <Field label="Quotation validity (days)">
                  <Input type="number" value={docs.defaultValidityDays} onChange={setD('defaultValidityDays')} className="text-right tabular-nums" />
                </Field>
                <Field label="Default payment terms" className="sm:col-span-2">
                  <Textarea value={docs.defaultPaymentTerms} onChange={setD('defaultPaymentTerms')} rows={2} />
                </Field>
                <Field label="Default quotation terms" className="sm:col-span-2">
                  <Textarea value={docs.defaultTerms} onChange={setD('defaultTerms')} rows={5} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------- account */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <Button size="sm" onClick={saveProfile}>
                <Save /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                </Field>
                <Field label="Email" hint="Used to sign in">
                  <Input value={profile.email} disabled />
                </Field>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    logout()
                    navigate('/login', { replace: true })
                  }}
                >
                  <LogOut /> Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* ------------------------------------------------------ security */}
        <TabsContent value="security">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitPassword} className="space-y-3">
                  {pwMsg && (
                    <div
                      role="status"
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[13px]',
                        pwMsg.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700',
                      )}
                    >
                      {pwMsg.text}
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Current password">
                      <Input
                        type="password" autoComplete="current-password" required
                        value={pw.current} onChange={(e) => setPw((v) => ({ ...v, current: e.target.value }))}
                      />
                    </Field>
                    <Field label="New password" hint="At least 8 characters">
                      <Input
                        type="password" autoComplete="new-password" required
                        value={pw.next} onChange={(e) => setPw((v) => ({ ...v, next: e.target.value }))}
                      />
                    </Field>
                    <Field label="Confirm new password">
                      <Input
                        type="password" autoComplete="new-password" required
                        value={pw.confirm} onChange={(e) => setPw((v) => ({ ...v, confirm: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Button type="submit" size="sm"><KeyRound /> Update password</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recovery code</CardTitle>
                <Button size="sm" variant="outline" onClick={issueRecoveryCode}>
                  <RotateCcw /> {hasCode ? 'Generate new code' : 'Generate code'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[13px] text-slate-600">
                  This is the only way to reset a forgotten password. Only a hash of the code
                  is stored, so it cannot be read back later — write it down and keep it safe.
                  Generating a new code replaces the old one.
                </p>
                {recovery ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Copy this now. It will not be shown again.
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-[15px] font-bold tracking-[0.16em] text-slate-800">
                        {recovery}
                      </code>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => navigator.clipboard?.writeText(recovery)}
                      >
                        <Copy /> Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] font-semibold text-slate-500">
                    {hasCode
                      ? 'A recovery code is set for this account.'
                      : 'No recovery code set — you will not be able to reset a forgotten password.'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>New accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[13px] text-slate-600">
                  When this is off, the sign-up page is closed and only you can add people.
                  Leave it off unless you are actively inviting a colleague.
                </p>
                <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={regOpen}
                    onChange={(e) => toggleRegistration(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus-visible:ring-2 focus-visible:ring-brand/40"
                  />
                  Allow anyone to create an account
                </label>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- data */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Data</CardTitle>
                <p className="text-[11.5px] text-slate-400">
                  Everything is stored in this browser. Export regularly to keep a backup.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {[
                  ['Clients', db.clients.length],
                  ['Projects', db.projects.length],
                  ['Quotations', db.quotations.length],
                  ['Invoices', db.invoices.length],
                  ['Payments', db.payments.length],
                  ['Expenses', db.expenses.length],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="text-lg font-bold tabular-nums text-slate-800">{count}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button variant="outline" onClick={() => download(`stonezen-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData(), 'application/json')}>
                  <Download /> Export backup
                </Button>
                <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload /> Import backup
                </Button>
                <Button variant="outline" className="text-red-600" onClick={() => setConfirmClear(true)}>
                  <Trash2 /> Clear all data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all data?"
        description="Every client, project, quotation, invoice, payment and expense will be deleted. Your company settings are kept."
        confirmLabel="Delete everything"
        onConfirm={() => {
          clearData()
          flash('All data cleared')
        }}
      />
    </div>
  )
}
