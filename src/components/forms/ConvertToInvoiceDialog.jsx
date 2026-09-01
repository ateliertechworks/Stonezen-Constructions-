import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RotateCcw, ReceiptIndianRupee } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { SwitchRow } from '../ui/switch'

import { useStore } from '../../lib/useStore'
import { invoiceDraftFromQuotation, createInvoiceFromQuotation } from '../../lib/store'
import { invoiceTotals } from '../../lib/calc'
import { formatINR, todayISO, addDaysISO } from '../../lib/format'
import { UNITS } from '../../lib/seed'
import { defaultBlocks, makeBlock } from '../docs/blocks'

/** Matches `blankInvoice` in the store — an invoice is due 15 days out. */
const DUE_DAYS = 15

const blankItem = () => ({ description: '', unit: 'Sqft', quantity: 0, rate: 0, amount: 0 })

const lineAmount = (it) => Math.round(Number(it.quantity || 0) * Number(it.rate || 0) * 100) / 100

/**
 * Asks what should go on the invoice before creating it.
 *
 * Converting used to fire straight into a saved draft invoice, which meant the
 * common case — the same work plus a few extras agreed on site after the
 * quotation went out — was "create, then hunt for the edit screen". Everything
 * carried across is shown here and can be changed, and extra lines can be added
 * before anything is written, so no half-right invoice is ever numbered.
 */
