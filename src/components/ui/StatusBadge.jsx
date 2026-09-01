import { Badge } from './badge'

const TONES = {
  // clients
  Active: 'green', Prospect: 'blue', Inactive: 'slate', Archived: 'slate',
  // projects
  Planning: 'blue', 'In Progress': 'amber', 'On Hold': 'purple',
  Completed: 'green', Cancelled: 'red',
  // quotations
  Draft: 'slate', Sent: 'blue', Accepted: 'green', Rejected: 'red', Expired: 'amber',
  // invoices
  Paid: 'green', 'Partially Paid': 'amber', Overdue: 'red', Pending: 'amber',
  // project photos
  'Before Work': 'slate', Material: 'purple', Issue: 'red',
  // misc
  Received: 'green', high: 'red', medium: 'amber', low: 'blue',
}

export default function StatusBadge({ status, className }) {
  if (!status) return null
  return (
    <Badge tone={TONES[status] || 'slate'} className={className}>
      {status}
    </Badge>
  )
}
