import { Link } from 'react-router-dom'
import constructionImg from '../../../image/Pasted image.png'

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-dark lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img
          src={constructionImg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/85 via-brand-dark/55 to-brand-dark/92" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-extrabold tracking-tighter text-brand shadow-lg">
            SZ
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

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/login" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-base font-extrabold tracking-tighter text-white">
              SZ
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-900">Stonezen OS</p>
              <p className="text-[11px] text-slate-500">Construction Business Management</p>
            </div>
          </Link>

          <div className="mb-7">
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand">
              Stonezen Constructions
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-[13.5px] text-slate-500">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-6 text-center text-[13px] text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
