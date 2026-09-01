import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, Download, Eye, FileText, Layers, LayoutTemplate, SlidersHorizontal, Check, Copy, Loader2 } from 'lucide-react'

import { useStore } from '../lib/useStore'
import { addInvoice, updateInvoice, blankInvoice, addActivity } from '../lib/store'
import { invoiceTotals, invoicePaid, invoiceDisplayStatus } from '../lib/calc'
import { formatINR, addDaysISO } from '../lib/format'
import { downloadInvoice } from '../lib/pdf'
import { useAsyncAction } from '../lib/useAsyncAction'
import { INVOICE_STATUSES } from '../lib/seed'
import { NONE, toSel, fromSel, cn } from '../lib/utils'

import PageHeader from '../components/ui/PageHeader'
import ActionError from '../components/ui/ActionError'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Field } from '../components/ui/label'
import { SimpleSelect } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

import ItemsEditor from '../components/docs/ItemsEditor'
import TotalsPanel from '../components/docs/TotalsPanel'
import LayoutBuilder from '../components/docs/LayoutBuilder'
import BlockPalette from '../components/docs/BlockPalette'
import PropertiesPanel from '../components/docs/PropertiesPanel'
import DocumentView from '../components/docs/DocumentView'
import { defaultBlocks, makeBlock, duplicateBlock, normalizeBlocks, BLOCK_TYPES } from '../components/docs/blocks'

