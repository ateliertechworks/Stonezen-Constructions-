import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  login, logout, register, getSession, isAuthenticated,
  changePassword, generateRecoveryCode, resetPasswordWithCode, hasRecoveryCode,
  isRegistrationOpen, setRegistrationOpen, updateProfile, listUsers,
} from './auth'

const USERS_KEY = 'stonezen_users_v1'
const OWNER = 'stonezenconstructions@gmail.com'

const readUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]')

beforeEach(() => localStorage.clear())

/* ---------------------------------------------------------------- login */

describe('login', () => {
  it('signs in the seeded owner account', async () => {
    const res = await login(OWNER, 'stonezen')
    expect(res.ok).toBe(true)
    expect(res.session.role).toBe('Owner')
    expect(isAuthenticated()).toBe(true)
  })

  it('is not case sensitive about the email', async () => {
    expect((await login(OWNER.toUpperCase(), 'stonezen')).ok).toBe(true)
  })

  it('rejects a wrong password', async () => {
    expect((await login(OWNER, 'nope')).ok).toBe(false)
    expect(isAuthenticated()).toBe(false)
  })

  it('gives the same message for an unknown email as for a wrong password', async () => {
    const a = await login(OWNER, 'wrong')
    const b = await login('nobody@example.com', 'wrong')
    expect(a.error).toBe(b.error)
  })

  it('never writes the password into the session', async () => {
    const { session } = await login(OWNER, 'stonezen')
    expect(JSON.stringify(session)).not.toContain('"stonezen"')
    expect(session.password).toBeUndefined()
  })
})

/* --------------------------------------------------- legacy upgrade path */

describe('legacy plain-text accounts', () => {
  const legacy = [{ name: 'Old', email: 'old@example.com', password: 'plaintext1', role: 'Owner' }]

  it('still lets an existing user sign in', async () => {
    localStorage.setItem(USERS_KEY, JSON.stringify(legacy))
    expect((await login('old@example.com', 'plaintext1')).ok).toBe(true)
  })

  it('upgrades the record to a hash on that first login', async () => {
    localStorage.setItem(USERS_KEY, JSON.stringify(legacy))
    await login('old@example.com', 'plaintext1')
    const stored = readUsers().find((u) => u.email === 'old@example.com')
    expect(stored.password).toBeUndefined()
    expect(stored.hash).toBeTruthy()
    expect(stored.salt).toBeTruthy()
  })

  it('still accepts the same password after the upgrade', async () => {
    localStorage.setItem(USERS_KEY, JSON.stringify(legacy))
    await login('old@example.com', 'plaintext1')
    logout()
    expect((await login('old@example.com', 'plaintext1')).ok).toBe(true)
  })

  it('does not lock out the seeded owner when other accounts exist', async () => {
    localStorage.setItem(USERS_KEY, JSON.stringify(legacy))
    expect((await login(OWNER, 'stonezen')).ok).toBe(true)
  })

  it('leaves no plain-text password in storage once upgraded', async () => {
    localStorage.setItem(USERS_KEY, JSON.stringify(legacy))
    await login('old@example.com', 'plaintext1')
    expect(localStorage.getItem(USERS_KEY)).not.toContain('plaintext1')
  })
})

/* ------------------------------------------------------------- register */

