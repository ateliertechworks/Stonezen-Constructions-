import { formatINR, formatDate } from './format'

const digits = (phone = '') => {
  const d = String(phone).replace(/\D/g, '')
  if (!d) return ''
  return d.length === 10 ? `91${d}` : d
}

export function whatsappLink(phone, message = '') {
  const n = digits(phone)
  const text = encodeURIComponent(message)
  return n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`
}

export function mailtoLink(email, subject = '', body = '') {
  return `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function telLink(phone) {
  return `tel:${String(phone || '').replace(/\s/g, '')}`
}

export function openLink(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/* ------------------------------------------------------------- templates */

export function followupWhatsAppTemplate(client, q, total, company = {}) {
  const name = client?.contactPerson || client?.name || 'Sir/Madam'
  return [
    `Hello ${name},`,
    '',
    `Hope you are doing well. This is ${company.ceo || 'Stonezen Constructions'} following up on our quotation *${q.id}* dated ${formatDate(q.date)}.`,
    '',
    `*${q.title || 'Proposed work'}*`,
    `Quoted value: *${formatINR(total)}*`,
    q.validUntil ? `Valid until: ${formatDate(q.validUntil)}` : '',
    '',
    'Please let me know if you would like any changes to the scope or rates. Happy to visit the site again to walk through it with you.',
    '',
    `Regards,`,
    `${company.ceo || 'B. Dhanasundaran'}`,
    `${company.name || 'Stonezen Constructions'}`,
    `${company.phone || ''}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export function followupEmailTemplate(client, q, total, company = {}) {
  const name = client?.contactPerson || client?.name || 'Sir/Madam'
  const subject = `Following up — Quotation ${q.id} (${q.title || 'proposed work'})`
  const body = [
    `Dear ${name},`,
    '',
    `I hope this message finds you well. I am writing to follow up on quotation ${q.id} dated ${formatDate(q.date)} for ${q.title || 'the proposed work'} at ${q.siteAddress || 'your site'}.`,
    '',
    `Quoted value: ${formatINR(total)}`,
    q.validUntil ? `Validity: ${formatDate(q.validUntil)}` : '',
    '',
    'Do let us know if you would like any revision to the scope, specification or rates — we are glad to rework the estimate. We can also schedule a site visit at your convenience.',
    '',
    'Looking forward to hearing from you.',
    '',
    'Warm regards,',
    company.ceo || 'B. Dhanasundaran',
    company.designation || 'CEO — Stonezen Constructions',
    company.phone || '',
    company.email || '',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, body }
}

export function invoiceReminderWhatsApp(client, inv, balance, company = {}) {
  const name = client?.contactPerson || client?.name || 'Sir/Madam'
  return [
    `Hello ${name},`,
    '',
    `A gentle reminder regarding invoice *${inv.id}* dated ${formatDate(inv.date)}.`,
    `Balance due: *${formatINR(balance)}*`,
    inv.dueDate ? `Due date: ${formatDate(inv.dueDate)}` : '',
    '',
    company.bankLine || '',
    '',
    'Kindly arrange the payment at your convenience. Thank you!',
    '',
    `${company.ceo || 'B. Dhanasundaran'}`,
    `${company.name || 'Stonezen Constructions'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function invoiceReminderEmail(client, inv, balance, company = {}, banking = {}) {
  const name = client?.contactPerson || client?.name || 'Sir/Madam'
  const subject = `Payment reminder — Invoice ${inv.id}`
  const body = [
    `Dear ${name},`,
    '',
    `This is a gentle reminder for invoice ${inv.id} dated ${formatDate(inv.date)}.`,
    `Balance due: ${formatINR(balance)}`,
    inv.dueDate ? `Due date: ${formatDate(inv.dueDate)}` : '',
    '',
    'Bank details for payment:',
    `Account Number: ${banking.accountNumber || ''}`,
    `IFSC: ${banking.ifsc || ''}`,
    `Bank: ${banking.bankName || ''}`,
    banking.upi ? `UPI: ${banking.upi}` : '',
    '',
    'Please share the transaction reference once the payment is made so we can update our records.',
    '',
    'Warm regards,',
    company.ceo || 'B. Dhanasundaran',
    company.name || 'Stonezen Constructions',
    company.phone || '',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, body }
}

export function shareDocWhatsApp(client, doc, total, kind = 'Quotation', company = {}) {
  const name = client?.contactPerson || client?.name || 'Sir/Madam'
  return [
    `Hello ${name},`,
    '',
    `Please find our ${kind.toLowerCase()} *${doc.id}* for ${doc.title || doc.notes || 'the discussed work'}.`,
    `Total: *${formatINR(total)}*`,
    '',
    // WhatsApp click-to-chat carries text only — never claim an attachment here.
    'I am sending the PDF across in the next message. Do reach out for any clarification.',
    '',
    `${company.ceo || 'B. Dhanasundaran'}`,
    `${company.name || 'Stonezen Constructions'}`,
    `${company.phone || ''}`,
  ].join('\n')
}
