/**
 * An in-memory stand-in for the Stonezen API.
 *
 * The client's job is now to talk to a server correctly — cache a session,
 * drop a rejected token, refuse to clobber a newer document — and none of that
 * can be tested against a store that never leaves the browser. This mirrors the
 * real endpoints closely enough that the tests exercise the real code paths,
 * including the 409 that guards against overwriting another device's work.
 */
/** The listing endpoint sends thumbnails only; the full image is fetched by id. */
const withoutData = (photo) => {
  const copy = { ...photo }
  delete copy.data
  return copy
}

export function installApiMock() {
  const state = {
    users: [],
    registrationOpen: false,
    version: 0,
    blob: null,
    requests: [],
    // Photos live outside the synced document, so they get their own store
    // here too — a test that finds them in `blob` has caught a real regression.
    photos: [],
    nextPhotoId: 1,
    photoLimit: 60,
  }

  const token = (u) => `tok.${u.email}`
  const userFor = (auth) => {
    if (!auth?.startsWith('Bearer tok.')) return null
    const email = auth.slice('Bearer tok.'.length)
    return state.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
  }
  const json = (status, body) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    })

  const original = globalThis.fetch

  globalThis.fetch = (url, opts = {}) => {
    const path = String(url).replace(/^.*\/api/, '')
    const method = opts.method || 'GET'
    const body = opts.body ? JSON.parse(opts.body) : null
    const me = userFor(opts.headers?.Authorization)
    state.requests.push({ path, method })

    if (path === '/health') return json(200, { ok: true, db: true })

    if (path === '/auth/bootstrap') {
      return json(200, {
        needsFirstRunSetup: state.users.length === 0,
        registrationOpen: state.registrationOpen,
      })
    }

    if (path === '/auth/login' && method === 'POST') {
      const u = state.users.find((x) => x.email.toLowerCase() === String(body.email).toLowerCase())
      if (!u || u.password !== body.password) return json(401, { error: 'Incorrect email or password.' })
      return json(200, { token: token(u), user: { name: u.name, email: u.email, role: u.role } })
    }

    if (path === '/auth/register' && method === 'POST') {
      const firstRun = state.users.length === 0
      if (!firstRun && !state.registrationOpen) {
        return json(403, { error: 'New accounts are closed. Ask the account owner to open registration in Settings → Security.' })
      }
      if (String(body.password || '').length < 8) return json(400, { error: 'Password must be at least 8 characters.' })
      if (state.users.some((x) => x.email.toLowerCase() === String(body.email).toLowerCase())) {
        return json(409, { error: 'An account with that email already exists.' })
      }
      const u = { name: body.name, email: body.email, password: body.password, role: firstRun ? 'Owner' : 'Staff' }
      state.users.push(u)
      return json(201, { token: token(u), user: { name: u.name, email: u.email, role: u.role } })
    }

    if (path === '/auth/me') {
      if (!me) return json(401, { error: 'Not signed in.' })
      return json(200, { user: { name: me.name, email: me.email, role: me.role } })
    }

    if (path === '/auth/registration' && method === 'POST') {
      if (!me) return json(401, { error: 'Not signed in.' })
      if (me.role !== 'Owner') return json(403, { error: 'Owner only.' })
      state.registrationOpen = body.open === true
      return json(200, { ok: true, registrationOpen: state.registrationOpen })
    }

    if (path === '/state' && method === 'GET') {
      if (!me) return json(401, { error: 'Not signed in.' })
      return json(200, { version: state.version, blob: state.blob })
    }

    if (path === '/state' && method === 'PUT') {
      if (!me) return json(401, { error: 'Not signed in.' })
      if (body.version !== state.version) {
        return json(409, {
          error: 'The saved data changed on another device.',
          version: state.version,
          blob: state.blob,
          updatedBy: 'someone@else.com',
        })
      }
      state.version += 1
      state.blob = body.blob
      return json(200, { ok: true, version: state.version })
    }

    /* ------------------------------------------------------------ photos */

    const listMatch = path.match(/^\/projects\/([^/]+)\/photos$/)
    if (listMatch) {
      if (!me) return json(401, { error: 'Not signed in.' })
      const projectId = decodeURIComponent(listMatch[1])

      if (method === 'GET') {
        // Thumbnails only, exactly as the real endpoint does.
        const photos = state.photos.filter((p) => p.projectId === projectId).map(withoutData)
        return json(200, { photos })
      }

      if (method === 'POST') {
        if (state.photos.filter((p) => p.projectId === projectId).length >= state.photoLimit) {
          return json(409, { error: `A project can hold ${state.photoLimit} photos. Delete one before adding another.` })
        }
        if (typeof body?.data !== 'string' || !body.data.startsWith('data:image/')) {
          return json(400, { error: 'Expected a base64 JPEG, PNG or WebP data URL.' })
        }
        const photo = {
          id: String(state.nextPhotoId++),
          projectId,
          caption: body.caption || '',
          stage: body.stage || 'Completed',
          takenOn: body.takenOn || null,
          mime: 'image/jpeg',
          width: body.width || 0,
          height: body.height || 0,
          bytes: body.data.length,
          thumb: body.thumb,
          data: body.data,
          createdAt: new Date().toISOString(),
          createdBy: me.email,
        }
        state.photos.push(photo)
        return json(201, { photo })
      }

      if (method === 'DELETE') {
        const before = state.photos.length
        state.photos = state.photos.filter((p) => p.projectId !== projectId)
        return json(200, { ok: true, deleted: before - state.photos.length })
      }
    }

    const oneMatch = path.match(/^\/photos\/([^/]+)$/)
    if (oneMatch) {
      if (!me) return json(401, { error: 'Not signed in.' })
      const id = decodeURIComponent(oneMatch[1])
      const photo = state.photos.find((p) => p.id === id)
      if (!photo) return json(404, { error: 'Photo not found.' })

      if (method === 'GET') return json(200, { photo })
      if (method === 'PATCH') {
        if (body?.caption !== undefined) photo.caption = body.caption
        if (body?.stage !== undefined) photo.stage = body.stage
        if (body?.takenOn !== undefined) photo.takenOn = body.takenOn
        return json(200, { photo: withoutData(photo) })
      }
      if (method === 'DELETE') {
        state.photos = state.photos.filter((p) => p.id !== id)
        return json(200, { ok: true })
      }
    }

    return json(404, { error: `No route for ${method} ${path}` })
  }

  return {
    state,
    /** Simulates another device saving, which is what makes the next push stale. */
    remoteWrite(blob) {
      state.version += 1
      state.blob = blob
    },
    restore() {
      globalThis.fetch = original
    },
  }
}
