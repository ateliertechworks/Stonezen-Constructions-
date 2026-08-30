/**
 * Keeps the browser's copy of the database and the server's copy in step.
 *
 * The whole CRM is one JSON document — the store has always serialised it in
 * full on every write — so sync moves the whole document rather than diffing
 * records. That is what lets every page stay synchronous and untouched.
 *
 * The safety of doing that rests entirely on the version check. The server
 * stores a version alongside the document; a push must say which version it
 * was editing, and the server refuses anything stale. Without that, a device
 * coming back online would overwrite everything the other device did, and
 * nothing would report that it had happened.
 */
import { getState, subscribe, applyRemoteState, isApplyingRemote } from './store'
import { get, put, getToken, ApiError } from './api'

const VERSION_KEY = 'stonezen_sync_version_v1'
const PUSH_DEBOUNCE_MS = 1500
const POLL_MS = 20_000

/* --------------------------------------------------------------- state */

let version = readVersion()
let status = 'idle' // idle | syncing | saved | offline | conflict | error
let lastError = null
let conflict = null
let timer = null
let pollTimer = null
let started = false
let pendingPush = false

function readVersion() {
  try { return Number(localStorage.getItem(VERSION_KEY)) || 0 } catch { return 0 }
}
function writeVersion(v) {
  version = Number(v) || 0
  try { localStorage.setItem(VERSION_KEY, String(version)) } catch { /* storage blocked */ }
}

const watchers = new Set()

// useSyncExternalStore compares snapshots by identity, so this must be rebuilt
// only when something actually changed. Returning a fresh object on every read
// would re-render forever.
let snapshot = { status, error: null, conflict: null, version }

function setStatus(next, err = null) {
  status = next
  lastError = err
  snapshot = { status, error: lastError, conflict, version }
  watchers.forEach((w) => w())
}

export function getSyncStatus() {
  return snapshot
}
export function watchSync(fn) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}

/* ---------------------------------------------------------------- pull */

/**
 * Fetches the server's copy and adopts it.
 *
 * A server that has never been written to returns a null document. That is the
 * first-run case: this browser's data becomes the starting point rather than
 * being wiped by an empty server.
 */
export async function pull({ adopt = true } = {}) {
  if (!getToken()) return { ok: false, reason: 'signed-out' }
  try {
    const res = await get('/state')
    if (res.blob === null) {
      // Nothing stored yet — seed the server from this browser.
      return await push({ force: true })
    }
    if (adopt && Number(res.version) !== version) {
      applyRemoteState(res.blob)
      writeVersion(res.version)
    } else {
      writeVersion(res.version)
    }
    setStatus('saved')
    return { ok: true, version: res.version }
  } catch (e) {
    setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'error', e.message)
    return { ok: false, error: e.message }
  }
}

/* ---------------------------------------------------------------- push */

/**
 * Sends the local database up, refusing to clobber a newer server copy.
 *
 * `force` is used only to seed an empty server, where version 0 is genuinely
 * what is stored and there is nothing to lose.
 */
export async function push({ force = false } = {}) {
  if (!getToken()) return { ok: false, reason: 'signed-out' }
  setStatus('syncing')
  try {
    const res = await put('/state', { version: force ? version : version, blob: getState() })
    writeVersion(res.version)
    conflict = null
    setStatus('saved')
    return { ok: true, version: res.version }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // Someone saved from another device while this one was editing. Both
      // copies are kept and the user is asked; discarding either automatically
      // would lose real work.
      conflict = {
        serverVersion: e.body?.version,
        serverBlob: e.body?.blob,
        updatedBy: e.body?.updatedBy,
        localBlob: getState(),
      }
      setStatus('conflict')
      return { ok: false, conflict }
    }
    setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'error', e.message)
    return { ok: false, error: e.message }
  }
}

/* ----------------------------------------------------- conflict resolve */

/** Takes the server's copy and throws away this device's unsaved changes. */
export async function resolveUsingServer() {
  if (!conflict) return { ok: false }
  applyRemoteState(conflict.serverBlob)
  writeVersion(conflict.serverVersion)
  conflict = null
  setStatus('saved')
  return { ok: true }
}

/** Keeps this device's copy and overwrites the server's. */
export async function resolveUsingLocal() {
  if (!conflict) return { ok: false }
  // Adopting the server's version number is what makes the next push legal;
  // the document sent is still this device's.
  writeVersion(conflict.serverVersion)
  conflict = null
  return await push()
}

/* -------------------------------------------------------------- driver */

function schedulePush() {
  if (isApplyingRemote()) return
  pendingPush = true
  clearTimeout(timer)
  // Typing in a form fires a store write per keystroke; debouncing turns a
  // sentence into one request instead of forty.
  timer = setTimeout(async () => {
    pendingPush = false
    if (status === 'conflict') return // wait for the user to choose
    await push()
  }, PUSH_DEBOUNCE_MS)
}

/**
 * Begins syncing. Safe to call more than once — only the first call arms the
 * listeners, so a re-render cannot start a second poll loop.
 */
export function startSync() {
  if (started || !getToken()) return
  started = true

  subscribe(schedulePush)

  // Catches changes made on the other device.
  pollTimer = setInterval(() => {
    if (status === 'conflict' || pendingPush) return
    pull()
  }, POLL_MS)

  // A tab returning to the foreground is the moment a stale copy is most
  // likely, and the moment the user is about to act on what they see.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && status !== 'conflict') pull()
  })

  // A tab being hidden or closed must not lose the edit still sitting in the
  // debounce. `keepalive` lets the request outlive the page; `beforeunload`
  // alone is unreliable on mobile, where tabs are killed without it.
  const flush = () => {
    if (!pendingPush || status === 'conflict') return
    pendingPush = false
    clearTimeout(timer)
    put('/state', { version, blob: getState() }, { keepalive: true })
      .then((res) => writeVersion(res.version))
      .catch(() => { /* retried by the next pull */ })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)

  pull()
}

export function stopSync() {
  started = false
  pendingPush = false
  clearTimeout(timer)
  clearInterval(pollTimer)
  conflict = null
  // The version has to go too, not just its stored copy. Signing a different
  // account in while still holding the previous one's version would make the
  // first push either falsely conflict or falsely succeed.
  writeVersion(0)
  try { localStorage.removeItem(VERSION_KEY) } catch { /* storage blocked */ }
  setStatus('idle')
}
