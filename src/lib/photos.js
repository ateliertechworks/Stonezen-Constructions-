/**
 * Site photographs for a project.
 *
 * These deliberately do NOT go through the store. The CRM is one JSON document
 * that `sync.js` pushes and pulls whole — 1.5 seconds after any keystroke, and
 * again on every 20-second poll — and it is mirrored into localStorage, which
 * a browser caps at roughly 5MB. A handful of site photos in there would blow
 * that quota, and every one that fitted would be re-uploaded on each edit.
 *
 * So photos are addressed one at a time against their own table, loaded only
 * when a project is actually opened, and never enter `getState()`.
 */
import { get, post, patch, del } from './api'

/** Roughly full-screen on a phone, and small enough to store and send. */
const MAX_EDGE = 1600
const THUMB_EDGE = 480
const JPEG_QUALITY = 0.82
const THUMB_QUALITY = 0.7

/** Matches the server's cap; checked here so the user hears about it sooner. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

// Reuses the project vocabulary where it fits, so one badge palette covers both.
export const PHOTO_STAGES = ['Completed', 'In Progress', 'Before Work', 'Material', 'Issue']

/* --------------------------------------------------------------- resize */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // HEIC from an iPhone is the usual cause: Chrome and Firefox cannot
      // decode it, so say what to do rather than reporting a generic failure.
      reject(new Error('That file could not be read as an image. JPEG, PNG or WebP work everywhere.'))
    }
    img.src = url
  })
}

function drawScaled(img, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // A JPEG has no alpha channel, so a transparent PNG would otherwise come out
  // with black where it should be white.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height }
}

/**
 * Shrinks a camera photo to something worth storing.
 *
 * A phone shoots 3–6MB. Re-encoded at 1600px it is roughly 200–400KB, which is
 * still sharper than anything the app displays, and it is what keeps a project
 * with thirty photos from being a 150MB row in a database shared with seven
 * other applications.
 */
export async function prepareUpload(file) {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That photo is larger than 25MB. Take it again at a lower resolution.')
  }
  const img = await loadImage(file)
  try {
    const full = drawScaled(img, MAX_EDGE, JPEG_QUALITY)
    const thumb = drawScaled(img, THUMB_EDGE, THUMB_QUALITY)
    return { data: full.dataUrl, thumb: thumb.dataUrl, width: full.width, height: full.height }
  } finally {
    // Lets the decoder release the full-resolution bitmap straight away; a few
    // of these held at once is enough to kill a tab on a mid-range phone.
    img.src = ''
  }
}

/* ------------------------------------------------------------- requests */

export async function listPhotos(projectId) {
  const res = await get(`/projects/${encodeURIComponent(projectId)}/photos`)
  return res.photos || []
}

export async function getPhoto(id) {
  const res = await get(`/photos/${encodeURIComponent(id)}`)
  return res.photo
}

export async function uploadPhoto(projectId, file, meta = {}) {
  const prepared = await prepareUpload(file)
  const res = await post(`/projects/${encodeURIComponent(projectId)}/photos`, { ...prepared, ...meta })
  return res.photo
}

export async function updatePhoto(id, patchBody) {
  const res = await patch(`/photos/${encodeURIComponent(id)}`, patchBody)
  return res.photo
}

export async function deletePhoto(id) {
  return del(`/photos/${encodeURIComponent(id)}`)
}

/**
 * Drops a deleted project's photos.
 *
 * Best-effort on purpose: the project itself is removed from the local store
 * immediately, and failing to reach the server must not leave the user staring
 * at a project they already deleted. An orphan row costs a few hundred KB.
 */
export async function deleteProjectPhotos(projectId) {
  try {
    return await del(`/projects/${encodeURIComponent(projectId)}/photos`)
  } catch (e) {
    console.error('Stonezen: could not remove project photos', e)
    return { ok: false }
  }
}
