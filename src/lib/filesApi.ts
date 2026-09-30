import { api, ApiError } from './api'
import type { Person } from './todayApi'

// X-rays, photos and documents on a patient's record: every call, and the snake_case to
// camelCase conversion. An upload is three steps (see backend app/routers/patient_files.py):
// ask for an upload link, send the bytes there, then confirm with the details.

export type FileKind = 'xray' | 'photo' | 'document'

export const FILE_KIND_LABEL: Record<FileKind, string> = { xray: 'X-ray', photo: 'Photo', document: 'Document' }

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export interface PatientFile {
  id: string
  kind: FileKind
  title: string | null
  teeth: number[]
  contentType: string
  sizeBytes: number
  width: number | null
  height: number | null
  uploadedBy: Person
  uploadedAt: string
  deletedAt: string | null
  purgeAfter: string | null
  viewUrl: string
  downloadUrl: string
  thumbnailUrl: string | null
}

export interface FileDetails {
  kind: FileKind
  title: string
  teeth: number[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toFile(raw: any): PatientFile {
  return {
    id: raw.id,
    kind: raw.kind,
    title: raw.title,
    teeth: raw.teeth,
    contentType: raw.content_type,
    sizeBytes: raw.size_bytes,
    width: raw.width,
    height: raw.height,
    uploadedBy: raw.uploaded_by,
    uploadedAt: raw.uploaded_at,
    deletedAt: raw.deleted_at,
    purgeAfter: raw.purge_after,
    viewUrl: raw.view_url,
    downloadUrl: raw.download_url,
    thumbnailUrl: raw.thumbnail_url,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function detailsPayload(details: FileDetails) {
  return { kind: details.kind, title: details.title.trim() || null, teeth: details.teeth }
}

interface UploadTicket {
  upload_token: string
  upload_url: string
  method: 'PUT'
  headers: Record<string, string>
}

/** Sends the bytes to the upload link, reporting progress from 0 to 1. */
function sendBytes(ticket: UploadTicket, file: File, onProgress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(ticket.method, ticket.upload_url)
    for (const [name, value] of Object.entries(ticket.headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, 'The upload did not finish. Try again.'))
    xhr.onerror = () => reject(new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.'))
    xhr.send(file)
  })
}

export const filesApi = {
  async list(patientId: string, bin = false): Promise<PatientFile[]> {
    return (await api.get<unknown[]>(`/patients/${patientId}/files${bin ? '?bin=true' : ''}`)).map(toFile)
  },
  async upload(patientId: string, file: File, details: FileDetails, onProgress: (share: number) => void): Promise<PatientFile> {
    const ticket = await api.post<UploadTicket>(`/patients/${patientId}/files/uploads`, {
      content_type: file.type,
      size_bytes: file.size,
    })
    await sendBytes(ticket, file, onProgress)
    return toFile(await api.post(`/patients/${patientId}/files`, { upload_token: ticket.upload_token, ...detailsPayload(details) }))
  },
  async update(id: string, details: FileDetails): Promise<PatientFile> {
    return toFile(await api.patch(`/files/${id}`, detailsPayload(details)))
  },
  async moveToBin(id: string): Promise<PatientFile> {
    return toFile(await api.delete(`/files/${id}`))
  },
  async restore(id: string): Promise<PatientFile> {
    return toFile(await api.post(`/files/${id}/restore`))
  },
}

/** A guess at the kind from the file itself: PDFs are documents, images default to X-ray. */
export function guessKind(file: File): FileKind {
  return file.type === 'application/pdf' ? 'document' : 'xray'
}
