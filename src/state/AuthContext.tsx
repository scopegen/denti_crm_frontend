import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, onSessionRefreshed, refreshSession, setAccessToken, setApiClinic } from '../lib/api'
import { toStaff, type Clinic, type RawLoginResponse, type RawSession, type Staff } from '../types/auth'

export interface CodeChallenge {
  challengeId: string
  sentTo: string
  resendAfterSeconds: number
}

interface AuthContextValue {
  /** The clinic name in the web address, for example "smile-dental". */
  clinicSlug: string
  staff: Staff | null
  clinic: Clinic | null
  loading: boolean
  /** Step one. Returns the emailed code challenge, or null when a trusted device signed straight in. */
  login: (email: string, password: string) => Promise<CodeChallenge | null>
  /** Step two: the 6 digit code from the email. */
  verify: (challengeId: string, code: string, trustDevice: boolean) => Promise<void>
  resend: (challengeId: string) => Promise<CodeChallenge>
  logout: () => Promise<void>
  /** Changes the signed in person's password; their other devices are signed out. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Shows changes to the signed in person's own details, such as a new signature. */
  updateMe: (staff: Staff) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toChallenge(res: RawLoginResponse): CodeChallenge {
  return { challengeId: res.challenge_id!, sentTo: res.sent_to!, resendAfterSeconds: res.resend_after_seconds ?? 30 }
}

/** One provider per clinic address, so each clinic keeps its own sign in. */
export function AuthProvider({ clinicSlug, children }: { clinicSlug: string; children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback((session: RawSession | null) => {
    setAccessToken(session?.access_token ?? null)
    setStaff(session ? toStaff(session.staff) : null)
    setClinic(session ? session.clinic : null)
  }, [])

  // On opening a clinic's pages, pick up an existing sign in from that clinic's cookie.
  useEffect(() => {
    setApiClinic(clinicSlug)
    setAccessToken(null)
    onSessionRefreshed((session) => applySession(session as RawSession))
    refreshSession()
      .then((session) => applySession(session as RawSession | null))
      .finally(() => setLoading(false))
    return () => onSessionRefreshed(null)
  }, [clinicSlug, applySession])

  async function login(email: string, password: string) {
    const res = await api.post<RawLoginResponse>('/auth/login', { clinic: clinicSlug, email, password })
    if (res.status === 'signed_in' && res.session) {
      applySession(res.session)
      return null
    }
    return toChallenge(res)
  }

  async function verify(challengeId: string, code: string, trustDevice: boolean) {
    const session = await api.post<RawSession>('/auth/verify', {
      clinic: clinicSlug,
      challenge_id: challengeId,
      code,
      trust_device: trustDevice,
    })
    applySession(session)
  }

  async function resend(challengeId: string) {
    const res = await api.post<RawLoginResponse>('/auth/resend', { clinic: clinicSlug, challenge_id: challengeId })
    return toChallenge(res)
  }

  async function logout() {
    try {
      await api.post('/auth/logout', { clinic: clinicSlug })
    } finally {
      applySession(null)
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    // The answer carries a fresh token, as the old ones stop working.
    const session = await api.post<RawSession>('/auth/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    applySession(session)
  }

  return (
    <AuthContext.Provider
      value={{ clinicSlug, staff, clinic, loading, login, verify, resend, logout, changePassword, updateMe: setStaff }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
