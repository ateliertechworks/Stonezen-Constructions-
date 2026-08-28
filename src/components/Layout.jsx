import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Hammer, FileText, ReceiptIndianRupee, Wallet, TrendingDown,
  Landmark, BellRing, Settings as SettingsIcon, Search, Menu, X, LogOut, Plus,
  ChevronDown, ChevronLeft, UserPlus, HardHat, ArrowLeftRight,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import { useStore } from '../lib/useStore'
import { followups } from '../lib/calc'
import { getSession, logout } from '../lib/auth'
import { cn } from '../lib/utils'
import { initials as _i } from '../lib/format'
import logoImg from '../../image/logo-mark.png'
import sidebarBg from '../../image/sidebar-bg.jpg'

const COLLAPSE_KEY = 'stonezen_sidebar_collapsed_v1'

/**
 * The seven modules the product is organised around.
 *
 * Billing and Accounts are parents rather than a flattened list of their
 * screens: the design reference showed one flat level, but that is not this
 * product's structure. `prefixes` decides when a group counts as active and so
 * opens itself; the children are ordinary routes, so every deep link still
 * resolves exactly as before.
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

const isGroupActive = (group, pathname) =>
  group.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** The groups that own a given route, which should show themselves expanded. */
function groupsForPath(pathname) {
  const active = {}
  NAV.forEach((n) => {
    if (n.children && isGroupActive(n, pathname)) active[n.key] = true
  })
  return active
}

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/quotations/new', label: 'New', icon: Plus, primary: true },
  { to: '/accounts', label: 'Accounts', icon: Landmark },
  { to: '/followups', label: 'Follow', icon: BellRing, badge: 'followups' },
]

/** What the "New" button offers. Each one is a real create flow. */
const CREATE_ACTIONS = [
  { to: '/quotations/new', label: 'New Quotation', icon: FileText },
  { to: '/invoices/new', label: 'New Invoice', icon: ReceiptIndianRupee },
  { to: '/clients', label: 'New Client', icon: UserPlus },
  { to: '/projects', label: 'New Project', icon: HardHat },
]

/** The solid amber pill marks the current screen; everything else stays quiet. */
const rowClass = (isActive, collapsed) =>
  cn(
    'group relative flex h-11 items-center rounded-xl text-[13.5px] font-semibold transition-colors duration-150',
    collapsed ? 'justify-center px-0' : 'gap-3 px-3.5',
    isActive
      ? 'bg-amber-400 text-slate-900 shadow-[0_2px_10px_rgba(251,191,36,0.35)]'
      : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
  )

const rowIcon = (isActive) =>
  cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-white')

function Badge({ count, isActive, collapsed }) {
  if (!count) return null
  return (
    <span
      className={cn(
        'shrink-0 rounded-full text-[10px] font-bold',
        collapsed ? 'absolute right-2 top-2 h-2 w-2 p-0' : 'px-1.5 py-0.5',
        isActive ? 'bg-slate-900 text-amber-300' : 'bg-amber-400 text-slate-900',
      )}
    >
      {collapsed ? '' : count}
    </span>
  )
}

