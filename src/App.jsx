import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import StorageWarning from './components/StorageWarning'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

/**
 * Routes load on demand.
 *
 * Recharts and the drag-and-drop builder are the two heaviest dependencies in
 * the app, and neither is needed to render the login form. Splitting here keeps
 * them out of the first download on a site mobile connection.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clients = lazy(() => import('./pages/Clients'))
const ClientProfile = lazy(() => import('./pages/ClientProfile'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Quotations = lazy(() => import('./pages/Quotations'))
const QuotationBuilder = lazy(() => import('./pages/QuotationBuilder'))
const QuotationPreview = lazy(() => import('./pages/QuotationPreview'))
const Invoices = lazy(() => import('./pages/Invoices'))
const InvoiceBuilder = lazy(() => import('./pages/InvoiceBuilder'))
const InvoicePreview = lazy(() => import('./pages/InvoicePreview'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Followups = lazy(() => import('./pages/Followups'))
const Settings = lazy(() => import('./pages/Settings'))
const SearchPage = lazy(() => import('./pages/Search'))

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand" aria-hidden="true" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StorageWarning />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Reset is a single step now — kept so existing links resolve. */}
            <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />

              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientProfile />} />

              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />

              <Route path="/quotations" element={<Quotations />} />
              <Route path="/quotations/new" element={<QuotationBuilder />} />
              <Route path="/quotations/:id/edit" element={<QuotationBuilder />} />
              <Route path="/quotations/:id/preview" element={<QuotationPreview />} />

              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceBuilder />} />
              <Route path="/invoices/:id/edit" element={<InvoiceBuilder />} />
              <Route path="/invoices/:id/preview" element={<InvoicePreview />} />

              {/* Accounts is the financial workspace: payments, expenses and the
                  transaction ledger are tabs inside it rather than separate pages. */}
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:tab" element={<Accounts />} />

              {/* Former top-level routes — kept so existing deep links resolve. */}
              <Route path="/payments" element={<Navigate to="/accounts/payments" replace />} />
              <Route path="/expenses" element={<Navigate to="/accounts/expenses" replace />} />
              <Route path="/documents" element={<Navigate to="/quotations" replace />} />

              <Route path="/followups" element={<Followups />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/search" element={<SearchPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
