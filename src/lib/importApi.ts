import { api } from './api'
import type { Person } from './todayApi'

// Patient import from Excel or CSV: every call, and the snake_case to camelCase conversion.

export interface ImportPreview {
  fileId: string
  fileName: string
  columns: string[]
  fields: { key: string; label: string }[]
  /** Denti field to column number, or null when no column matches. */
  mapping: Record<string, number | null>
  sample: string[][]
  rowCount: number
}

export interface ImportRow {
  row: number
  name: string | null
  phone: string | null
  previousId: string | null
  kind: 'ok' | 'duplicate' | 'invalid'
  problems: string[]
  warnings: string[]
}

export interface ImportCheck {
  ok: number
  duplicates: number
  invalid: number
  flagged: ImportRow[]
  plan: { used: number; adding: number; limit: number | null; fits: boolean; suggestedPlanName: string | null }
  keepNumbersPossible: boolean
  keepNumbersReason: string | null
}

export interface ImportBatch {
  id: string
  fileName: string
  rowsTotal: number
  rowsImported: number
  rowsSkipped: number
  keptNumbers: boolean
  uploadedBy: Person
  createdAt: string
  undoDeadline: string
  undoneAt: string | null
  canUndo: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toBatch(b: any): ImportBatch {
  return {
    id: b.id,
    fileName: b.file_name,
    rowsTotal: b.rows_total,
    rowsImported: b.rows_imported,
    rowsSkipped: b.rows_skipped,
    keptNumbers: b.kept_numbers,
    uploadedBy: b.uploaded_by,
    createdAt: b.created_at,
    undoDeadline: b.undo_deadline,
    undoneAt: b.undone_at,
    canUndo: b.can_undo,
  }
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export const importApi = {
  async upload(file: File): Promise<ImportPreview> {
    const raw: any = await api.post('/imports/files', { file_name: file.name, data_base64: await readBase64(file) })
    return {
      fileId: raw.file_id,
      fileName: raw.file_name,
      columns: raw.columns,
      fields: raw.fields,
      mapping: raw.mapping,
      sample: raw.sample,
      rowCount: raw.row_count,
    }
  },
  async check(fileId: string, mapping: Record<string, number | null>): Promise<ImportCheck> {
    const raw: any = await api.post('/imports/check', { file_id: fileId, mapping })
    return {
      ok: raw.ok,
      duplicates: raw.duplicates,
      invalid: raw.invalid,
      flagged: raw.flagged.map((r: any) => ({
        row: r.row,
        name: r.name,
        phone: r.phone,
        previousId: r.previous_id,
        kind: r.kind,
        problems: r.problems,
        warnings: r.warnings,
      })),
      plan: {
        used: raw.plan.used,
        adding: raw.plan.adding,
        limit: raw.plan.limit,
        fits: raw.plan.fits,
        suggestedPlanName: raw.plan.suggested_plan_name,
      },
      keepNumbersPossible: raw.keep_numbers_possible,
      keepNumbersReason: raw.keep_numbers_reason,
    }
  },
  async run(fileId: string, mapping: Record<string, number | null>, keepNumbers: boolean, includeRows: number[]): Promise<ImportBatch> {
    return toBatch(
      await api.post('/imports', { file_id: fileId, mapping, keep_numbers: keepNumbers, include_rows: includeRows }),
    )
  },
  async recent(): Promise<ImportBatch[]> {
    return ((await api.get('/imports')) as any[]).map(toBatch)
  },
  async undo(id: string): Promise<ImportBatch> {
    return toBatch(await api.post(`/imports/${id}/undo`))
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A CSV with Denti's headings, for clinics starting a list from scratch. */
export const TEMPLATE_CSV =
  'Patient ID,Name,Phone,Gender,Date of birth,Age,Email,City,Area,Medical conditions,Medical history,Balance owed\n' +
  'OLD-0001,Asha Rao,9810000001,Female,12/03/1985,,asha@example.com,Noida,Sector 62,Diabetes,,1200\n'
