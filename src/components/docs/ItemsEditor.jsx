import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Plus, Copy, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { SimpleSelect } from '../ui/select'
import { UNITS } from '../../lib/seed'
import { formatINR } from '../../lib/format'
import { cn } from '../../lib/utils'

const blank = (qtyKey) => ({ sno: 0, description: '', unit: 'Sqft', [qtyKey]: 0, rate: 0, amount: 0 })

/**
 * Each row stacks description above a four-field money strip. The editor lives
 * in a ~500px side panel, so a single wide six-column grid never fits — this
 * layout works from a phone up to a desktop panel without squashing anything.
 */
export default function ItemsEditor({ items = [], onChange, qtyKey = 'area', qtyLabel = 'Area' }) {
  const renumber = (list) =>
    list.map((it, i) => ({
      ...it,
      sno: i + 1,
      amount: Math.round(Number(it[qtyKey] || 0) * Number(it.rate || 0) * 100) / 100,
    }))

  const update = (index, patch) => onChange(renumber(items.map((it, i) => (i === index ? { ...it, ...patch } : it))))
  const add = () => onChange(renumber([...items, blank(qtyKey)]))
  const duplicate = (i) => onChange(renumber([...items.slice(0, i + 1), { ...items[i] }, ...items.slice(i + 1)]))
  const remove = (i) => onChange(renumber(items.filter((_, idx) => idx !== i)))

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return
    const next = [...items]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    onChange(renumber(next))
  }

  const total = items.reduce((s, it) => s + Number(it.amount || 0), 0)

  const FieldLabel = ({ children }) => (
    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
  )

  return (
    <div className="space-y-2">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="items">
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-2">
              {items.map((it, i) => (
                <Draggable key={`row-${i}`} draggableId={`row-${i}`} index={i}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={cn(
                        'rounded-lg border border-slate-200 bg-white p-2',
                        snapshot.isDragging && 'shadow-lg ring-2 ring-brand/40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex shrink-0 flex-col items-center gap-1 pt-1.5">
                          <span
                            {...dragProvided.dragHandleProps}
                            className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                        </div>

                        <Textarea
                          value={it.description}
                          onChange={(e) => update(i, { description: e.target.value })}
                          placeholder="Description of work"
                          rows={2}
                          className="min-h-[52px] flex-1 text-[13px]"
                        />

                        <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                          <Button variant="ghost" size="iconSm" title="Duplicate row" onClick={() => duplicate(i)}>
                            <Copy />
                          </Button>
                          <Button
                            variant="ghost" size="iconSm" title="Delete row"
                            onClick={() => remove(i)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 pl-7 sm:grid-cols-4">
                        <label>
                          <FieldLabel>Unit</FieldLabel>
                          <SimpleSelect value={it.unit || 'Sqft'} onValueChange={(v) => update(i, { unit: v })} options={UNITS} />
                        </label>
                        <label>
                          <FieldLabel>{qtyLabel}</FieldLabel>
                          <Input
                            type="number" inputMode="decimal" value={it[qtyKey] ?? 0}
                            onChange={(e) => update(i, { [qtyKey]: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="text-right tabular-nums"
                          />
                        </label>
                        <label>
                          <FieldLabel>Rate</FieldLabel>
                          <Input
                            type="number" inputMode="decimal" value={it.rate ?? 0}
                            onChange={(e) => update(i, { rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="text-right tabular-nums"
                          />
                        </label>
                        <div>
                          <FieldLabel>Amount</FieldLabel>
                          <div className="flex h-9 items-center justify-end rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[13px] font-semibold tabular-nums text-slate-800">
                            {formatINR(it.amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[12.5px] text-slate-400">
          No line items yet — add the first one below.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus /> Add line item
        </Button>
        <p className="text-[13px] text-slate-500">
          {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
          <span className="font-bold tabular-nums text-slate-800">{formatINR(total)}</span>
        </p>
      </div>
    </div>
  )
}
