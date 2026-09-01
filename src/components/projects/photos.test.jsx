import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ProjectPhotos from './ProjectPhotos'
import { installApiMock } from '../../../test/apiMock'
import { setToken } from '../../lib/api'
import { getState } from '../../lib/store'

/**
 * Site photos are the one thing in this app that must NOT travel in the synced
 * document — see `lib/photos.js`. These cover both halves of that: the gallery
 * works, and nothing it does leaves a trace in `getState()`.
 */

const project = { id: 'PRJ-2026-27-003', name: 'Kumar Residence' }

let api

// A real image the canvas resize path can decode is out of reach in jsdom, so
// the resize step is stubbed and the transport is what gets exercised.
const FAKE = {
  data: 'data:image/jpeg;base64,' + 'A'.repeat(200),
  thumb: 'data:image/jpeg;base64,' + 'B'.repeat(40),
  width: 1600,
  height: 1200,
}

beforeEach(() => {
  localStorage.clear()
  api = installApiMock()
  api.state.users.push({ name: 'Owner', email: 'owner@x.com', password: 'password1', role: 'Owner' })
  setToken('tok.owner@x.com')

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })
  }
  window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView ||= () => {}
  Element.prototype.hasPointerCapture ||= () => false
  Element.prototype.releasePointerCapture ||= () => {}
})

afterEach(() => {
  cleanup()
  api.restore()
  setToken(null)
})

const file = (name = 'site.jpg') => new File(['x'], name, { type: 'image/jpeg' })

async function uploadOne(caption = 'Living room after polishing') {
  const photo = { ...FAKE, caption, stage: 'Completed', takenOn: '2026-08-20' }
  const res = await fetch(`/api/projects/${project.id}/photos`, {
    method: 'POST',
    headers: { Authorization: 'Bearer tok.owner@x.com', 'Content-Type': 'application/json' },
    body: JSON.stringify(photo),
  })
  return JSON.parse(await res.text()).photo
}

describe('project photos', () => {
  it('shows an empty state before anything is uploaded', async () => {
    render(<ProjectPhotos project={project} />)
    expect(await screen.findByText('No site photos yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /add the first photo/i })).toBeTruthy()
  })

  it('lists photos already on the server, with captions and stage', async () => {
    await uploadOne('Living room after polishing')
    await uploadOne('Staircase cladding')

    render(<ProjectPhotos project={project} />)
    expect(await screen.findByText('Living room after polishing')).toBeTruthy()
    expect(screen.getByText('Staircase cladding')).toBeTruthy()
    expect(screen.getByText(/2 photos/)).toBeTruthy()
  })

  it('serves the grid from thumbnails and only fetches the full image when one is opened', async () => {
    await uploadOne('Living room after polishing')
    render(<ProjectPhotos project={project} />)
    await screen.findByText('Living room after polishing')

    const img = screen.getByAltText('Living room after polishing')
    expect(img.getAttribute('src')).toBe(FAKE.thumb)
    expect(api.state.requests.some((r) => r.path === '/photos/1')).toBe(false)

    await userEvent.click(img.closest('button'))
    await waitFor(() => expect(api.state.requests.some((r) => r.path === '/photos/1')).toBe(true))
  })

  it('removes a photo from the grid and from the server', async () => {
    await uploadOne('Living room after polishing')
    render(<ProjectPhotos project={project} />)
    await screen.findByText('Living room after polishing')

    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(await screen.findByRole('button', { name: /delete/i, hidden: false }))

    await waitFor(() => expect(api.state.photos.length).toBe(0))
  })

  // The regression that matters most: a photo in the synced blob would be
  // re-uploaded on every keystroke and would exhaust localStorage.
  it('never puts photo data into the synced document', async () => {
    await uploadOne('Living room after polishing')
    render(<ProjectPhotos project={project} />)
    await screen.findByText('Living room after polishing')

    const blob = JSON.stringify(getState())
    expect(blob).not.toContain(FAKE.data)
    expect(blob).not.toContain(FAKE.thumb)
    expect(blob).not.toContain('data:image/jpeg')
  })

  it('reports a failure instead of leaving the grid stuck loading', async () => {
    api.restore()
    globalThis.fetch = () => Promise.reject(new Error('offline'))

    render(<ProjectPhotos project={project} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/could not reach the server/i)).toBeTruthy()
  })

  it('accepts an image file through the picker', async () => {
    render(<ProjectPhotos project={project} />)
    await screen.findByText('No site photos yet.')

    const input = document.querySelector('input[type="file"]')
    expect(input.getAttribute('accept')).toBe('image/*')
    expect(input.hasAttribute('multiple')).toBe(true)
    // jsdom cannot decode an image, so the upload itself is covered by the
    // transport test above; this asserts the picker is wired and unrestricted
    // to the camera, which is what lets an earlier photo be chosen.
    expect(input.hasAttribute('capture')).toBe(false)
    expect(file().type).toBe('image/jpeg')
  })
})
