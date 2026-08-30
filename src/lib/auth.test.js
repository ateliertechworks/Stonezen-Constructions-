import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { installApiMock } from '../../test/apiMock'
import * as a from './auth'

/**
 * Auth now lives on the server, so these no longer test hashing — that moved
 * with it. What is left in the browser is the part that can still go wrong
 * here: caching a session so the router can read it synchronously, dropping a
 * token the server rejects, and turning a failed request into a message a
 * person can act on rather than an unhandled rejection.
 */
let api

beforeEach(() => {
  localStorage.clear()
  api = installApiMock()
})

afterEach(() => api.restore())

describe('first run', () => {
  it('reports that no owner exists yet', async () => {
    expect(await a.needsFirstRunSetup()).toBe(true)
  })

  it('stops reporting first run once the owner is created', async () => {
    await a.register({ name: 'Owner', email: 'owner@example.com', password: 'longenough' })
    expect(await a.needsFirstRunSetup()).toBe(false)
  })

  it('makes the first account the owner and later ones staff', async () => {
    const owner = await a.register({ name: 'Owner', email: 'owner@example.com', password: 'longenough' })
    expect(owner.session.role).toBe('Owner')

    await a.setRegistrationOpen(true)
    const staff = await a.register({ name: 'Staff', email: 'staff@example.com', password: 'longenough' })
    expect(staff.ok).toBe(true)
    expect(api.state.users.find((u) => u.email === 'staff@example.com').role).toBe('Staff')
  })
})

describe('registration gate', () => {
  it('is closed once an owner exists', async () => {
    api.state.users.push({ name: 'O', email: 'o@e.com', password: 'longenough', role: 'Owner' })
    const res = await a.register({ name: 'X', email: 'x@e.com', password: 'longenough' })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/closed/i)
  })
})

describe('sign in', () => {
  beforeEach(() => {
    api.state.users.push({ name: 'Owner', email: 'owner@example.com', password: 'longenough', role: 'Owner' })
  })

  it('rejects a wrong password with the server message', async () => {
    const res = await a.login('owner@example.com', 'wrong')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/incorrect email or password/i)
    expect(a.isAuthenticated()).toBe(false)
  })

  it('caches the session so the router can read it synchronously', async () => {
    const res = await a.login('owner@example.com', 'longenough')
    expect(res.ok).toBe(true)
    // The value the router actually reads, with no awaiting.
    expect(a.isAuthenticated()).toBe(true)
    expect(a.getSession().email).toBe('owner@example.com')
  })

  it('never writes the password into storage', async () => {
    await a.login('owner@example.com', 'longenough')
    expect(JSON.stringify(localStorage)).not.toContain('longenough')
  })

  it('signs out completely', async () => {
    await a.login('owner@example.com', 'longenough')
    a.logout()
    expect(a.isAuthenticated()).toBe(false)
    expect(a.getSession()).toBe(null)
  })
})

describe('a token the server will not accept', () => {
  it('is discarded rather than left to fail forever', async () => {
    api.state.users.push({ name: 'Owner', email: 'owner@example.com', password: 'longenough', role: 'Owner' })
    await a.login('owner@example.com', 'longenough')
    expect(a.isAuthenticated()).toBe(true)

    // The account is gone, so /auth/me answers 401.
    api.state.users.length = 0
    expect(await a.verifySession()).toBe(null)
    expect(a.isAuthenticated()).toBe(false)
  })

  it('does not sign the user out merely because the network failed', async () => {
    api.state.users.push({ name: 'Owner', email: 'owner@example.com', password: 'longenough', role: 'Owner' })
    await a.login('owner@example.com', 'longenough')

    globalThis.fetch = () => Promise.reject(new Error('network down'))
    const session = await a.verifySession()
    expect(session).not.toBe(null)
    expect(a.isAuthenticated()).toBe(true)
  })
})

describe('an unreachable server', () => {
  it('reports a readable error instead of throwing', async () => {
    globalThis.fetch = () => Promise.reject(new Error('network down'))
    const res = await a.login('owner@example.com', 'longenough')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/could not reach/i)
  })

  it('does not claim a first run it cannot verify', async () => {
    globalThis.fetch = () => Promise.reject(new Error('network down'))
    // Offering "create the owner account" while the server is unreachable would
    // invite a second owner to be created against a database that has one.
    expect(await a.needsFirstRunSetup()).toBe(false)
    expect((await a.bootstrap()).unreachable).toBe(true)
  })
})
