import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, Download, Eye, FileText, Layers, LayoutTemplate, SlidersHorizontal, Check } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { addQuotation, updateQuotation, blankQuotation, addActivity } from '../lib/store'
import { quotationTotals } from '../lib/calc'
import { formatINR, addDaysISO } from '../lib/format'
import { downloadQuotation } from '../lib/pdf'
import { QUOTATION_STATUSES } from '../lib/seed'
import { NONE, toSel, fromSel, cn } from '../lib/utils'

import PageHeader from '../components/ui/PageHeader'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Field } from '../components/ui/label'
import { SimpleSelect } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

import ItemsEditor from '../components/docs/ItemsEditor'
import ScheduleEditor from '../components/docs/ScheduleEditor'
import TotalsPanel from '../components/docs/TotalsPanel'
import LayoutBuilder from '../components/docs/LayoutBuilder'
import BlockPalette from '../components/docs/BlockPalette'
import PropertiesPanel from '../components/docs/PropertiesPanel'
import DocumentView from '../components/docs/DocumentView'
import { defaultBlocks, makeBlock, duplicateBlock, normalizeBlocks, BLOCK_TYPES } from '../components/docs/blocks'

export default function QuotationBuilder() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const existing = id ? db.quotations.find((q) => q.id === id) : null

  const [doc, setDoc] = useState(() => {
    if (existing) return { ...existing }
    const clientId = params.get('client') || ''
    const projectId = params.get('project') || ''
    const client = db.clients.find((c) => c.id === clientId)
    const project = db.projects.find((p) => p.id === projectId)
    return blankQuotation({
      clientId,
      projectId,
      title: project ? `Quotation for ${project.name}` : '',
      siteAddress: project?.siteAddress || client?.address || '',
      contactNumber: client?.phone || '',
      email: client?.email || '',
      gstin: client?.gstin || '',
      gstEnabled: !!client?.gstin,
    })
  })

  const [blocks, setBlocks] = useState(() => normalizeBlocks(existing?.blocks, 'quotation'))
  const [selectedId, setSelectedId] = useState(null)
  const [pane, setPane] = useState('edit')
  const [tab, setTab] = useState('details')
  const [saved, setSaved] = useState(!!existing)
  const [savedId, setSavedId] = useState(existing?.id || null)

  // Reload when navigating between two saved quotations.
  useEffect(() => {
    if (existing && existing.id !== savedId) {
      setDoc({ ...existing })
      setBlocks(normalizeBlocks(existing.blocks, 'quotation'))
      setSavedId(existing.id)
      setSaved(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const client = db.clients.find((c) => c.id === doc.clientId)
  const project = db.projects.find((p) => p.id === doc.projectId)
  const totals = useMemo(() => quotationTotals(doc), [doc])
  const selected = blocks.find((b) => b.id === selectedId) || null

  const set = (patch) => {
    setDoc((d) => ({ ...d, ...patch }))
    setSaved(false)
  }
  const setBlocksDirty = (next) => {
    setBlocks(next)
    setSaved(false)
  }

  /** Choosing a client pulls their contact details onto the document. */
  const onClientChange = (v) => {
    const cid = fromSel(v)
    const c = db.clients.find((x) => x.id === cid)
    set({
      clientId: cid,
      contactNumber: c?.phone || doc.contactNumber,
      email: c?.email || doc.email,
      gstin: c?.gstin || '',
      gstEnabled: !!c?.gstin,
      siteAddress: doc.siteAddress || [c?.address, c?.city, c?.pincode].filter(Boolean).join(', '),
    })
  }

  const onProjectChange = (v) => {
    const pid = fromSel(v)
    const p = db.projects.find((x) => x.id === pid)
    set({
      projectId: pid,
      siteAddress: p?.siteAddress || doc.siteAddress,
      title: doc.title || (p ? `Quotation for ${p.name}` : ''),
    })
  }

  const save = () => {
    const payload = { ...doc, blocks }
    if (savedId) {
      updateQuotation(savedId, payload)
      addActivity(`Quotation ${savedId} updated`, 'quotation')
      setSaved(true)
      return savedId
    }
    const created = addQuotation(payload)
    setSavedId(created.id)
    setDoc((d) => ({ ...d, id: created.id, quotationNumber: created.id }))
    setSaved(true)
    navigate(`/quotations/${created.id}/edit`, { replace: true })
    return created.id
  }

  const saveAndPreview = () => {
    const newId = save()
    navigate(`/quotations/${newId}/preview`)
  }

  const downloadPdf = () =>
    downloadQuotation({ ...doc, id: savedId || doc.quotationNumber }, client, project, db.settings, totals)

  const clientOptions = db.clients.map((c) => ({ value: c.id, label: c.company || c.name }))
  const projectOptions = [
    { value: NONE, label: 'No project' },
    ...db.projects.filter((p) => !doc.clientId || p.clientId === doc.clientId).map((p) => ({ value: p.id, label: p.name })),
  ]

  /* ---------------------------------------------------------------- panes */

  const EditorPane = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="details" className="flex-1"><FileText className="h-3.5 w-3.5" /> Details</TabsTrigger>
        <TabsTrigger value="layout" className="flex-1"><LayoutTemplate className="h-3.5 w-3.5" /> Layout</TabsTrigger>
        <TabsTrigger value="blocks" className="flex-1"><Layers className="h-3.5 w-3.5" /> Blocks</TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------- details */}
      <TabsContent value="details" className="space-y-3">
        <Card>
          <CardHeader><CardTitle>Quotation details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" required className="sm:col-span-2">
              <SimpleSelect value={doc.clientId || undefined} onValueChange={onClientChange} options={clientOptions} placeholder="Select a client" />
            </Field>
            <Field label="Project">
              <SimpleSelect value={toSel(doc.projectId)} onValueChange={onProjectChange} options={projectOptions} />
            </Field>
            <Field label="Status">
              <SimpleSelect value={doc.status} onValueChange={(v) => set({ status: v })} options={QUOTATION_STATUSES} />
            </Field>
            <Field label="Title" required className="sm:col-span-2">
              <Input value={doc.title} onChange={(e) => set({ title: e.target.value })} placeholder="Quotation for compound wall in farm land, Kulathur" />
            </Field>
            <Field label="Date">
              <Input
                type="date" value={doc.date}
                onChange={(e) => set({ date: e.target.value, validUntil: addDaysISO(e.target.value, db.settings.docs.defaultValidityDays || 30) })}
              />
            </Field>
            <Field label="Valid until">
              <Input type="date" value={doc.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
            </Field>
            <Field label="Site address" className="sm:col-span-2">
              <Input value={doc.siteAddress} onChange={(e) => set({ siteAddress: e.target.value })} />
            </Field>
            <Field label="Contact number">
              <Input value={doc.contactNumber} onChange={(e) => set({ contactNumber: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={doc.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Client GSTIN" className="sm:col-span-2">
              <Input value={doc.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} className="uppercase" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope of work</CardTitle>
            <span className="text-[11.5px] text-slate-400">Drag rows to reorder</span>
          </CardHeader>
          <CardContent>
            <ItemsEditor items={doc.items} onChange={(items) => set({ items })} qtyKey="area" qtyLabel="Area" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>GST &amp; totals</CardTitle></CardHeader>
          <CardContent>
            <TotalsPanel doc={doc} onChange={set} totals={totals} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment schedule</CardTitle>
            <span className="text-[11.5px] text-slate-400">Milestone-wise plan</span>
          </CardHeader>
          <CardContent>
            <ScheduleEditor rows={doc.paymentSchedule || []} onChange={(paymentSchedule) => set({ paymentSchedule })} grandTotal={totals.grandTotal} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes &amp; terms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Notes" hint="Shown under the items table — labour rates, exclusions, assumptions">
              <Textarea value={doc.notes} onChange={(e) => set({ notes: e.target.value })} rows={4} />
            </Field>
            <Field label="Terms & conditions">
              <Textarea value={doc.terms} onChange={(e) => set({ terms: e.target.value })} rows={5} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Last contacted">
                <Input type="date" value={doc.lastContact || ''} onChange={(e) => set({ lastContact: e.target.value })} />
              </Field>
              <Field label="Next follow-up">
                <Input type="date" value={doc.nextFollowup || ''} onChange={(e) => set({ nextFollowup: e.target.value })} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* -------------------------------------------------------- layout */}
      <TabsContent value="layout" className="space-y-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Document layout</CardTitle>
              <p className="text-[11.5px] text-slate-400">Drag to reorder · click to edit properties</p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setBlocksDirty(defaultBlocks('quotation'))}>
              Reset layout
            </Button>
          </CardHeader>
          <CardContent>
            <LayoutBuilder
              blocks={blocks}
              onChange={setBlocksDirty}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDuplicate={(bid) => {
                const i = blocks.findIndex((b) => b.id === bid)
                const copy = duplicateBlock(blocks[i])
                setBlocksDirty([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)])
                setSelectedId(copy.id)
              }}
              onDelete={(bid) => {
                setBlocksDirty(blocks.filter((b) => b.id !== bid))
                if (selectedId === bid) setSelectedId(null)
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Block properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PropertiesPanel
              block={selected}
              onChange={(nb) => setBlocksDirty(blocks.map((b) => (b.id === nb.id ? nb : b)))}
              onToggleVisible={() => setBlocksDirty(blocks.map((b) => (b.id === selectedId ? { ...b, visible: b.visible === false } : b)))}
              onDuplicate={() => {
                const i = blocks.findIndex((b) => b.id === selectedId)
                const copy = duplicateBlock(blocks[i])
                setBlocksDirty([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)])
                setSelectedId(copy.id)
              }}
              onDelete={() => {
                setBlocksDirty(blocks.filter((b) => b.id !== selectedId))
                setSelectedId(null)
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* -------------------------------------------------------- blocks */}
      <TabsContent value="blocks">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add a block</CardTitle>
              <p className="text-[11.5px] text-slate-400">New blocks are appended to the end of the layout</p>
            </div>
          </CardHeader>
          <CardContent>
            <BlockPalette
              usedTypes={blocks.map((b) => b.type)}
              onAdd={(type) => {
                const b = makeBlock(type)
                setBlocksDirty([...blocks, b])
                setSelectedId(b.id)
                setTab('layout')
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )

  const PreviewPane = (
    <div className="lg:sticky lg:top-[72px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-slate-500">
          Live preview {selected && <span className="text-slate-400">· {BLOCK_TYPES[selected.type].label} selected</span>}
        </p>
        <p className="text-[13px] font-bold tabular-nums text-slate-800">{formatINR(totals.grandTotal)}</p>
      </div>
      <div className="max-h-[calc(100vh-160px)] overflow-auto rounded-xl bg-slate-100 p-3 lg:p-4">
        <div>
          <DocumentView
            doc={{ ...doc, id: savedId || doc.quotationNumber }}
            kind="quotation"
            blocks={blocks}
            client={client}
            project={project}
            settings={db.settings}
            totals={totals}
            status={doc.status}
            className="doc-fluid"
            interactive
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="pb-16 lg:pb-0">
      <PageHeader
        backTo="/quotations"
        backLabel="All quotations"
        title={savedId ? `Edit ${savedId}` : 'New quotation'}
        subtitle={
          <>
            {client ? client.company || client.name : 'No client selected'} ·{' '}
            <span className={cn('font-semibold', saved ? 'text-emerald-600' : 'text-amber-600')}>
              {saved ? 'All changes saved' : 'Unsaved changes'}
            </span>
          </>
        }
        actions={
          <div className="hidden gap-2 sm:flex">
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <Download /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={saveAndPreview} disabled={!doc.clientId}>
              <Eye /> Preview
            </Button>
            <Button size="sm" onClick={save} disabled={!doc.clientId || !doc.title}>
              {saved ? <Check /> : <Save />} {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        }
      />

      {/* Mobile pane switcher */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 lg:hidden">
        {[
          ['edit', 'Editor'],
          ['preview', 'Preview'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setPane(v)}
            className={cn(
              'rounded-md py-1.5 text-[13px] font-semibold transition-colors',
              pane === v ? 'bg-white text-brand shadow-sm' : 'text-slate-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <div className={cn(pane === 'edit' ? 'block' : 'hidden', 'lg:block')}>{EditorPane}</div>
        <div className={cn(pane === 'preview' ? 'block' : 'hidden', 'lg:block')}>{PreviewPane}</div>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-[56px] z-30 flex gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
        <Button variant="outline" className="flex-1" onClick={downloadPdf}>
          <Download /> PDF
        </Button>
        <Button className="flex-1" onClick={save} disabled={!doc.clientId || !doc.title}>
          {saved ? <Check /> : <Save />} {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
