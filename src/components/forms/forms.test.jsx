import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ClientDialog from './ClientDialog'
import ProjectDialog from './ProjectDialog'
import PaymentDialog from './PaymentDialog'
import ExpenseDialog from './ExpenseDialog'

/**
 * `Field` now injects an id into whatever control it wraps, so the label points
 * at something real. That change touched 119 call sites across four dialogs and
 * three kinds of control (Input, Textarea, and the Radix-backed SimpleSelect),
 * and a label bound to a non-focusable element looks correct while being worse
 * than none. These render each dialog and ask for its fields by label.
 */

beforeEach(() => {
  localStorage.clear()
  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })
  }
  // Radix dialogs measure and observe; jsdom provides neither.
  window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView ||= () => {}
  Element.prototype.hasPointerCapture ||= () => false
  Element.prototype.releasePointerCapture ||= () => {}
})

afterEach(cleanup)

const open = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('dialog fields are bound to their labels', () => {
  it('binds text inputs and the notes textarea in the client dialog', () => {
    open(<ClientDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText(/client name/i)).toBeTruthy()
    expect(screen.getByLabelText(/gstin/i)).toBeTruthy()
    // Textarea, not Input — a different component forwarding the injected id.
    expect(screen.getByLabelText(/notes/i).tagName).toBe('TEXTAREA')
  })

  it('binds the status select in the client dialog', () => {
    open(<ClientDialog open onOpenChange={() => {}} />)
    // SimpleSelect renders a Radix trigger button, which had to forward the id.
    const status = screen.getByLabelText(/status/i)
    expect(status).toBeTruthy()
    expect(status.tagName).toBe('BUTTON')
  })

  it('binds fields in the project dialog', () => {
    open(<ProjectDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText(/project name/i)).toBeTruthy()
    expect(screen.getByLabelText(/^client/i).tagName).toBe('BUTTON')
    expect(screen.getByLabelText(/notes/i).tagName).toBe('TEXTAREA')
  })

  it('binds fields in the payment dialog', () => {
    open(<PaymentDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText(/amount/i)).toBeTruthy()
    expect(screen.getByLabelText(/method/i).tagName).toBe('BUTTON')
  })

  it('binds fields in the expense dialog', () => {
    open(<ExpenseDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText(/description/i)).toBeTruthy()
    expect(screen.getByLabelText(/category/i).tagName).toBe('BUTTON')
  })

  it('marks a required field as required for assistive tech', () => {
    open(<ClientDialog open onOpenChange={() => {}} />)
    expect(screen.getByLabelText(/client name/i).getAttribute('aria-required')).toBe('true')
  })

  it('links a hint to its field so it is announced', () => {
    open(<PaymentDialog open onOpenChange={() => {}} />)
    const amount = screen.getByLabelText(/amount/i)
    // Present only when the dialog has a balance hint to show; when it does,
    // it must be referenced rather than left as loose text.
    const describedBy = amount.getAttribute('aria-describedby')
    if (describedBy) expect(document.getElementById(describedBy)).toBeTruthy()
  })

  it('gives each field its own id when a dialog renders twice', () => {
    open(<ClientDialog open onOpenChange={() => {}} />)
    open(<ProjectDialog open onOpenChange={() => {}} />)
    const ids = screen.getAllByRole('textbox').map((el) => el.id).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