describe('registration', () => {
  it('is closed by default', () => {
    expect(isRegistrationOpen()).toBe(false)
  })

  it('refuses to create an account while closed', async () => {
    const res = await register({ name: 'X', email: 'x@example.com', password: 'longenough1' })
    expect(res.ok).toBe(false)
    expect(readUsers().some((u) => u.email === 'x@example.com')).toBe(false)
  })

  it('creates an account once opened', async () => {
    setRegistrationOpen(true)
    const res = await register({ name: 'X', email: 'x@example.com', password: 'longenough1' })
    expect(res.ok).toBe(true)
    expect(res.session.role).toBe('Staff')
  })

  it('stores the new password hashed, never in the clear', async () => {
    setRegistrationOpen(true)
    await register({ name: 'X', email: 'x@example.com', password: 'longenough1' })
    expect(localStorage.getItem(USERS_KEY)).not.toContain('longenough1')
  })

  it('enforces a minimum password length', async () => {
    setRegistrationOpen(true)
    expect((await register({ name: 'X', email: 'y@example.com', password: 'short' })).ok).toBe(false)
  })

  it('rejects a duplicate email', async () => {
    setRegistrationOpen(true)
    await register({ name: 'X', email: 'x@example.com', password: 'longenough1' })
    const dup = await register({ name: 'Y', email: 'X@EXAMPLE.COM', password: 'longenough2' })
    expect(dup.ok).toBe(false)
  })

  it('lets a signed-in owner add a colleague even while closed', async () => {
    await login(OWNER, 'stonezen')
    const res = await register({ name: 'Staff', email: 's@example.com', password: 'longenough1' })
    expect(res.ok).toBe(true)
  })

  it('keeps the owner signed in when they add a colleague', async () => {
    await login(OWNER, 'stonezen')
    await register({ name: 'Staff', email: 's@example.com', password: 'longenough1' })
    expect(getSession().email).toBe(OWNER)
  })
})

/* ------------------------------------------------------------- recovery */

describe('password recovery', () => {
  it('needs a session to issue a code', async () => {
    expect((await generateRecoveryCode()).ok).toBe(false)
  })

  it('issues a readable code once', async () => {
    await login(OWNER, 'stonezen')
    const res = await generateRecoveryCode()
    expect(res.ok).toBe(true)
    expect(res.code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/)
  })

  it('stores only a hash, so the code cannot be read back', async () => {
    await login(OWNER, 'stonezen')
    const { code } = await generateRecoveryCode()
    expect(localStorage.getItem('stonezen_recovery_v1')).not.toContain(code)
  })

  it('resets the password with a valid code', async () => {
    await login(OWNER, 'stonezen')
    const { code } = await generateRecoveryCode()
    logout()
    expect((await resetPasswordWithCode(OWNER, code, 'brandnewpass')).ok).toBe(true)
    expect((await login(OWNER, 'brandnewpass')).ok).toBe(true)
  })

  it('refuses the old password after a reset', async () => {
    await login(OWNER, 'stonezen')
    const { code } = await generateRecoveryCode()
    await resetPasswordWithCode(OWNER, code, 'brandnewpass')
    expect((await login(OWNER, 'stonezen')).ok).toBe(false)
  })

  it('spends the code, so it cannot be replayed', async () => {
    await login(OWNER, 'stonezen')
    const { code } = await generateRecoveryCode()
    await resetPasswordWithCode(OWNER, code, 'brandnewpass')
    expect((await resetPasswordWithCode(OWNER, code, 'anotherpass1')).ok).toBe(false)
  })

  it('rejects a wrong code', async () => {
    await login(OWNER, 'stonezen')
    await generateRecoveryCode()
    expect((await resetPasswordWithCode(OWNER, 'AAAAA-BBBBB-CCCCC-DDDDD', 'brandnewpass')).ok).toBe(false)
  })

  it('cannot reset an account that has no code set', async () => {
    expect((await resetPasswordWithCode(OWNER, 'AAAAA-BBBBB-CCCCC-DDDDD', 'brandnewpass')).ok).toBe(false)
  })

  it('does not reveal whether an account exists', async () => {
    const a = await resetPasswordWithCode(OWNER, 'AAAAA-BBBBB-CCCCC-DDDDD', 'brandnewpass')
    const b = await resetPasswordWithCode('ghost@example.com', 'AAAAA-BBBBB-CCCCC-DDDDD', 'brandnewpass')
    expect(a.error).toBe(b.error)
  })

  it('replaces the previous code when a new one is generated', async () => {
    await login(OWNER, 'stonezen')
    const first = (await generateRecoveryCode()).code
    await generateRecoveryCode()
    expect((await resetPasswordWithCode(OWNER, first, 'brandnewpass')).ok).toBe(false)
  })

  it('reports whether a code is set', async () => {
    await login(OWNER, 'stonezen')
    expect(hasRecoveryCode()).toBe(false)
    await generateRecoveryCode()
    expect(hasRecoveryCode()).toBe(true)
  })
})

