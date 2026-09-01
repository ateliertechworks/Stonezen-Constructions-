import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Loader2, X, Download, ImageOff, RefreshCw, Pencil, Check } from 'lucide-react'

import {
  listPhotos, getPhoto, uploadPhoto, updatePhoto, deletePhoto, PHOTO_STAGES,
} from '../../lib/photos'
import { saveFile } from '../../lib/download'
import { formatDate, todayISO, localISO } from '../../lib/format'

import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { SimpleSelect } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import ConfirmDialog from '../ui/ConfirmDialog'
import StatusBadge from '../ui/StatusBadge'

const STAGE_OPTIONS = PHOTO_STAGES.map((s) => ({ value: s, label: s }))

/**
 * Site photographs for one project.
 *
 * Loaded on mount rather than with the rest of the project, because they come
 * from their own endpoint — see `lib/photos.js` for why they are not part of
 * the synced document.
 */
export default function ProjectPhotos({ project }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(0)
  const [viewing, setViewing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [stage, setStage] = useState('Completed')
  const fileRef = useRef(null)

  // Bumped by the retry button; the fetch itself lives entirely in the effect
  // so that switching projects quickly cannot land a stale response.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listPhotos(project.id)
        if (!cancelled) setPhotos(rows)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load photos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [project.id, reloadKey])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((n) => n + 1)
  }

  const onPick = async (e) => {
    const files = Array.from(e.target.files || [])
    // Clearing the input is what lets the same file be chosen twice in a row.
    e.target.value = ''
    if (!files.length) return

    setError(null)
    setUploading(files.length)
    const added = []
    const failures = []
    // Sequential on purpose: resizing runs on the main thread, and three
    // full-resolution decodes at once will kill a tab on a mid-range phone.
    for (const file of files) {
      try {
        added.push(await uploadPhoto(project.id, file, { stage, takenOn: takenOnFor(file) }))
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`)
      }
      setUploading((n) => n - 1)
    }
    if (added.length) setPhotos((rows) => [...added.reverse(), ...rows])
    if (failures.length) setError(failures.join(' · '))
  }

  const remove = async (photo) => {
    // Removed from the grid first so the tap feels immediate; put back if the
    // server refuses, rather than pretending it worked.
    setPhotos((rows) => rows.filter((p) => p.id !== photo.id))
    try {
      await deletePhoto(photo.id)
    } catch (e) {
      setError(e.message || 'Could not delete that photo.')
      setPhotos((rows) => [photo, ...rows])
    }
  }

  const saveCaption = async (photo, caption, nextStage) => {
    setEditing(null)
    const previous = photos
    setPhotos((rows) => rows.map((p) => (p.id === photo.id ? { ...p, caption, stage: nextStage } : p)))
    try {
      await updatePhoto(photo.id, { caption, stage: nextStage })
    } catch (e) {
      setError(e.message || 'Could not save that caption.')
      setPhotos(previous)
    }
  }

  const open = async (photo) => {
    // The grid only ever holds thumbnails, so the full image is fetched here.
    setViewing({ ...photo, data: null, loading: true })
    try {
      const full = await getPhoto(photo.id)
      // Opening a second photo before the first arrives would otherwise show
      // the wrong picture under the right caption.
      setViewing((v) => (v && v.id === photo.id ? { ...full, loading: false } : v))
    } catch (e) {
      setViewing((v) => (v && v.id === photo.id ? { ...photo, loading: false, failed: e.message || 'Could not load that photo.' } : v))
    }
  }

  const download = async (photo) => {
    // The grid holds thumbnails, so a download has to go and fetch the full
    // image first — and that can fail, which without this would surface only
    // as an unhandled rejection and a button that did nothing.
    try {
      const full = photo.data ? photo : await getPhoto(photo.id)
      const blob = await (await fetch(full.data)).blob()
      const label = (full.caption || project.name || 'photo').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)
      await saveFile(blob, `${project.id} - ${label}.jpg`)
    } catch (e) {
      setError(e.message || 'Could not download that photo.')
    }
  }

  return (
    <Card className="mt-3">
      {/* The controls wrap below the title on a narrow phone: side by side they
          push the card past a 320px viewport. */}
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle>Site Photos</CardTitle>
          <p className="text-[11.5px] text-slate-400">
            {loading ? 'Loading…' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            {' · '}pictures of the finished work, kept with the project
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <SimpleSelect
            value={stage}
            onValueChange={setStage}
            options={STAGE_OPTIONS}
            className="w-[124px] shrink"
            aria-label="Stage for the next upload"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPick}
            // `capture` is deliberately absent: on a phone the picker then
            // offers both the camera and the gallery, and photos taken earlier
            // in the day are the common case.
          />
          <Button size="xs" className="shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="animate-spin" /> : <Camera />}
            {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {error && (
          <div role="alert" className="mb-2.5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 rounded p-0.5 hover:bg-red-100" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
          </p>
        ) : photos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center">
            <ImageOff className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
            <p className="text-[13px] text-slate-500">No site photos yet.</p>
            <p className="mt-0.5 text-[12px] text-slate-400">
              Add pictures of the completed work — they stay with the project and can be shared with the client.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileRef.current?.click()}>
              <Camera /> Add the first photo
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => open(photo)}
                  className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <img
                    src={photo.thumb}
                    alt={photo.caption || `Site photo of ${project.name}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full bg-slate-100 object-cover"
                  />
                </button>
                <div className="p-2">
                  {editing === photo.id ? (
                    <CaptionEditor photo={photo} onCancel={() => setEditing(null)} onSave={saveCaption} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <p className="min-w-0 flex-1 truncate text-[12px] text-slate-700">
                          {photo.caption || <span className="text-slate-400">No caption</span>}
                        </p>
                        <StatusBadge className="shrink-0" status={photo.stage} />
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">
                        {formatDate(photo.takenOn || photo.createdAt)}
                      </p>
                      <div className="mt-1 flex justify-end gap-0.5">
                        <Button size="iconSm" variant="ghost" title="Edit caption" onClick={() => setEditing(photo.id)}>
                          <Pencil />
                        </Button>
                        <Button size="iconSm" variant="ghost" title="Download photo" onClick={() => download(photo)}>
                          <Download />
                        </Button>
                        <Button
                          size="iconSm" variant="ghost" title="Delete photo"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => setConfirm(photo)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && !loading && photos.length === 0 && (
          <div className="mt-2 text-center">
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw /> Try again
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewing?.caption || 'Site photo'}</DialogTitle>
          </DialogHeader>
          {viewing?.loading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading full size…
            </p>
          ) : viewing?.failed ? (
            <p className="py-16 text-center text-[13px] text-red-600">{viewing.failed}</p>
          ) : (
            viewing && (
              <img
                src={viewing.data || viewing.thumb}
                alt={viewing.caption || `Site photo of ${project.name}`}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            )
          )}
          {viewing && !viewing.loading && (
            <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-slate-500">
              <span>
                {viewing.stage} · {formatDate(viewing.takenOn || viewing.createdAt)}
                {viewing.width ? ` · ${viewing.width}×${viewing.height}` : ''}
              </span>
              <Button size="sm" variant="outline" onClick={() => download(viewing)}>
                <Download /> Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this photo?"
        description={confirm?.caption || 'This removes the picture permanently.'}
        onConfirm={() => remove(confirm)}
      />
    </Card>
  )
}

/** Inline caption + stage editor for one tile. */
function CaptionEditor({ photo, onSave, onCancel }) {
  const [caption, setCaption] = useState(photo.caption || '')
  const [stage, setStage] = useState(photo.stage || 'Completed')

  return (
    <div className="space-y-1.5">
      <Input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="e.g. Living room after polishing"
        className="h-8 text-[12px]"
        aria-label="Photo caption"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(photo, caption.trim(), stage)
          if (e.key === 'Escape') onCancel()
        }}
      />
      <SimpleSelect value={stage} onValueChange={setStage} options={STAGE_OPTIONS} aria-label="Photo stage" />
      <div className="flex justify-end gap-0.5">
        <Button size="iconSm" variant="ghost" title="Cancel" onClick={onCancel}>
          <X />
        </Button>
        <Button size="iconSm" variant="ghost" title="Save caption" onClick={() => onSave(photo, caption.trim(), stage)}>
          <Check />
        </Button>
      </div>
    </div>
  )
}

/**
 * The date the photo was taken, when the file system knows it.
 *
 * `lastModified` is when the camera wrote the file, which for a photo taken on
 * site is the day it was taken. A file copied between devices loses that, so
 * this is a hint rather than a fact — it stays editable.
 */
function takenOnFor(file) {
  const ms = Number(file?.lastModified)
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date()
  // A file dated in the future is a wrong device clock, not a real timestamp.
  // `localISO`, never `toISOString`: a photo taken at 1am in Coimbatore would
  // otherwise be filed under the previous day. The server avoids the same trap
  // when it reads the date back out.
  if (Number.isNaN(d.getTime()) || d > new Date()) return todayISO()
  return localISO(d)
}
