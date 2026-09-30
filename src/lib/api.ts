// The app calls the API under /api on its own address. In development Vite forwards these
// calls to the local API; in production the hosting does the same.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

/** The full address of an API path, for plain links such as a shared document's PDF. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export class ApiError extends Error {
  status: number
  /** Extra details some errors carry, such as the matching patients for a repeated phone number. */
  data: Record<string, unknown> | null
  constructor(status: number, message: string, data: Record<string, unknown> | null = null) {
    super(message)
    this.status = status
    this.data = data
  }
}

// The short lived access token is kept in memory only. The longer lived sign in lives in
// an HttpOnly cookie the page cannot read, and /auth/refresh turns it into a new token.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

// The clinic whose pages are open. Each clinic has its own sign in, so refreshing names it.
let clinicSlug: string | null = null

export function setApiClinic(slug: string | null) {
  clinicSlug = slug
}

type RefreshListener = (session: unknown) => void
let onRefreshed: RefreshListener | null = null

export function onSessionRefreshed(listener: RefreshListener | null) {
  onRefreshed = listener
}

let refreshing: Promise<unknown | null> | null = null

/** Asks the API for a new access token using the sign in cookie. Returns the session, or null if signed out. */
export function refreshSession(): Promise<unknown | null> {
  if (!clinicSlug) return Promise.resolve(null)
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic: clinicSlug }),
    })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null
          return null
        }
        const session = await res.json()
        accessToken = session.access_token
        onRefreshed?.(session)
        return session
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

async function readError(res: Response): Promise<ApiError> {
  let message = res.statusText || 'Something went wrong. Please try again.'
  let data: Record<string, unknown> | null = null
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      // Form validation: FastAPI prefixes model level messages with "Value error, ".
      message = String(body.detail[0].msg).replace(/^Value error, /, '')
    } else if (body.detail && typeof body.detail === 'object') {
      data = body.detail
      if (typeof body.detail.message === 'string') message = body.detail.message
    }
  } catch {
    // The response had no JSON body.
  }
  return new ApiError(res.status, message, data)
}

/** Sends the call with the access token, and renews the token once if it ran out. */
async function send(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.')
  }

  // The access token ran out: get a new one once, then repeat the call.
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession()
    if (session) return send(path, options, false)
  }

  if (!res.ok) throw await readError(res)
  return res
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await send(path, options)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function withBody(method: string, body?: unknown): RequestInit {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) }
}

/** The file name the API suggests, from "attachment; filename=\"...\"". */
function suggestedName(res: Response): string | null {
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')
  return match ? match[1] : null
}

export interface FileDownload {
  blob: Blob
  name: string | null
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, withBody('POST', body)),
  put: <T>(path: string, body?: unknown) => request<T>(path, withBody('PUT', body)),
  patch: <T>(path: string, body?: unknown) => request<T>(path, withBody('PATCH', body)),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** A file such as a PDF or an image, fetched with the sign in like any other call. */
  async file(path: string): Promise<FileDownload> {
    const res = await send(path)
    return { blob: await res.blob(), name: suggestedName(res) }
  },
}
