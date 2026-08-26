import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { addPayment, updatePayment } from '../../lib/store'
import { useStore } from '../../lib/useStore'
import { PAYMENT_METHODS } from '../../lib/seed'
import { invoiceBalance, invoiceTotals } from '../../lib/calc'
import { formatINR, todayISO } from '../../lib/format'
import { NONE, toSel, fromSel } from '../../lib/utils'

const EMPTY = {
  clientId: '', projectId: '', invoiceId: '', date: todayISO(),
  amount: 0, method: 'Bank Transfer', reference: '', notes: '', type: 'Received',
}

export default function PaymentDialog({ open, onOpenChange, payment, defaults = {}, onSaved }) {
  const db = useStore()
  const [form, setForm] = useState(EMPTY)
  const editing = !!payment

  useEffect(() => {
    if (open) setForm(payment ? { ...EMPTY, ...payment } : { ...EMPTY, ...defaults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: fromSel(v) }))

  const clientOptions = db.clients.map((c) => ({ value: c.id, label: c.company || c.name }))
  const invoiceOptions = [
    { value: NONE, label: 'Not against an invoice' },
    ...db.invoices
      .filter((i) => !form.clientId || i.clientId === form.clientId)
      .map((i) => ({ value: i.id, label: `${i.id} — ${formatINR(invoiceTotals(i).grandTotal)}` })),
  ]
  const projectOptions = [
    { value: NONE, label: 'No project' },
    ...db.projects.filter((p) => !form.clientId || p.clientId === form.clientId).map((p) => ({ value: p.id, label: p.name })),
  ]

  const linkedInvoice = db.invoices.find((i) => i.id === form.invoiceId)
  const balance = linkedInvoice ? invoiceBalance(db, linkedInvoice) : null

  /** Selecting an invoice pulls its client/project so the row is never orphaned. */
  const onInvoiceChange = (v) => {
    const id = fromSel(v)
    const inv = db.invoices.find((i) => i.id === id)
    setForm((f) => ({
      ...f,
      invoiceId: id,
      clientId: inv?.clientId || f.clientId,
      projectId: inv?.projectId || f.projectId,
    }))
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.clientId || !Number(form.amount)) return
    const payload = { ...form, amount: Number(form.amount) }
    const saved = editing ? (updatePayment(payment.id, payload) || { ...payment, ...payload }) : addPayment(payload)
    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit payment' : 'Record a payment'}</DialogTitle>
          <DialogDescription>Payments update invoice balances and client ledgers automatically.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" required>
              <SimpleSelect value={form.clientId || undefined} onValueChange={pick('clientId')} options={clientOptions} placeholder="Select client" />
            </Field>
            <Field label="Against invoice">
              <SimpleSelect value={toSel(form.invoiceId)} onValueChange={onInvoiceChange} options={invoiceOptions} />
            </Field>
            <Field label="Project">
              <SimpleSelect value={toSel(form.projectId)} onValueChange={pick('projectId')} options={projectOptions} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label="Amount (₹)" required hint={balance !== null ? `Balance on ${form.invoiceId}: ${formatINR(balance)}` : undefined}>
              <Input type="number" value={form.amount} onChange={set('amount')} required className="text-right tabular-nums" />
            </Field>
            <Field label="Method">
              <SimpleSelect value={form.method} onValueChange={pick('method')} options={PAYMENT_METHODS} />
            </Field>
            <Field label="Reference" className="sm:col-span-2" hint="UTR, cheque number or UPI reference">
              <Input value={form.reference} onChange={set('reference')} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="e.g. After plinth beam completion" />
            </Field>
          </div>

          {balance !== null && Number(form.amount) > balance && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              This is more than the outstanding balance of {formatINR(balance)} on {form.invoiceId} — the invoice will show as overpaid.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save changes' : 'Record payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
