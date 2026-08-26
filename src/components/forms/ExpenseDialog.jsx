import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { addExpense, updateExpense } from '../../lib/store'
import { useStore } from '../../lib/useStore'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/seed'
import { todayISO } from '../../lib/format'
import { NONE, toSel, fromSel } from '../../lib/utils'

const EMPTY = {
  projectId: '', date: todayISO(), category: 'Material', description: '',
  vendor: '', amount: 0, paymentMethod: 'Cash', notes: '',
}

export default function ExpenseDialog({ open, onOpenChange, expense, defaults = {}, onSaved }) {
  const db = useStore()
  const [form, setForm] = useState(EMPTY)
  const editing = !!expense

  useEffect(() => {
    if (open) setForm(expense ? { ...EMPTY, ...expense } : { ...EMPTY, ...defaults })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: fromSel(v) }))

  const projectOptions = [
    { value: NONE, label: 'General / overhead' },
    ...db.projects.map((p) => ({ value: p.id, label: p.name })),
  ]

  const submit = (e) => {
    e.preventDefault()
    if (!form.description.trim() || !Number(form.amount)) return
    const payload = { ...form, amount: Number(form.amount) }
    const saved = editing ? (updateExpense(expense.id, payload) || { ...expense, ...payload }) : addExpense(payload)
    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit expense' : 'Record an expense'}</DialogTitle>
          <DialogDescription>Site expenses feed straight into project profit and the accounts view.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description" required className="sm:col-span-2">
              <Input value={form.description} onChange={set('description')} required placeholder="e.g. UltraTech cement — 120 bags" />
            </Field>
            <Field label="Project">
              <SimpleSelect value={toSel(form.projectId)} onValueChange={pick('projectId')} options={projectOptions} />
            </Field>
            <Field label="Category">
              <SimpleSelect value={form.category} onValueChange={pick('category')} options={EXPENSE_CATEGORIES} />
            </Field>
            <Field label="Vendor">
              <Input value={form.vendor} onChange={set('vendor')} />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label="Amount (₹)" required>
              <Input type="number" value={form.amount} onChange={set('amount')} required className="text-right tabular-nums" />
            </Field>
            <Field label="Paid by">
              <SimpleSelect value={form.paymentMethod} onValueChange={pick('paymentMethod')} options={PAYMENT_METHODS} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={set('notes')} rows={2} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save changes' : 'Record expense'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
