import { Input } from '../ui/input'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { SwitchRow } from '../ui/switch'
import { formatINR, formatNum } from '../../lib/format'
import { cn } from '../../lib/utils'

const GST_RATES = ['0', '5', '12', '18', '28']

/**
 * Declared at module scope rather than inside TotalsPanel: a component created
 * during render is a fresh type each pass, which remounts the subtree and drops
 * focus while the user is typing into the totals fields.
 */
function Row({ label, value, strong, tone }) {
  return (
    <div className={cn('flex items-center justify-between py-1 text-[13px]', strong && 'font-bold')}>
      <span className={cn('text-slate-500', strong && 'text-slate-800')}>{label}</span>
      <span className={cn('tabular-nums text-slate-800', tone)}>{value}</span>
    </div>
  )
}

export default function TotalsPanel({ doc, onChange, totals: t, extraRows = [] }) {
  const set = (patch) => onChange(patch)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Discount (%)">
          <Input
            type="number" min={0} max={100} value={doc.discount ?? 0}
            onChange={(e) => set({ discount: e.target.value === '' ? 0 : Number(e.target.value) })}
            className="text-right tabular-nums"
          />
        </Field>
        <Field label="Additional charges (₹)">
          <Input
            type="number" value={doc.additionalCharges ?? 0}
            onChange={(e) => set({ additionalCharges: e.target.value === '' ? 0 : Number(e.target.value) })}
            className="text-right tabular-nums"
          />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <SwitchRow
          label="Apply GST"
          hint="Turn off for labour-only or unregistered work"
          checked={!!doc.gstEnabled}
          onCheckedChange={(v) => set({ gstEnabled: v })}
        />
        {doc.gstEnabled && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="GST rate (%)">
              <SimpleSelect
                value={String(doc.gst ?? 18)}
                onValueChange={(v) => set({ gst: Number(v) })}
                options={GST_RATES.map((r) => ({ value: r, label: `${r}%` }))}
              />
            </Field>
            <Field label="Supply type" hint={doc.gstType === 'inter' ? 'IGST — outside Tamil Nadu' : 'CGST + SGST — within Tamil Nadu'}>
              <SimpleSelect
                value={doc.gstType || 'intra'}
                onValueChange={(v) => set({ gstType: v })}
                options={[
                  { value: 'intra', label: 'Intra-state (CGST + SGST)' },
                  { value: 'inter', label: 'Inter-state (IGST)' },
                ]}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <SwitchRow
          label="Round off the total"
          hint="Rounds the grand total to the nearest rupee"
          checked={doc.autoRoundOff !== false}
          onCheckedChange={(v) => set({ autoRoundOff: v })}
        />
        {doc.autoRoundOff === false && (
          <Field label="Manual round off (₹)" className="mt-2">
            <Input
              type="number" value={doc.roundOff ?? 0}
              onChange={(e) => set({ roundOff: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="text-right tabular-nums"
            />
          </Field>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Row label="Subtotal" value={formatINR(t.subtotal, true)} />
        {t.discountAmount > 0 && <Row label={`Discount (${formatNum(t.discountPct)}%)`} value={`− ${formatINR(t.discountAmount, true)}`} tone="text-amber-600" />}
        {t.discountAmount > 0 && <Row label="Taxable amount" value={formatINR(t.taxableAmount, true)} />}
        {t.gstEnabled && t.inter && <Row label={`IGST @ ${formatNum(t.gstRate)}%`} value={formatINR(t.igst, true)} />}
        {t.gstEnabled && !t.inter && <Row label={`CGST @ ${formatNum(t.gstRate / 2)}%`} value={formatINR(t.cgst, true)} />}
        {t.gstEnabled && !t.inter && <Row label={`SGST @ ${formatNum(t.gstRate / 2)}%`} value={formatINR(t.sgst, true)} />}
        {!!t.additional && <Row label="Additional charges" value={formatINR(t.additional, true)} />}
        {Math.abs(t.roundOff) >= 0.01 && <Row label="Round off" value={`${t.roundOff < 0 ? '− ' : '+ '}${formatINR(Math.abs(t.roundOff), true)}`} />}
        <div className="mt-1 border-t border-slate-200 pt-1.5">
          <Row label="Grand total" value={formatINR(t.grandTotal)} strong />
        </div>
        {extraRows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} tone={r.tone} strong={r.strong} />
        ))}
      </div>
    </div>
  )
}