function NavItems({ counts, onNavigate, collapsed, onExpandRail }) {
  const { pathname } = useLocation()

  // Whichever group owns the current route opens itself; anything the user
  // opened or closed by hand stays that way. Seeded from the first route and
  // adjusted during render on navigation, rather than in an effect that would
  // paint the collapsed state first and then expand it.
  const [openGroups, setOpenGroups] = useState(() => groupsForPath(pathname))
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    const active = groupsForPath(pathname)
    if (Object.keys(active).length) setOpenGroups((prev) => ({ ...prev, ...active }))
  }

  return (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const Icon = n.icon
        const count = n.badge ? counts[n.badge] : 0

        if (n.children) {
          const groupActive = isGroupActive(n, pathname)
          const expanded = !collapsed && (openGroups[n.key] ?? groupActive)
          return (
            <div key={n.key}>
              <button
                type="button"
                aria-expanded={expanded}
                title={collapsed ? n.label : undefined}
                onClick={() => {
                  // There is no room to open a submenu in the icon rail, so the
                  // first click widens the sidebar and reveals it.
                  if (collapsed) {
                    onExpandRail?.()
                    setOpenGroups((prev) => ({ ...prev, [n.key]: true }))
                    return
                  }
                  setOpenGroups((prev) => ({ ...prev, [n.key]: !expanded }))
                }}
                className={cn(rowClass(groupActive && !expanded, collapsed), 'w-full text-left')}
              >
                <Icon className={rowIcon(groupActive && !expanded)} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{n.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        groupActive && !expanded ? 'text-slate-900' : 'text-slate-400 group-hover:text-white',
                        expanded && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>

              <div
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="ml-[22px] mt-1 space-y-0.5 border-l border-white/10 pl-2.5">
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
                              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors',
                              isActive
                                ? 'bg-amber-400 text-slate-900'
                                : 'text-slate-400 hover:bg-white/[0.08] hover:text-white',
                            )
                          }
                        >
                          {CIcon && <CIcon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />}
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
            title={collapsed ? n.label : undefined}
            className={({ isActive }) => rowClass(isActive, collapsed)}
          >
            {({ isActive }) => (
              <>
                <Icon className={rowIcon(isActive)} />
                {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                <Badge count={count} isActive={isActive} collapsed={collapsed} />
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

  // Collapsing is a per-device preference, so it lives in localStorage rather
  // than the shared document store.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1')
      } catch { /* storage blocked — the preference just won't persist */ }
      return !v
    })
  }

  const counts = { followups: followups(db).length }

  // Navigating closes the mobile drawer. Done during render so the new screen
  // never paints for a frame with the drawer still over it.
  const [drawerPath, setDrawerPath] = useState(location.pathname)
  if (location.pathname !== drawerPath) {
    setDrawerPath(location.pathname)
    if (drawer) setDrawer(false)
  }

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

  // The rail itself must not clip: the collapse chevron deliberately hangs off
  // its right edge, so only the photograph is clipped, by its own wrapper.
  const sidebarContent = (isCollapsed) => (
    <div className="relative flex h-full flex-col bg-[#0C1322]">
      {/* The site photograph sits at the foot of the rail and is washed out
          upward, so the navigation always reads against near-solid colour and
          only the empty space below it shows the image. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <img src={sidebarBg} alt="" className="h-full w-full object-cover object-bottom" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C1322] via-[#0C1322]/94 to-[#0C1322]/25" />
      </div>

      {/* ------------------------------------------------------------ brand */}
      <div className={cn('relative flex items-center gap-2.5 px-4 py-5', isCollapsed && 'justify-center px-2')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-md">
          <img src={logoImg} alt="Stonezen OS" className="h-full w-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-extrabold text-white">Stonezen OS</p>
            <p className="truncate text-[13px] font-semibold text-amber-400">Constructions</p>
          </div>
        )}

        <button
          onClick={() => setDrawer(false)}
          className="ml-auto rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Desktop collapse control, matching the chevron in the reference. */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            'absolute -right-3 top-7 hidden h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#16203a] text-slate-300 shadow-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 lg:flex',
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && 'rotate-180')} />
        </button>
      </div>

      {/* -------------------------------------------------------------- nav */}
      <div className={cn('relative flex-1 overflow-y-auto pb-3', isCollapsed ? 'px-2' : 'px-3')}>
        <NavItems
          counts={counts}
          onNavigate={() => setDrawer(false)}
          collapsed={isCollapsed}
          onExpandRail={() => setCollapsed(false)}
        />
      </div>

      {/* ------------------------------------------------------------- user */}
      <div className={cn('relative border-t border-white/10 py-3', isCollapsed ? 'px-2' : 'px-3')}>
        <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-2 py-2', isCollapsed && 'justify-center px-0')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[12px] font-bold text-slate-900">
            {_i(session?.name || 'SZ')}
          </div>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold text-white">{session?.name || 'User'}</p>
                <p className="truncate text-[11px] text-slate-400">{session?.role || 'Owner'}</p>
              </div>
              <button
                onClick={doLogout}
                className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-full bg-slate-50">
      {/* Keyboard users land here first and can jump past the whole sidebar. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile drawer — always full width, never collapsed. */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={() => setDrawer(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-72 shadow-2xl animate-slide-up lg:hidden">
            {sidebarContent(false)}
          </aside>
        </>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3 sm:px-5">
          <button
            className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={submitSearch} className="relative min-w-0 flex-1 sm:max-w-lg">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search"
              placeholder="Search clients, projects, invoices, quotations…"
              className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-14 text-[13.5px] text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-400 sm:block">
              ⌘K
            </kbd>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={() => navigate('/followups')}
              className="relative rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              aria-label={
                counts.followups > 0
                  ? `Follow-ups, ${counts.followups} waiting`
                  : 'Follow-ups'
              }
            >
              <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
              {counts.followups > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold text-white">
                  {counts.followups}
                </span>
              )}
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 sm:px-4">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">New</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[196px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                >
                  {CREATE_ACTIONS.map((a) => {
                    const Icon = a.icon
                    return (
                      <DropdownMenu.Item
                        key={a.label}
                        onSelect={() => navigate(a.to)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900"
                      >
                        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {a.label}
                      </DropdownMenu.Item>
                    )
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-3 pb-24 pt-5 sm:px-5 lg:pb-8">
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
