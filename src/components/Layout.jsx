import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Hammer, FileText, ReceiptIndianRupee, Wallet, TrendingDown,
  Landmark, BellRing, Settings as SettingsIcon, Search, Menu, X, LogOut, Plus,
  ChevronDown, ArrowLeftRight,
} from 'lucide-react'
import { useStore } from '../lib/useStore'
import { followups } from '../lib/calc'
import { getSession, logout } from '../lib/auth'
import { cn } from '../lib/utils'
import { initials as _i } from '../lib/format'
import { Button } from './ui/button'
import logoImg from '../../image/logo.png'

/**
 * Two of the entries are collapsible groups. `prefixes` decides when a group
 * counts as active (and so auto-expands); the children are ordinary routes, so
 * every underlying deep link keeps working exactly as before.
 */
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: Hammer },
  {
    key: 'billing',
    label: 'Billing',
    icon: FileText,
    prefixes: ['/quotations', '/invoices'],
    children: [
      { to: '/quotations', label: 'Quotations', icon: FileText },
      { to: '/invoices', label: 'Invoices', icon: ReceiptIndianRupee },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: Landmark,
    prefixes: ['/accounts'],
    children: [
      { to: '/accounts', label: 'Financial Overview', icon: Landmark, end: true },
      { to: '/accounts/payments', label: 'Payments', icon: Wallet },
      { to: '/accounts/expenses', label: 'Expenses', icon: TrendingDown },
      { to: '/accounts/ledger', label: 'Ledger / Transactions', icon: ArrowLeftRight },
    ],
  },
  { to: '/followups', label: 'Follow-ups', icon: BellRing, badge: 'followups' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/quotations/new', label: 'New', icon: Plus, primary: true },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/followups', label: 'Follow', icon: BellRing, badge: 'followups' },
]

const isGroupActive = (group, pathname) =>
  group.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

const linkClass = (isActive, compact) =>
  cn(
    'group relative flex h-10 items-center gap-3 rounded-xl pl-3.5 pr-2.5 text-[13.5px] font-semibold transition-all duration-150',
    isActive
      ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
      : 'text-navy-200 hover:bg-white/[0.07] hover:text-white',
    compact && 'h-9 text-[13px]',
  )

const ActiveBar = ({ show }) => (
  <span
    className={cn(
      'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-amber-400 transition-opacity',
      show ? 'opacity-100' : 'opacity-0',
    )}
  />
)

function NavItems({ counts, onNavigate, compact }) {
  const { pathname } = useLocation()
  const [openGroups, setOpenGroups] = useState({})

  // Whichever group owns the current route opens itself; anything the user
  // opened or closed by hand stays that way.
  useEffect(() => {
    const active = {}
    NAV.forEach((n) => {
      if (n.children && isGroupActive(n, pathname)) active[n.key] = true
    })
    if (Object.keys(active).length) setOpenGroups((prev) => ({ ...prev, ...active }))
  }, [pathname])

  return (
    <nav className="space-y-0.5">
      {NAV.map((n) => {
        const Icon = n.icon
        const count = n.badge ? counts[n.badge] : 0

        if (n.children) {
          const groupActive = isGroupActive(n, pathname)
          const expanded = openGroups[n.key] ?? groupActive
          return (
            <div key={n.key}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpenGroups((prev) => ({ ...prev, [n.key]: !expanded }))}
                className={cn(linkClass(groupActive && !expanded, compact), 'w-full text-left')}
              >
                <ActiveBar show={groupActive && !expanded} />
                <Icon
                  className={cn(
                    'h-[17px] w-[17px] shrink-0 transition-colors',
                    groupActive ? 'text-white' : 'text-navy-300 group-hover:text-white',
                  )}
                />
                <span className="flex-1 truncate">{n.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-navy-300 transition-transform duration-200 group-hover:text-white',
                    expanded && 'rotate-180',
                  )}
                />
              </button>

              <div
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
                    {n.children.map((c) => {
                      const CIcon = c.icon
                      return (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          end={c.end}
                          onClick={onNavigate}
                          tabIndex={expanded ? undefined : -1}
                          className={({ isActive }) =>
                            cn(
                              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors',
                              isActive
                                ? 'bg-white/[0.12] text-white'
                                : 'text-navy-300 hover:bg-white/[0.07] hover:text-white',
                            )
                          }
                        >
                          {CIcon && <CIcon className="h-[15px] w-[15px] shrink-0" />}
                          <span className="flex-1 truncate">{c.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) => linkClass(isActive, compact)}
          >
            {({ isActive }) => (
              <>
                <ActiveBar show={isActive} />
                <Icon className={cn('h-[17px] w-[17px] shrink-0 transition-colors', isActive ? 'text-white' : 'text-navy-300 group-hover:text-white')} />
                <span className="flex-1 truncate">{n.label}</span>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                    {count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function Layout() {
  const db = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [q, setQ] = useState('')
  const session = getSession()

  const counts = { followups: followups(db).length }

  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submitSearch = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const doLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const Sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#182f6e] via-brand-dark to-[#0f1c47]">
      <div
        className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-brand-light/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-md">
          {/* The official mark replaces the old "SZ" initials. object-contain
              keeps its aspect ratio inside the same 36px box, so nothing in
              the header shifts. */}
          <img src={logoImg} alt="Stonezen OS" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold leading-tight text-white">Stonezen OS</p>
          <p className="truncate text-[10.5px] text-navy-300">{db.settings.company.name}</p>
        </div>
        <button className="ml-auto text-navy-200 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 pb-3">
        <NavItems counts={counts} onNavigate={() => setDrawer(false)} />
      </div>

      <div className="relative border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
            {_i(session?.name || 'SZ')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{session?.name || 'User'}</p>
            <p className="truncate text-[10.5px] text-navy-300">{session?.role || 'Owner'}</p>
          </div>
          <button onClick={doLogout} className="shrink-0 rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-full bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{Sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={() => setDrawer(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-72 shadow-2xl animate-slide-up lg:hidden">{Sidebar}</aside>
        </>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-4">
          <button className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={submitSearch} className="relative min-w-0 flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients, projects, quotations, invoices…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
              ⌘K
            </kbd>
          </form>

          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
            <Button size="sm" variant="outline" onClick={() => navigate('/invoices/new')}>
              <ReceiptIndianRupee /> New Invoice
            </Button>
            <Button size="sm" onClick={() => navigate('/quotations/new')}>
              <Plus /> New Quotation
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-3 pb-24 pt-4 sm:px-4 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_NAV.map((n) => {
          const Icon = n.icon
          const count = n.badge ? counts[n.badge] : 0
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold',
                  isActive ? 'text-brand' : 'text-slate-400',
                )
              }
            >
              {n.primary ? (
                <span className="-mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                  <Icon className="h-5 w-5" />
                </span>
              ) : (
                <Icon className="h-[18px] w-[18px]" />
              )}
              <span>{n.label}</span>
              {count > 0 && (
                <span className="absolute right-[22%] top-1 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-900">
                  {count}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
