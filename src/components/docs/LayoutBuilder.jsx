import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Eye, EyeOff, Copy, Trash2 } from 'lucide-react'
import { BLOCK_TYPES } from './blocks'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/** Ordered, drag-and-drop list of the blocks that make up the document. */
export default function LayoutBuilder({ blocks, onChange, selectedId, onSelect, onDuplicate, onDelete }) {
  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return
    const next = [...blocks]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    onChange(next)
  }

  const toggle = (id) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, visible: b.visible === false } : b)))

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="blocks">
        {(dropProvided) => (
          <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-1.5">
            {blocks.map((b, i) => {
              const def = BLOCK_TYPES[b.type]
              const Icon = def.icon
              const hidden = b.visible === false
              return (
                <Draggable key={b.id} draggableId={b.id} index={i}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      onClick={() => onSelect(b.id)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 py-1.5 transition-colors',
                        selectedId === b.id ? 'border-brand bg-navy-50 ring-1 ring-brand/30' : 'border-slate-200 hover:border-slate-300',
                        snapshot.isDragging && 'shadow-lg ring-2 ring-brand/40',
                        hidden && 'opacity-50',
                      )}
                    >
                      <span
                        {...dragProvided.dragHandleProps}
                        className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-700">
                        {def.label}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="iconSm" title={hidden ? 'Show' : 'Hide'} onClick={() => toggle(b.id)}>
                          {hidden ? <EyeOff className="text-slate-400" /> : <Eye />}
                        </Button>
                        <Button variant="ghost" size="iconSm" title="Duplicate" onClick={() => onDuplicate(b.id)}>
                          <Copy />
                        </Button>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          title={def.required ? 'Required block' : 'Remove'}
                          disabled={def.required}
                          onClick={() => onDelete(b.id)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  )}
                </Draggable>
              )
            })}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
