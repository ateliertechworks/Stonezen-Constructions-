/**
 * Hands a generated file to the device.
 *
 * Everything used to go through `window.print()`, which on a phone means a
 * print preview and a hunt for "Save as PDF" — on some Android builds there is
 * no save option at all without a printer configured. These write a real file
 * instead, so tapping Download puts a .pdf in the phone's Downloads folder.
 */

/** Frees the object URL, but only after the browser has started the transfer. */
const REVOKE_DELAY_MS = 60_000

export function fileFromBlob(blob, filename, type = 'application/pdf') {
  try {
    return new File([blob], filename, { type })
  } catch {
    // Older WebKit has no File constructor; the Blob still works for a download.
    return blob
  }
}

/**
 * Saves a blob to the device's downloads.
 *
 * Returns how it was delivered so a caller can tell the user something useful:
 * `downloaded`, `shared`, `opened` (no download support — shown in a new tab),
 * or `cancelled`.
 */
export async function saveFile(blob, filename) {
  const anchor = document.createElement('a')
  const canDownload = 'download' in anchor

  if (!canDownload) {
    // Chiefly older iOS. The share sheet is the only route to the file system
    // there; failing that, opening it at least lets the viewer save manually.
    const shared = await shareFile(blob, filename, { type: blob.type })
    if (shared !== 'unsupported') return shared
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
    return 'opened'
  }

  const url = URL.createObjectURL(blob)
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately cancels the download on Safari and on some Android
  // WebViews, which start reading the URL only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
  return 'downloaded'
}

/**
 * Offers the file to the OS share sheet — WhatsApp, mail, Files, Drive.
 *
 * Returns `unsupported` when the browser cannot share files at all, so the
 * caller can fall back rather than silently doing nothing.
 */
export async function shareFile(blob, filename, { title, text, type } = {}) {
  // The blob's own type, not the PDF default: this path also carries the JPEGs
  // from a project's photo gallery, and a mislabelled file is rejected by some
  // share targets and saved with the wrong extension by others.
  const file = fileFromBlob(blob, filename, type || blob.type || 'application/pdf')
  if (!navigator.canShare || !(file instanceof File) || !navigator.canShare({ files: [file] })) {
    return 'unsupported'
  }
  try {
    await navigator.share({ files: [file], title: title || filename, ...(text ? { text } : {}) })
    return 'shared'
  } catch (e) {
    // Dismissing the sheet is a normal outcome, not a failure to report.
    if (e?.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

/** Whether the OS share sheet can take a PDF, so the UI can hide a dead button. */
export function canShareFiles() {
  if (typeof navigator === 'undefined' || !navigator.canShare || typeof File === 'undefined') return false
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'probe.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

/**
 * Reads an image URL into a data URL, since pdfmake cannot fetch by itself.
 *
 * Results are cached: the letterhead mark is the same file on every document,
 * and re-reading it per download would re-decode a few hundred kilobytes each
 * time. A failure resolves to null — a missing logo must not block the PDF.
 */
const dataUrlCache = new Map()

export async function toDataUrl(src) {
  if (!src) return null
  if (src.startsWith('data:')) return src
  if (dataUrlCache.has(src)) return dataUrlCache.get(src)

  const promise = (async () => {
    try {
      const res = await fetch(src)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  })()

  dataUrlCache.set(src, promise)
  const result = await promise
  // Don't cache a failure — the next attempt may be online.
  if (!result) dataUrlCache.delete(src)
  return result
}