export default function ConvertToInvoiceDialog({ open, onOpenChange, quotation, onCreated }) {
  const db = useStore()
  const [items, setItems] = useState([])
  const [extras, setExtras] = useState([])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !quotation) return
    const draft = invoiceDraftFromQuotation(quotation, db)
    setItems(draft.items)
    setExtras([])
    setForm({
      date: todayISO(),
      dueDate: addDaysISO(todayISO(), DUE_DAYS),
      gstEnabled: draft.gstEnabled,
      gst: draft.gst,
      gstType: draft.gstType,
      discount: draft.discount,
      additionalCharges: draft.additionalCharges,
      // Both, not just the flag: `invoiceTotals` reads `roundOff` whenever
      // `autoRoundOff` is false, so omitting either made the preview total and
      // the saved total disagree by up to a rupee.
      autoRoundOff: draft.autoRoundOff,
      roundOff: draft.roundOff,
      notes: draft.notes,
      paymentTerms: db.settings.docs?.defaultPaymentTerms || '',
      carryPaymentSchedule: (quotation.paymentSchedule || []).length > 0,
    })
    setSaving(false)
    // Re-reading the store on every keystroke elsewhere would reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quotation?.id])

  // `items` and `extras` are one list for pricing but two for the UI: the
  // carried rows are read-only reassurance, the extras are the point of the
  // dialog. Amounts are recomputed here so a typed rate is never trusted.
  const allItems = useMemo(
    () =>
      [...items, ...extras]
        .filter((it) => String(it.description || '').trim() || lineAmount(it) > 0)
        .map((it, i) => ({ ...it, sno: i + 1, amount: lineAmount(it) })),
    [items, extras],
  )

  const totals = useMemo(
    () => invoiceTotals({ ...(form || {}), items: allItems }),
    [form, allItems],
  )

  if (!quotation || !form) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === '' ? 0 : Number(e.target.value) }))
  const toggle = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const patchExtra = (i, patch) =>
    setExtras((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const dropCarried = (i) => setItems((rows) => rows.filter((_, idx) => idx !== i))
  const restoreCarried = () => setItems(invoiceDraftFromQuotation(quotation, db).items)

  /** Invoice layout with the milestone table slotted in ahead of the terms. */
  const blocksWithSchedule = () => {
    const blocks = defaultBlocks('invoice')
    const at = blocks.findIndex((b) => b.type === 'terms')
    const schedule = makeBlock('payment_schedule')
    return at === -1 ? [...blocks, schedule] : [...blocks.slice(0, at), schedule, ...blocks.slice(at)]
  }

  const submit = (e) => {
    e.preventDefault()
    if (saving || allItems.length === 0) return
    setSaving(true)
    const inv = createInvoiceFromQuotation(quotation, {
      items: allItems,
      date: form.date,
      dueDate: form.dueDate,
      gstEnabled: form.gstEnabled,
      gst: Number(form.gst) || 0,
      gstType: form.gstType,
      discount: Number(form.discount) || 0,
      additionalCharges: Number(form.additionalCharges) || 0,
      autoRoundOff: form.autoRoundOff,
      roundOff: form.autoRoundOff ? 0 : Number(form.roundOff) || 0,
      notes: form.notes,
      paymentTerms: form.paymentTerms,
      // An invoice's default layout has no payment-schedule block, so carrying
      // the milestones across means adding the block too — otherwise the data
      // would be stored and never printed.
      ...(form.carryPaymentSchedule && (quotation.paymentSchedule || []).length
        ? { paymentSchedule: quotation.paymentSchedule, blocks: blocksWithSchedule() }
        : {}),
    })
    onOpenChange(false)
    onCreated?.(inv)
  }

  const carriedDropped = items.length < (quotation.items || []).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convert {quotation.id} to an invoice</DialogTitle>
          <DialogDescription>
            Everything below is carried over from the quotation. Add anything extra agreed since,
            then create the invoice — nothing is saved until you do.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* ------------------------------------------------ carried items */}
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                From the quotation ({items.length})
              </h3>
              {carriedDropped && (
                <Button type="button" size="xs" variant="ghost" onClick={restoreCarried}>
                  <RotateCcw /> Restore removed
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12.5px] text-slate-400">
                No quotation lines kept — the invoice will bill only what you add below.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {items.map((it, i) => (
                  <li key={`carried-${i}`} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="w-4 shrink-0 text-[11px] font-bold text-slate-300">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-800">
                        {it.description || <em className="text-slate-400">Untitled line</em>}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {it.quantity} {it.unit} × {formatINR(it.rate)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-800">
                      {formatINR(it.amount)}
                    </span>
                    <Button
                      type="button" size="iconSm" variant="ghost"
                      className="shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="Do not bill this line"
                      onClick={() => dropCarried(i)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* -------------------------------------------------- extra items */}
          <section>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Add to this invoice
            </h3>

            <div className="space-y-2">
              {extras.map((it, i) => (
                <div key={`extra-${i}`} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={it.description}
                      onChange={(e) => patchExtra(i, { description: e.target.value })}
                      placeholder="Extra work — e.g. additional granite skirting on first floor"
                      rows={2}
                      className="min-h-[52px] flex-1 bg-white text-[13px]"
                      aria-label={`Extra line ${i + 1} description`}
                    />
                    <Button
                      type="button" size="iconSm" variant="ghost"
                      className="shrink-0 text-red-500 hover:bg-red-50"
                      title="Remove this line"
                      onClick={() => setExtras((rows) => rows.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Unit</span>
                      <SimpleSelect value={it.unit || 'Sqft'} onValueChange={(v) => patchExtra(i, { unit: v })} options={UNITS} />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Qty</span>
                      <Input
                        type="number" inputMode="decimal" value={it.quantity ?? 0}
                        onChange={(e) => patchExtra(i, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                        className="bg-white text-right tabular-nums"
                      />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rate</span>
                      <Input
                        type="number" inputMode="decimal" value={it.rate ?? 0}
                        onChange={(e) => patchExtra(i, { rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                        className="bg-white text-right tabular-nums"
                      />
                    </label>
                    <div>
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Amount</span>
                      <div className="flex h-9 items-center justify-end rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold tabular-nums text-slate-800">
                        {formatINR(lineAmount(it))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button" variant="outline" size="sm" className="mt-2"
              onClick={() => setExtras((rows) => [...rows, blankItem()])}
            >
              <Plus /> Add extra item
            </Button>
          </section>

          {/* ------------------------------------------------------ details */}
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Invoice date">
              <Input type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label="Payment due by">
              <Input type="date" value={form.dueDate} onChange={set('dueDate')} min={form.date} />
            </Field>
            <Field label="Discount (%)">
              <Input type="number" inputMode="decimal" value={form.discount} onChange={setNum('discount')} className="text-right tabular-nums" />
            </Field>
            <Field label="Additional charges (₹)">
              <Input type="number" inputMode="decimal" value={form.additionalCharges} onChange={setNum('additionalCharges')} className="text-right tabular-nums" />
            </Field>
          </section>

          <section className="rounded-lg border border-slate-200 px-3 py-1.5">
            <SwitchRow
              label="Charge GST"
              hint={form.gstEnabled ? `${form.gst}% ${form.gstType === 'inter' ? 'IGST' : 'CGST + SGST'}` : 'No tax applied'}
              checked={form.gstEnabled}
              onCheckedChange={toggle('gstEnabled')}
            />
            {form.gstEnabled && (
              <div className="grid gap-3 pb-2 sm:grid-cols-2">
                <Field label="GST rate (%)">
                  <Input type="number" inputMode="decimal" value={form.gst} onChange={setNum('gst')} className="text-right tabular-nums" />
                </Field>
                <Field label="Supply type">
                  <SimpleSelect
                    value={form.gstType}
                    onValueChange={toggle('gstType')}
                    options={[
                      { value: 'intra', label: 'Within state (CGST + SGST)' },
                      { value: 'inter', label: 'Other state (IGST)' },
                    ]}
                  />
                </Field>
              </div>
            )}
            <SwitchRow
              label="Round off to the nearest rupee"
              hint={form.autoRoundOff ? 'Paise are absorbed into the total' : `Adjusting by ${formatINR(form.roundOff, true)}`}
              checked={form.autoRoundOff}
              onCheckedChange={toggle('autoRoundOff')}
            />
            {(quotation.paymentSchedule || []).length > 0 && (
              <SwitchRow
                label="Carry the payment schedule across"
                hint={`${quotation.paymentSchedule.length} milestone${quotation.paymentSchedule.length === 1 ? '' : 's'} from the quotation`}
                checked={form.carryPaymentSchedule}
                onCheckedChange={toggle('carryPaymentSchedule')}
              />
            )}
          </section>

          <Field label="Notes on the invoice">
            <Textarea value={form.notes} onChange={set('notes')} rows={2} />
          </Field>

          {/* ------------------------------------------------------- totals */}
          <dl className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
            <div className="flex justify-between py-0.5">
              <dt className="text-slate-500">Subtotal ({allItems.length} item{allItems.length === 1 ? '' : 's'})</dt>
              <dd className="tabular-nums text-slate-700">{formatINR(totals.subtotal, true)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between py-0.5">
                <dt className="text-slate-500">Discount</dt>
                <dd className="tabular-nums text-slate-700">− {formatINR(totals.discountAmount, true)}</dd>
              </div>
            )}
            {totals.gstEnabled && (
              <div className="flex justify-between py-0.5">
                <dt className="text-slate-500">GST @ {totals.gstRate}%</dt>
                <dd className="tabular-nums text-slate-700">{formatINR(totals.gstAmount, true)}</dd>
              </div>
            )}
            {totals.additional > 0 && (
              <div className="flex justify-between py-0.5">
                <dt className="text-slate-500">Additional charges</dt>
                <dd className="tabular-nums text-slate-700">{formatINR(totals.additional, true)}</dd>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5">
              <dt className="font-bold text-slate-700">Invoice total</dt>
              <dd className="font-bold tabular-nums text-slate-900">{formatINR(totals.grandTotal)}</dd>
            </div>
          </dl>

          {allItems.length === 0 && (
            <p className="text-[12px] text-red-600">Add at least one line before creating the invoice.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={allItems.length === 0 || saving}>
              <ReceiptIndianRupee /> Create invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