/* ------------------------------------------------------ change password */

describe('changing a password', () => {
  it('requires the current password', async () => {
    await login(OWNER, 'stonezen')
    expect((await changePassword('wrong', 'brandnewpass')).ok).toBe(false)
  })

  it('changes it when the current password is right', async () => {
    await login(OWNER, 'stonezen')
    expect((await changePassword('stonezen', 'brandnewpass')).ok).toBe(true)
    logout()
    expect((await login(OWNER, 'brandnewpass')).ok).toBe(true)
  })

  it('enforces the minimum length', async () => {
    await login(OWNER, 'stonezen')
    expect((await changePassword('stonezen', 'short')).ok).toBe(false)
  })
})

/* --------------------------------------------------------- session/profile */

describe('session and profile', () => {
  it('drops an expired session', async () => {
    await login(OWNER, 'stonezen')
    const s = JSON.parse(localStorage.getItem('stonezen_auth_v1'))
    localStorage.setItem('stonezen_auth_v1', JSON.stringify({ ...s, expires: Date.now() - 1 }))
    expect(getSession()).toBeNull()
  })

  it('keeps a live session', async () => {
    await login(OWNER, 'stonezen')
    expect(getSession()).not.toBeNull()
  })

  it('updates the display name', async () => {
    await login(OWNER, 'stonezen')
    updateProfile({ name: 'New Name' })
    expect(getSession().name).toBe('New Name')
  })

  it('refuses to escalate a role through a profile edit', async () => {
    setRegistrationOpen(true)
    await register({ name: 'Staff', email: 's@example.com', password: 'longenough1' })
    updateProfile({ role: 'Owner', hash: 'x' })
    expect(getSession().role).toBe('Staff')
    expect(readUsers().find((u) => u.email === 's@example.com').role).toBe('Staff')
  })

  it('lists users without exposing credentials', async () => {
    const users = listUsers()
    expect(users[0].hash).toBeUndefined()
    expect(users[0].password).toBeUndefined()
  })
})

/* ----------------------------------------------------- production install */

/**
 * The demo account is compiled out of a production build, so these load a fresh
 * copy of the module with DEV stubbed off rather than stubbing after import.
 */
async function prodAuth() {
  localStorage.clear()
  vi.stubEnv('DEV', false)
  vi.resetModules()
  return import('./auth')
}

describe('a production install ships no working password', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('seeds no demo account', async () => {
    const a = await prodAuth()
    expect(a.listUsers()).toHaveLength(0)
  })

  it('refuses the demo credentials that work in development', async () => {
    const a = await prodAuth()
    expect((await a.login(OWNER, 'stonezen')).ok).toBe(false)
  })

  it('reports that first-run setup is needed', async () => {
    const a = await prodAuth()
    expect(a.needsFirstRunSetup()).toBe(true)
  })

  it('lets the first account be created even though sign-up is closed', async () => {
    const a = await prodAuth()
    expect(a.isRegistrationOpen()).toBe(false)
    const res = await a.register({ name: 'Owner', email: 'owner@example.com', password: 'longenough1' })
    expect(res.ok).toBe(true)
    expect(res.session.role).toBe('Owner')
  })

  it('closes sign-up again once the owner exists', async () => {
    const a = await prodAuth()
    await a.register({ name: 'Owner', email: 'owner@example.com', password: 'longenough1' })
    a.logout()
    expect(a.needsFirstRunSetup()).toBe(false)
    expect((await a.register({ name: 'Other', email: 'other@example.com', password: 'longenough1' })).ok).toBe(false)
  })

  it('makes only the first account an owner', async () => {
    const a = await prodAuth()
    await a.register({ name: 'Owner', email: 'owner@example.com', password: 'longenough1' })
    const staff = await a.register({ name: 'Staff', email: 'staff@example.com', password: 'longenough1' })
    expect(staff.ok).toBe(true)
    expect(a.listUsers().find((u) => u.email === 'staff@example.com').role).toBe('Staff')
  })
})
