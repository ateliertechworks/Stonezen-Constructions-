import { Copy, Trash2, Eye, EyeOff, MousePointerClick } from 'lucide-react'
import { BLOCK_TYPES } from './blocks'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field } from '../ui/label'
import { SimpleSelect } from '../ui/select'
import { SwitchRow } from '../ui/switch'

const ALIGN = ['left', 'center', 'right']

export default function PropertiesPanel({ block, onChange, onDuplicate, onDelete, onToggleVisible }) {
  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
        <MousePointerClick className="mb-2 h-5 w-5 text-slate-300" />
        <p className="text-[13px] font-semibold text-slate-600">No block selected</p>
        <p className="mt-1 text-[11px] text-slate-400">Click a block in the layout list or on the preview to edit it.</p>
      </div>
    )
  }

  const def = BLOCK_TYPES[block.type]
  const p = block.props || {}
  const set = (key, value) => onChange({ ...block, props: { ...p, [key]: value } })

  const boolProps = Object.entries(p).filter(([, v]) => typeof v === 'boolean')

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-slate-800">{def.label}</p>
          <p className="text-[11px] text-slate-400">{def.description}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="iconSm" title={block.visible === false ? 'Show' : 'Hide'} onClick={onToggleVisible}>
            {block.visible === false ? <EyeOff className="text-slate-400" /> : <Eye />}
          </Button>
          <Button variant="ghost" size="iconSm" title="Duplicate" onClick={onDuplicate}>
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            title={def.required ? 'This block is required' : 'Delete'}
            disabled={def.required}
            onClick={onDelete}
            className="text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {'text' in p && (
        <Field label="Text">
          {block.type === 'text' ? (
            <Textarea value={p.text} onChange={(e) => set('text', e.target.value)} rows={4} />
          ) : (
            <Input value={p.text} onChange={(e) => set('text', e.target.value)} />
          )}
        </Field>
      )}

      {'heading' in p && (
        <Field label="Section heading" hint="Leave blank to hide the heading">
          <Input value={p.heading} onChange={(e) => set('heading', e.target.value)} />
        </Field>
      )}

      {'title' in p && (
        <Field label="Table title" hint="Defaults to the document title when blank">
          <Input value={p.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        {'align' in p && (
          <Field label="Alignment">
            <SimpleSelect value={p.align} onValueChange={(v) => set('align', v)} options={ALIGN} />
          </Field>
        )}
        {'size' in p && (
          <Field label="Size">
            <SimpleSelect value={p.size} onValueChange={(v) => set('size', v)} options={['sm', 'md', 'lg']} />
          </Field>
        )}
        {'emphasis' in p && (
          <Field label="Emphasis">
            <SimpleSelect value={p.emphasis} onValueChange={(v) => set('emphasis', v)} options={['normal', 'bold', 'italic']} />
          </Field>
        )}
        {'color' in p && (
          <Field label="Colour">
            <SimpleSelect value={p.color} onValueChange={(v) => set('color', v)} options={['slate', 'brand']} />
          </Field>
        )}
        {'thickness' in p && (
          <Field label="Thickness (px)">
            <Input type="number" min={1} max={8} value={p.thickness} onChange={(e) => set('thickness', Number(e.target.value))} />
          </Field>
        )}
        {'height' in p && (
          <Field label="Height (px)">
            <Input type="number" min={4} max={120} step={4} value={p.height} onChange={(e) => set('height', Number(e.target.value))} />
          </Field>
        )}
      </div>

      {boolProps.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Visibility options</p>
          {boolProps.map(([key, val]) => (
            <SwitchRow
              key={key}
              label={key
                .replace(/^show/, '')
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (c) => c.toUpperCase())
                .trim()}
              checked={val}
              onCheckedChange={(v) => set(key, v)}
            />
          ))}
        </div>
      )}

      {def.dataDriven && (
        <p className="rounded-lg bg-navy-50 px-3 py-2 text-[11px] text-brand">
          This block pulls live data from the document — edit the values in the Details tab.
        </p>
      )}
    </div>
  )
}
