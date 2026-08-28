import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { addProject, updateProject } from '../../lib/store'
import { useStore } from '../../lib/useStore'
import { PROJECT_STATUSES } from '../../lib/seed'
import { NONE, toSel, fromSel } from '../../lib/utils'

const EMPTY = {
  clientId: '', name: '', siteAddress: '', startDate: '', expectedCompletion: '',
  actualCompletion: '', value: 0, manager: '', status: 'Planning', notes: '',
  quotationId: '', invoiceId: '',
}

export default function ProjectDialog({ open, onOpenChange, project, defaultClientId, onSaved }) {
  const db = useStore()
  const [form, setForm] = useState(EMPTY)
  const editing = !!project

  // Reload the form whenever the dialog opens, or swaps to a different project.
  // Done during render rather than in an effect so the dialog never shows the
  // previous project's details for a frame.
  const formKey = open ? `${project?.id || 'new'}:${defaultClientId || ''}` : null
  const [loadedKey, setLoadedKey] = useState(formKey)
  if (formKey !== loadedKey) {
    setLoadedKey(formKey)
    if (open) setForm(project ? { ...EMPTY, ...project } : { ...EMPTY, clientId: defaultClientId || '' })
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: fromSel(v) }))

  const clientOptions = db.clients.map((c) => ({ value: c.id, label: c.company || c.name }))
  const quoteOptions = [
    { value: NONE, label: 'Not linked' },
    ...db.quotations
      .filter((q) => !form.clientId || q.clientId === form.clientId)
      .map((q) => ({ value: q.id, label: `${q.id} — ${q.title?.slice(0, 40) || 'Untitled'}` })),
  ]

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.clientId) return
    const payload = { ...form, value: Number(form.value || 0) }
    const saved = editing ? (updateProject(project.id, payload) || { ...project, ...payload }) : addProject(payload)
    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${project.name}` : 'Add a project'}</DialogTitle>
          <DialogDescription>Projects tie quotations, invoices, payments and site expenses together.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project name" required className="sm:col-span-2">
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Kulathur Farm Compound Wall" />
            </Field>
            <Field label="Client" required>
              <SimpleSelect value={form.clientId || undefined} onValueChange={pick('clientId')} options={clientOptions} placeholder="Select client" />
            </Field>
            <Field label="Status">
              <SimpleSelect value={form.status} onValueChange={pick('status')} options={PROJECT_STATUSES} />
            </Field>
            <Field label="Site address" className="sm:col-span-2">
              <Input value={form.siteAddress} onChange={set('siteAddress')} />
            </Field>
            <Field label="Start date">
              <Input type="date" value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Expected completion">
              <Input type="date" value={form.expectedCompletion} onChange={set('expectedCompletion')} />
            </Field>
            <Field label="Actual completion">
              <Input type="date" value={form.actualCompletion} onChange={set('actualCompletion')} />
            </Field>
            <Field label="Project value (₹)">
              <Input type="number" value={form.value} onChange={set('value')} className="text-right tabular-nums" />
            </Field>
            <Field label="Site in-charge">
              <Input value={form.manager} onChange={set('manager')} />
            </Field>
            <Field label="Linked quotation">
              <SimpleSelect value={toSel(form.quotationId)} onValueChange={pick('quotationId')} options={quoteOptions} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={set('notes')} rows={2} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save changes' : 'Add project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