export default function InvoiceBuilder() {
  const { id } = useParams()
  const db = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const existing = id ? db.invoices.find((i) => i.id === id) : null

  const [doc, setDoc] = useState(() => {
    if (existing) return { ...existing }
    const fromQuote = params.get('fromQuote')
    const quote = fromQuote ? db.quotations.find((q) => q.id === fromQuote) : null
    const clientId = quote?.clientId || params.get('client') || ''
    const projectId = quote?.projectId || params.get('project') || ''
    const client = db.clients.find((c) => c.id === clientId)
    const project = db.projects.find((p) => p.id === projectId)
    return blankInvoice({
      clientId,
      projectId,
      quotationId: quote?.id || '',
      billingAddress: [client?.address, client?.city, client?.pincode].filter(Boolean).join(', '),
      shippingAddress: project?.siteAddress || quote?.siteAddress || '',
      gstin: client?.gstin || '',
      gstEnabled: !!client?.gstin,
      gst: quote?.gst ?? db.settings.docs.defaultGst,
      gstType: quote?.gstType || 'intra',
      discount: quote?.discount || 0,
      additionalCharges: quote?.additionalCharges || 0,
      notes: quote ? `Generated from quotation ${quote.id}.` : '',
      items: quote
        ? (quote.items || []).map((it, i) => ({
            sno: i + 1, description: it.description, unit: it.unit,
            quantity: Number(it.area || 0), rate: Number(it.rate || 0), amount: Number(it.amount || 0),
          }))
        : [{ sno: 1, description: '', unit: 'Sqft', quantity: 0, rate: 0, amount: 0 }],
    })
  })

  const [blocks, setBlocks] = useState(() => normalizeBlocks(existing?.blocks, 'invoice'))
  const [selectedId, setSelectedId] = useState(null)
  const [pane, setPane] = useState('edit')
  const [tab, setTab] = useState('details')
  const [saved, setSaved] = useState(!!existing)
  const [savedId, setSavedId] = useState(existing?.id || null)
  const pdf = useAsyncAction()

  useEffect(() => {
    if (existing && existing.id !== savedId) {
      setDoc({ ...existing })
      setBlocks(normalizeBlocks(existing.blocks, 'invoice'))
      setSavedId(existing.id)
      setSaved(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const client = db.clients.find((c) => c.id === doc.clientId)
  const project = db.projects.find((p) => p.id === doc.projectId)
  const totals = useMemo(() => invoiceTotals(doc), [doc])
  const paid = savedId ? invoicePaid(db, { id: savedId }) : 0
  const balance = totals.grandTotal - paid
  const displayStatus = savedId ? invoiceDisplayStatus(db, { ...doc, id: savedId }) : doc.status
  const selected = blocks.find((b) => b.id === selectedId) || null

  const set = (patch) => {
    setDoc((d) => ({ ...d, ...patch }))
    setSaved(false)
  }
  const setBlocksDirty = (next) => {
    setBlocks(next)
    setSaved(false)
  }

  const onClientChange = (v) => {
    const cid = fromSel(v)
    const c = db.clients.find((x) => x.id === cid)
    set({
      clientId: cid,
      gstin: c?.gstin || '',
      gstEnabled: !!c?.gstin,
      billingAddress: doc.billingAddress || [c?.address, c?.city, c?.pincode].filter(Boolean).join(', '),
    })
  }

  const save = () => {
    const payload = { ...doc, blocks }
    if (savedId) {
      updateInvoice(savedId, payload)
      addActivity(`Invoice ${savedId} updated`, 'invoice')
      setSaved(true)
      return savedId
    }
    const created = addInvoice(payload)
    setSavedId(created.id)
    setDoc((d) => ({ ...d, id: created.id, invoiceNumber: created.id }))
    setSaved(true)
    navigate(`/invoices/${created.id}/edit`, { replace: true })
    return created.id
  }

  const saveAndPreview = () => navigate(`/invoices/${save()}/preview`)

  // Generating a PDF now loads a renderer over the network, so it needs the
  // same busy-and-error handling as the preview pages — a bare call here would
  // leave the button looking dead and swallow a failure entirely.
  const downloadPdf = () =>
    pdf.run(() =>
      downloadInvoice(
        { ...doc, id: savedId || doc.invoiceNumber },
        client, project, db.settings, totals, paid, balance, displayStatus,
      ),
    )

  const clientOptions = db.clients.map((c) => ({ value: c.id, label: c.company || c.name }))
  const projectOptions = [
    { value: NONE, label: 'No project' },
    ...db.projects.filter((p) => !doc.clientId || p.clientId === doc.clientId).map((p) => ({ value: p.id, label: p.name })),
  ]
  const quoteOptions = [
    { value: NONE, label: 'Not linked' },
    ...db.quotations.filter((q) => !doc.clientId || q.clientId === doc.clientId).map((q) => ({ value: q.id, label: `${q.id} — ${(q.title || '').slice(0, 36)}` })),
  ]

  const EditorPane = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="details" className="flex-1"><FileText className="h-3.5 w-3.5" /> Details</TabsTrigger>
        <TabsTrigger value="layout" className="flex-1"><LayoutTemplate className="h-3.5 w-3.5" /> Layout</TabsTrigger>
        <TabsTrigger value="blocks" className="flex-1"><Layers className="h-3.5 w-3.5" /> Blocks</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-3">
        <Card>
          <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Client" required className="sm:col-span-2">
              <SimpleSelect value={doc.clientId || undefined} onValueChange={onClientChange} options={clientOptions} placeholder="Select a client" />
            </Field>
            <Field label="Project">
              <SimpleSelect value={toSel(doc.projectId)} onValueChange={(v) => set({ projectId: fromSel(v) })} options={projectOptions} />
            </Field>
            <Field label="Reference quotation">
              <SimpleSelect value={toSel(doc.quotationId)} onValueChange={(v) => set({ quotationId: fromSel(v) })} options={quoteOptions} />
            </Field>
            <Field label="Invoice date">
              <Input type="date" value={doc.date} onChange={(e) => set({ date: e.target.value, dueDate: addDaysISO(e.target.value, 15) })} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={doc.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <SimpleSelect value={doc.status} onValueChange={(v) => set({ status: v })} options={INVOICE_STATUSES} />
            </Field>
            <Field label="Client GSTIN">
              <Input value={doc.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} className="uppercase" />
            </Field>
            <Field label="Billing address" className="sm:col-span-2">
              <Textarea value={doc.billingAddress} onChange={(e) => set({ billingAddress: e.target.value })} rows={2} />
            </Field>
            <Field
              label="Shipping / site address"
              className="sm:col-span-2"
              hint="Leave blank to reuse the billing address"
            >
              <div className="flex gap-2">
                <Textarea value={doc.shippingAddress} onChange={(e) => set({ shippingAddress: e.target.value })} rows={2} />
                <Button variant="outline" size="icon" title="Copy billing address" onClick={() => set({ shippingAddress: doc.billingAddress })}>
                  <Copy />
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billed items</CardTitle>
            <span className="text-[11.5px] text-slate-400">Drag rows to reorder</span>
          </CardHeader>
          <CardContent>
            <ItemsEditor items={doc.items} onChange={(items) => set({ items })} qtyKey="quantity" qtyLabel="Qty" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>GST &amp; totals</CardTitle></CardHeader>
          <CardContent>
            <TotalsPanel
              doc={doc}
              onChange={set}
              totals={totals}
              extraRows={
                paid > 0
                  ? [
                      { label: 'Amount received', value: `− ${formatINR(paid, true)}`, tone: 'text-emerald-600' },
                      { label: 'Balance due', value: formatINR(balance, true), strong: true, tone: balance > 0 ? 'text-red-600' : 'text-emerald-600' },
                    ]
                  : []
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes &amp; payment terms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Notes">
              <Textarea value={doc.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} placeholder="e.g. Running bill No. 3 — footing, plinth and slab 1" />
            </Field>
            <Field label="Payment terms">
              <Textarea value={doc.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} rows={3} />
            </Field>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="layout" className="space-y-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Document layout</CardTitle>
              <p className="text-[11.5px] text-slate-400">Drag to reorder · click to edit properties</p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setBlocksDirty(defaultBlocks('invoice'))}>
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
    <div className="xl:sticky xl:top-[72px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-slate-500">
          Live preview {selected && <span className="text-slate-400">· {BLOCK_TYPES[selected.type].label} selected</span>}
        </p>
        <p className="text-[13px] font-bold tabular-nums text-slate-800">{formatINR(totals.grandTotal)}</p>
      </div>
      <div className="max-h-[calc(100vh-160px)] overflow-auto rounded-xl bg-slate-100 p-3 xl:p-4">
        <div>
          <DocumentView
            doc={{ ...doc, id: savedId || doc.invoiceNumber }}
            kind="invoice"
            blocks={blocks}
            client={client}
            project={project}
            settings={db.settings}
            totals={totals}
            paid={paid}
            balance={balance}
            status={displayStatus}
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
        backTo="/invoices"
        backLabel="All invoices"
        title={savedId ? `Edit ${savedId}` : 'New invoice'}
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
            <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdf.busy}>
              {pdf.busy ? <Loader2 className="animate-spin" /> : <Download />} PDF
            </Button>
            <Button size="sm" variant="outline" onClick={saveAndPreview} disabled={!doc.clientId}>
              <Eye /> Preview
            </Button>
            <Button size="sm" onClick={save} disabled={!doc.clientId}>
              {saved ? <Check /> : <Save />} {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 xl:hidden">
        {[
          ['edit', 'Editor'],
          ['preview', 'Preview'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setPane(v)}
            className={cn('rounded-md py-1.5 text-[13px] font-semibold transition-colors', pane === v ? 'bg-white text-brand shadow-sm' : 'text-slate-500')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The split waits for xl, not lg. At 1024px the sidebar takes 256px and
          the editor 460px, which left the preview about 270px wide — an A4 page
          squeezed to a third of its width, with the letterhead wrapping
          mid-address. Below xl the Editor/Preview toggle above is used instead,
          which shows each of them full width. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <div className={cn(pane === 'edit' ? 'block' : 'hidden', 'xl:block')}>{EditorPane}</div>
        <div className={cn(pane === 'preview' ? 'block' : 'hidden', 'xl:block')}>{PreviewPane}</div>
      </div>

      <div className="fixed inset-x-0 bottom-[56px] z-30 flex gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
        <Button variant="outline" className="flex-1" onClick={downloadPdf} disabled={pdf.busy}>
          {pdf.busy ? <Loader2 className="animate-spin" /> : <Download />} PDF
        </Button>
        <Button className="flex-1" onClick={save} disabled={!doc.clientId}>
          {saved ? <Check /> : <Save />} {saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      <ActionError action={pdf} />
    </div>
  )
}
