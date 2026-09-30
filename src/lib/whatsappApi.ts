import { api } from './api'
import type { Person } from './todayApi'

// WhatsApp tap-to-send (Standard and Pro): the server writes the message and logs it, and
// answers with a wa.me address that opens WhatsApp ready to send.

export type MessageKind =
  | 'visit_reminder'
  | 'call_reminder'
  | 'general'
  | 'prescription'
  | 'invoice'
  | 'estimate'
  | 'review_request'
  | 'lab_ready'

export type Language = 'en' | 'hi'

export interface MessageRequest {
  patientId: string
  kind: MessageKind
  language?: Language
  followUpId?: string
  treatmentId?: string
  prescriptionId?: string
  invoiceId?: string
  estimateId?: string
}

export interface MessageTemplate {
  kind: MessageKind
  language: Language
  body: string
  defaultBody: string
  isDefault: boolean
  placeholders: string[]
}

export interface WhatsAppSettings {
  language: Language
  googleReviewUrl: string | null
  templates: MessageTemplate[]
}

export interface ShareLink {
  id: string
  expiresAt: string
  revokedAt: string | null
  openCount: number
  lastOpenedAt: string | null
  active: boolean
}

export interface SentMessage {
  id: string
  kind: MessageKind
  language: Language
  body: string
  toPhone: string
  sentBy: Person | null
  createdAt: string
  link: ShareLink | null
}

export interface SharedDocument {
  clinicName: string
  kind: 'prescription' | 'invoice' | 'estimate'
  title: string
  dateText: string
  expiresAt: string
}

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  visit_reminder: 'Visit reminder',
  call_reminder: 'Check in after treatment',
  general: 'Hello message',
  prescription: 'Prescription',
  invoice: 'Invoice',
  estimate: 'Treatment estimate',
  review_request: 'Review request',
  lab_ready: 'Lab work ready',
}

export const LANGUAGE_LABEL: Record<Language, string> = { en: 'English', hi: 'Hindi' }

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSettings(raw: any): WhatsAppSettings {
  return {
    language: raw.language,
    googleReviewUrl: raw.google_review_url,
    templates: raw.templates.map((t: any) => ({
      kind: t.kind,
      language: t.language,
      body: t.body,
      defaultBody: t.default_body,
      isDefault: t.is_default,
      placeholders: t.placeholders,
    })),
  }
}

function toLink(raw: any): ShareLink {
  return {
    id: raw.id,
    expiresAt: raw.expires_at,
    revokedAt: raw.revoked_at,
    openCount: raw.open_count,
    lastOpenedAt: raw.last_opened_at,
    active: raw.active,
  }
}

export const whatsappApi = {
  async open(message: MessageRequest): Promise<{ url: string; body: string }> {
    const raw = await api.post<any>('/whatsapp/messages', {
      patient_id: message.patientId,
      kind: message.kind,
      language: message.language,
      follow_up_id: message.followUpId,
      treatment_id: message.treatmentId,
      prescription_id: message.prescriptionId,
      invoice_id: message.invoiceId,
      estimate_id: message.estimateId,
    })
    return { url: raw.url, body: raw.body }
  },
  async settings(): Promise<WhatsAppSettings> {
    return toSettings(await api.get('/whatsapp/settings'))
  },
  async saveSettings(language: Language, googleReviewUrl: string): Promise<WhatsAppSettings> {
    return toSettings(await api.put('/whatsapp/settings', { language, google_review_url: googleReviewUrl || null }))
  },
  async saveTemplate(kind: MessageKind, language: Language, body: string): Promise<WhatsAppSettings> {
    return toSettings(await api.put(`/whatsapp/templates/${kind}/${language}`, { body }))
  },
  async resetTemplate(kind: MessageKind, language: Language): Promise<WhatsAppSettings> {
    return toSettings(await api.delete(`/whatsapp/templates/${kind}/${language}`))
  },
  async messages(patientId: string): Promise<SentMessage[]> {
    const raw = await api.get<any[]>(`/patients/${patientId}/messages`)
    return raw.map((m) => ({
      id: m.id,
      kind: m.kind,
      language: m.language,
      body: m.body,
      toPhone: m.to_phone,
      sentBy: m.sent_by,
      createdAt: m.created_at,
      link: m.link ? toLink(m.link) : null,
    }))
  },
  async stopLink(linkId: string): Promise<ShareLink> {
    return toLink(await api.post(`/share-links/${linkId}/stop`))
  },
  async sharedDocument(clinic: string, token: string): Promise<SharedDocument> {
    const raw = await api.get<any>(`/public/${clinic}/documents/${token}`)
    return { clinicName: raw.clinic_name, kind: raw.kind, title: raw.title, dateText: raw.date_text, expiresAt: raw.expires_at }
  },
}
