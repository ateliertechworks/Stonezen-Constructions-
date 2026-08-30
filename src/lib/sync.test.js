import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { installApiMock } from '../../test/apiMock'
import * as sync from './sync'
import { setToken } from './api'
import { getState, addClient, clearData } from './store'

/**
 * The version check is the only thing standing between whole-document sync and
 * silent data loss: a stale push does not lose one record, it loses every
 * change the other device made. These tests exist for that one behaviour.
 */
let api

beforeEach(() => {
  localStorage.clear()
  sync.stopSync()
  clearData()
  api = installApiMock()
  api.state.users.push({ name: 'Owner', email: 'owner@example.com', password: 'longenough', role: 'Owner' })
  setToken('tok.owner@example.com')
})

afterEach(() => {
  sync.stopSync()
  api.restore()
})

describe('first sync against an empty server', () => {
  it('uploads this browser rather than being wiped by the empty server', async () => {
    addClient({ name: 'Ramesh Traders' })
    const res = await sync.pull()

    expect(res.ok).toBe(true)
    expect(api.state.version).toBe(1)
    expect(api.state.blob.clients.map((c) => c.name)).toContain('Ramesh Traders')
  })
})

describe('a server that was reset while this browser kept syncing', () => {
  it('seeds it again instead of showing a conflict on a fresh install', async () => {
    // Sync normally, so this browser is holding a version above zero.
    addClient({ name: 'Before The Reset' })
    await sync.pull()
    expect(sync.getSyncStatus().version).toBeGreaterThan(0)

    // The database is recreated: back to version 0 with nothing stored.
    api.state.version = 0
    api.state.blob = null

    const res = await sync.pull()

    expect(res.ok).toBe(true)
    expect(sync.getSyncStatus().status).not.toBe('conflict')
    expect(api.state.blob.clients.map((c) => c.name)).toContain('Before The Reset')
  })
})

describe('pulling a database saved elsewhere', () => {
  it('adopts it into the local store', async () => {
    api.remoteWrite({ ...getState(), clients: [{ id: 'CL-2026-001', name: 'From The Office PC' }] })

    await sync.pull()

    expect(getState().clients.map((c) => c.name)).toEqual(['From The Office PC'])
  })
})

describe('a push that would overwrite newer work', () => {
  it('is refused, and keeps both copies for the user to choose from', async () => {
    addClient({ name: 'Typed On This Laptop' })
    await sync.pull() // seeds the server at version 1

    // Meanwhile the office PC saves. This browser still believes it is on v1.
    api.remoteWrite({ ...getState(), clients: [{ id: 'CL-2026-009', name: 'Typed On The Office PC' }] })

    addClient({ name: 'Second Local Edit' })
    const res = await sync.push()

    expect(res.ok).toBe(false)
    expect(sync.getSyncStatus().status).toBe('conflict')
    // Neither copy has been thrown away.
    expect(res.conflict.serverBlob.clients.map((c) => c.name)).toContain('Typed On The Office PC')
    expect(res.conflict.localBlob.clients.map((c) => c.name)).toContain('Second Local Edit')
  })

  it('leaves the server untouched while the conflict is unresolved', async () => {
    await sync.pull()
    api.remoteWrite({ ...getState(), clients: [{ id: 'CL-2026-009', name: 'Office' }] })
    const versionBefore = api.state.version

    addClient({ name: 'Local' })
    await sync.push()

    expect(api.state.version).toBe(versionBefore)
    expect(api.state.blob.clients.map((c) => c.name)).toEqual(['Office'])
  })
})

describe('resolving a conflict', () => {
  const conflict = async () => {
    await sync.pull()
    api.remoteWrite({ ...getState(), clients: [{ id: 'CL-2026-009', name: 'Office Copy' }] })
    addClient({ name: 'Laptop Copy' })
    await sync.push()
  }

  it('can take the other device and discard local changes', async () => {
    await conflict()
    await sync.resolveUsingServer()

    expect(getState().clients.map((c) => c.name)).toEqual(['Office Copy'])
    expect(sync.getSyncStatus().status).toBe('saved')
  })

  it('can keep this device and overwrite the other', async () => {
    await conflict()
    const res = await sync.resolveUsingLocal()

    expect(res.ok).toBe(true)
    expect(api.state.blob.clients.map((c) => c.name)).toContain('Laptop Copy')
    expect(sync.getSyncStatus().status).toBe('saved')
  })

  it('lets a normal save work again afterwards', async () => {
    await conflict()
    await sync.resolveUsingServer()

    addClient({ name: 'Added After Resolving' })
    const res = await sync.push()

    expect(res.ok).toBe(true)
    expect(api.state.blob.clients.map((c) => c.name)).toContain('Added After Resolving')
  })
})

describe('an unreachable server', () => {
  it('reports offline without losing local data', async () => {
    addClient({ name: 'Written While Offline' })
    globalThis.fetch = () => Promise.reject(new Error('network down'))

    const res = await sync.push()

    expect(res.ok).toBe(false)
    expect(sync.getSyncStatus().status).toBe('offline')
    expect(getState().clients.map((c) => c.name)).toContain('Written While Offline')
  })
})

describe('the status snapshot', () => {
  it('keeps the same identity between reads, so React does not loop', () => {
    expect(sync.getSyncStatus()).toBe(sync.getSyncStatus())
  })
})
