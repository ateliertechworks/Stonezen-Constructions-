import { Link } from 'react-router-dom'
import constructionImg from '../../../image/login.png'
import logoImg from '../../../image/logo.png'

export default function AuthShell({ title, subtitle, children, footer, aside }) {
  return (
    <div className="auth-root relative flex min-h-screen bg-white">
      {/* Mobile/tablet backdrop. Desktop (lg+) keeps the original split layout
          untouched — this whole layer is removed at lg. */}
      <div className="absolute inset-0 overflow-hidden lg:hidden" aria-hidden="true">
        <img src={constructionImg} alt="" className="h-full w-full object-cover object-center" />
        {/* Just enough tint to carry white text over a busy photo — the site,
            the cranes and the crew all stay readable through it. Darker at the
            edges than in the middle so the glass has something to sit against.
            Every stop must be a multiple of 5 — Tailwind silently drops /92. */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/55 via-brand-dark/35 to-brand-dark/65" />
      </div>

      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-dark lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img
          src={constructionImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/85 via-brand-dark/55 to-brand-dark/92" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img src={logoImg} alt="Stonezen Constructions" className="h-full w-full object-contain p-0.5" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Stonezen OS</p>
            <p className="text-xs text-navy-200">Construction Business Management</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white drop-shadow-sm">
            From site visit to final payment — one place.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-navy-100">
            Quotations, GST invoices, milestone payments, site expenses and client follow-ups,
            built for how a contracting business actually runs.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-white">
            {[
              ['Quotations', 'drag-and-drop builder'],
              ['GST Invoices', 'CGST / SGST / IGST'],
              ['Ledgers', 'client-wise balances'],
            ].map(([h, s]) => (
              <div key={h}>
                <p className="text-[13px] font-bold">{h}</p>
                <p className="text-[11px] text-navy-200">{s}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[11px] text-navy-200">
          ER. B. Dhanasundaran · Building Consultant &amp; Contractor · Coimbatore
        </p>
      </div>

      {/* Form panel. `auth-glass` scopes the mobile-only glass styling in
          index.css; it is inert at lg and above. */}
      <div className="auth-glass relative flex w-full flex-col justify-center px-4 py-6 sm:px-10 sm:py-10 lg:w-1/2 lg:px-16 lg:py-10">
        {/* Logo — its own floating element above the panel, not inside it.
            logo.png is RGB with no alpha, so the artwork carries its own white.
            Rather than let that read as a bare tile, it sits inside a translucent
            glass frame: the frame is the floating element, the white is just the
            mark's own paper. lg:hidden, so the desktop logo is untouched. */}
        <Link to="/login" className="mx-auto mb-4 flex w-full max-w-sm justify-center lg:hidden">
          <span className="inline-flex rounded-[1.4rem] border border-white/30 bg-white/[0.14] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-[10px]">
            <img
              src={logoImg}
              alt="Stonezen Constructions"
              className="h-16 w-16 rounded-2xl object-contain sm:h-20 sm:w-20"
            />
          </span>
        </Link>

        {/* Main glass surface. A top-to-bottom fade plus an inset highlight
            along the top edge is what separates "glass" from "flat grey panel":
            the sheet catches light where it faces up. Blur stays moderate so the
            building behind it is still legible.

            The blur lives on `.glass-panel` in index.css rather than in a
            backdrop-blur utility: Tailwind composes every backdrop-* utility
            into one shared property, so a saturate here would keep applying a
            real backdrop-filter at lg — enough to switch desktop text to
            greyscale antialiasing. Every other lg: utility below resets a
            mobile one, leaving the desktop form byte-identical. */}
        <div className="glass-panel mx-auto w-full max-w-sm rounded-3xl border border-white/30 bg-gradient-to-b from-white/[0.26] via-white/[0.16] to-white/[0.10] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.45)] sm:p-6 lg:rounded-none lg:border-0 lg:bg-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-5 lg:mb-7">
            {/* The mobile logo already carries the wordmark, so this line is desktop-only. */}
            <p className="hidden text-[13px] font-bold uppercase tracking-[0.16em] text-brand lg:block">
              Stonezen Constructions
            </p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl lg:mt-2 lg:text-2xl">{title}</h1>
            {subtitle && <p className="glass-sub mt-1.5 text-[13.5px] text-slate-500">{subtitle}</p>}
          </div>

          {children}
        </div>

        {/* Secondary floating panel (e.g. the demo-account note). lg:mt-4 keeps
            the desktop gap identical to the space-y-4 it used to inherit from
            the form, so moving it out of the card shifts nothing on desktop. */}
        {aside && <div className="mx-auto mt-3 w-full max-w-sm lg:mt-4">{aside}</div>}

        {footer && (
          <div className="glass-note mx-auto mt-5 w-full max-w-sm text-center text-[13px] text-slate-500 lg:mt-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
