import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated, verifySession } from '../lib/auth'
import { startSync } from '../lib/sync'
import SyncBanner from './SyncBanner'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  // Read once per mount. The token is what actually authorises anything; this
  // only decides whether to render the app or bounce to the login screen.
  const [signedIn, setSignedIn] = useState(() => isAuthenticated())

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    // Confirm the token with the server, then start syncing. A token the
    // server rejects (expired, or signed with a rotated secret) would
    // otherwise leave the app showing an empty database and no explanation.
    verifySession().then((session) => {
      if (cancelled) return
      if (!session) return setSignedIn(false)
      startSync()
    })
    return () => { cancelled = true }
  }, [signedIn])

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <>
      {children}
      <SyncBanner />
    </>
  )
}
