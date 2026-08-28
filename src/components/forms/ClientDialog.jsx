import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { addClient, updateClient } from '../../lib/store'
import { CLIENT_STATUSES } from '../../lib/seed'

const EMPTY = {
  name: '', company: '', contactPerson: '', phone: '', whatsapp: '', email: '',
  address: '', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '',
  gstin: '', pan: '', status: 'Active', notes: '',
}

export default function ClientDialog({ open, onOpenChange, client, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const editing = !!client

  // Reload the form whenever the dialog opens, or swaps to a different client.
  // Done during render rather than in an effect so the dialog never shows the
  // previous client's details for a frame.
  const formKey = open ? client?.id || 'new' : null
  const [loadedKey, setLoadedKey] = useState(formKey)
  if (formKey !== loadedKey) {
    setLoadedKey(formKey)
    if (open) setForm(client ? { ...EMPTY, ...client } : EMPTY)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = { ...form, whatsapp: form.whatsapp || form.phone }
    const saved = editing ? (updateClient(client.id, payload) || { ...client, ...payload }) : addClient(payload)
    onSaved?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${client.name}` : 'Add a client'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the contact and billing details.' : 'Everything except the name can be filled in later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client name" required>
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Ramesh Kumar" />
            </Field>
            <Field label="Company / site name">
              <Input value={form.company} onChange={set('company')} placeholder="e.g. Kulathur Farm Estate" />
            </Field>
            <Field label="Contact person">
              <Input value={form.contactPerson} onChange={set('contactPerson')} />
            </Field>
            <Field label="Status">
              <SimpleSelect value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))} options={CLIENT_STATUSES} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} placeholder="+91 98430 11221" />
            </Field>
            <Field label="WhatsApp" hint="Defaults to the phone number">
              <Input value={form.whatsapp} onChange={set('whatsapp')} />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.address} onChange={set('address')} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Pincode">
              <Input value={form.pincode} onChange={set('pincode')} />
            </Field>
            <Field label="GSTIN">
              <Input value={form.gstin} onChange={set('gstin')} placeholder="33AAGCS9021K1ZP" className="uppercase" />
            </Field>
            <Field label="PAN">
              <Input value={form.pan} onChange={set('pan')} className="uppercase" />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Anything worth remembering about this client" />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save changes' : 'Add client'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
