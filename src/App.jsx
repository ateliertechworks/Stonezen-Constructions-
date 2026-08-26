import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientProfile from './pages/ClientProfile'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Quotations from './pages/Quotations'
import QuotationBuilder from './pages/QuotationBuilder'
import QuotationPreview from './pages/QuotationPreview'
import Invoices from './pages/Invoices'
import InvoiceBuilder from './pages/InvoiceBuilder'
import InvoicePreview from './pages/InvoicePreview'
import Accounts from './pages/Accounts'
import Followups from './pages/Followups'
import Settings from './pages/Settings'
import SearchPage from './pages/Search'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
    </BrowserRouter>
  )
}
