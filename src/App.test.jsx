import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

/**
 * Smoke tests that boot the real application.
 *
 * These exist because the two riskiest changes in this pass are invisible to
 * unit tests: sign-in became asynchronous (PBKDF2), and every screen moved
 * behind React.lazy. Either could leave a blank page while every library test
 * still passed.
 */

// jsdom implements neither, and Radix and the print path both reach for them.
beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })
  }
})

afterEach(cleanup)

/** The dev build pre-fills the demo credentials, so clear before typing. */
const fill = async (user, password) => {
  const email = screen.getByLabelText(/email/i)
  const pw = screen.getByLabelText(/^password/i)
  await user.clear(email)
  await user.type(email, 'stonezenconstructions@gmail.com')
  await user.clear(pw)
  await user.type(pw, password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

const signIn = (user) => fill(user, 'stonezen')

describe('application boot', () => {
  it('shows the sign-in screen when signed out', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('redirects a protected route to sign-in', async () => {
    window.history.pushState({}, '', '/invoices')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('signs in and lands on the dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /sign in/i })
    await signIn(user)

    // Proves the lazy dashboard chunk resolved and the async login completed.
    // The dashboard leads with a greeting headline rather than a "Dashboard" title.
    expect(
      await screen.findByRole('heading', { name: /what.s happening/i }, { timeout: 5000 }),
    ).toBeTruthy()
  })

  it('reports a wrong password instead of failing silently', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /sign in/i })
    await fill(user, 'wrongpassword')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('keeps the registration page closed by default', async () => {
    window.history.pushState({}, '', '/register')
    render(<App />)
    expect(await screen.findByText(/registration is closed/i)).toBeTruthy()
  })

  it('offers the recovery-code reset rather than issuing a code on screen', async () => {
    window.history.pushState({}, '', '/forgot-password')
    render(<App />)
    expect(await screen.findByLabelText(/recovery code/i)).toBeTruthy()
    // The old build printed a working reset token right here.
    expect(screen.queryByText(/code is shown here/i)).toBeNull()
  })

  it('renders a skip link for keyboard users once signed in', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /sign in/i })
    await signIn(user)
    expect(await screen.findByRole('link', { name: /skip to main content/i })).toBeTruthy()
  })
})

describe('forms are properly labelled', () => {
  it('binds every label in the new-client dialog to its control', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /sign in/i })
    await signIn(user)
    await screen.findByRole('heading', { name: /what.s happening/i }, { timeout: 5000 })

    // The sidebar renders twice (desktop rail and mobile drawer); either will do.
    await user.click(screen.getAllByRole('link', { name: /^clients$/i })[0])
    await user.click((await screen.findAllByRole('button', { name: /add client/i }))[0])

    // getByLabelText throws unless the label is actually associated.
    expect(await screen.findByLabelText(/client name/i)).toBeTruthy()
    expect(screen.getAllByLabelText(/phone/i).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/email/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/gstin/i)).toBeTruthy()
  })
})

describe('error boundary', () => {
  it('shows a recovery screen with a backup button instead of a blank page', async () => {
    const Boom = () => { throw new Error('kaboom') }
    const ErrorBoundary = (await import('./components/ErrorBoundary')).default
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><Boom /></ErrorBoundary>)

    expect(screen.getByText(/something broke on this screen/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /download backup/i })).toBeTruthy()
    spy.mockRestore()
  })
})

describe('save failures are surfaced', () => {
  it('warns when the browser refuses to store a change', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /sign in/i })
    window.dispatchEvent(new CustomEvent('stonezen:persist-failed', { detail: new Error('quota') }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not being saved/i))
  })
})
