import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Pill } from '../../components/Pill'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { formatDate, formatTime } from '../../lib/date'
import { importApi, TEMPLATE_CSV, type ImportBatch, type ImportCheck, type ImportPreview } from '../../lib/importApi'
import { useAuth } from '../../state/AuthContext'

// Settings, Import patients: upload an Excel or CSV file, confirm which column is which,
// review the flagged rows, then import. Imported patients count towards the plan. An import
// can be undone for 30 minutes, only while nothing has been recorded for its patients.

const MAX_BYTES = 5 * 1024 * 1024
const NOT_IN_FILE = -1

export function ImportPatients() {
  const { clinicSlug, clinic } = useAuth()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, number | null>>({})
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [include, setInclude] = useState<Set<number>>(new Set())
  const [keepNumbers, setKeepNumbers] = useState(false)
  const [done, setDone] = useState<ImportBatch | null>(null)
  const [recent, setRecent] = useState<ImportBatch[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const loadRecent = () => importApi.recent().then(setRecent).catch(() => setRecent([]))
  useEffect(() => {
    loadRecent()
  }, [])

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('The file can be up to 5 MB.')
      return
    }
    act(async () => {
      const result = await importApi.upload(file)
      setPreview(result)
      setMapping(result.mapping)
      setCheck(null)
      setDone(null)
    })
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'Denti patient import template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    setPreview(null)
    setCheck(null)
    setDone(null)
    setInclude(new Set())
    setKeepNumbers(false)
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
        Import patients
      </BackTitle>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {!preview && !done && (
        <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={26} className="mt-0.5 shrink-0 text-accent" />
            <div className="flex flex-col gap-1">
              <span className="text-subheading font-medium text-ink">Bring your patient list into Denti</span>
              <span className="text-body text-ink-soft">
                Upload an Excel (.xlsx) or CSV file with one patient per row: name and phone at least, and any of old patient ID,
                gender, date of birth or age, email, city, area, medical conditions, medical history and balance owed. Each patient
                gets a new Denti ID; their old ID stays searchable. You check everything before it is saved.
              </span>
            </div>
          </div>
          <input ref={picker} type="file" accept=".xlsx,.csv" className="hidden" onChange={choose} />
          <ButtonRow>
            <Button variant="ghost" onClick={downloadTemplate}>
              Download a template
            </Button>
            <Button onClick={() => picker.current?.click()} disabled={busy}>
              {busy ? 'Reading…' : 'Choose file'}
            </Button>
          </ButtonRow>
        </section>
      )}

      {preview && !done && (
        <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-subheading font-medium text-ink">1. Match the columns</span>
            <span className="text-[13px] text-ink-soft">
              {preview.fileName}: {preview.rowCount.toLocaleString('en-IN')} rows. Denti matched what it could; check each one.
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {preview.fields.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-body text-ink">
                  {f.label}
                  {(f.key === 'name' || f.key === 'phone') && <span className="text-accent"> *</span>}
                </span>
                <select
                  value={mapping[f.key] ?? NOT_IN_FILE}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setMapping({ ...mapping, [f.key]: value === NOT_IN_FILE ? null : value })
                    setCheck(null)
                  }}
                  className="w-48 rounded-lg border border-rule bg-white px-3 py-2 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
                >
                  <option value={NOT_IN_FILE}>Not in the file</option>
                  {preview.columns.map((c, i) => (
                    <option key={i} value={i}>
                      {c || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <details className="text-[13px] text-ink-soft">
            <summary className="cursor-pointer">The first rows of the file</summary>
            <div className="mt-2 overflow-x-auto rounded-lg border border-rule">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-rule">
                    {preview.columns.map((c, i) => (
                      <th key={i} className="whitespace-nowrap px-2.5 py-1.5 font-medium text-ink-soft">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, r) => (
                    <tr key={r} className="border-b border-rule last:border-none">
                      {row.map((cell, i) => (
                        <td key={i} className="whitespace-nowrap px-2.5 py-1.5 text-ink">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <ButtonRow>
            <Button variant="ghost" onClick={startOver} disabled={busy}>
              Choose another file
            </Button>
            <Button
              onClick={() => act(async () => setCheck(await importApi.check(preview.fileId, mapping)))}
              disabled={busy || mapping.name == null || mapping.phone == null}
            >
              {busy && !check ? 'Checking…' : 'Check the file'}
            </Button>
          </ButtonRow>
        </section>
      )}

      {preview && check && !done && (
        <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
          <span className="text-subheading font-medium text-ink">2. Review</span>
          <div className="grid grid-cols-3 gap-3">
            <Count label="Ready to import" value={check.ok + include.size} tone="text-ok" />
            <Count label="Look like duplicates" value={check.duplicates} tone="text-warn" />
            <Count label="Cannot be imported" value={check.invalid} tone="text-crit" />
          </div>

          {!check.plan.fits && (
            <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-body text-warn">
              Your plan includes {check.plan.limit?.toLocaleString('en-IN')} patients and you have {check.plan.used.toLocaleString('en-IN')}.
              This import would add {check.plan.adding.toLocaleString('en-IN')}. The {check.plan.suggestedPlanName} plan fits.{' '}
              <Link to={clinicPath(clinicSlug, 'settings/plan')} className="font-medium underline">
                See plans
              </Link>
            </p>
          )}

          <label className="flex items-start gap-2 text-body text-ink">
            <input
              type="checkbox"
              checked={keepNumbers}
              disabled={!check.keepNumbersPossible}
              onChange={(e) => setKeepNumbers(e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent"
            />
            <span className="flex flex-col">
              Keep the old patient numbers
              <span className="text-[13px] text-ink-soft">
                {check.keepNumbersPossible
                  ? 'RANCO-0012 becomes patient 12 in Denti, and new patients continue after the highest number.'
                  : `Not possible for this file: ${check.keepNumbersReason}`}
              </span>
            </span>
          </label>

          {check.flagged.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-rule">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-rule text-[11px] uppercase tracking-wider text-ink-soft">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2">What Denti found</th>
                    <th className="px-3 py-2 text-right">Import</th>
                  </tr>
                </thead>
                <tbody>
                  {check.flagged.map((r) => (
                    <tr key={r.row} className="border-b border-rule align-top last:border-none">
                      <td className="px-3 py-2 tabular-nums text-ink-soft">{r.row}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-ink">{r.name ?? 'No name'}</span>
                          <span className="text-ink-faint">{r.phone ?? 'No phone'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {[...r.problems, ...r.warnings].map((p) => (
                          <div key={p} className={r.problems.includes(p) ? (r.kind === 'invalid' ? 'text-crit' : 'text-warn') : 'text-ink-soft'}>
                            {p}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.kind === 'duplicate' ? (
                          <label className="inline-flex items-center gap-1.5 text-ink-soft">
                            <input
                              type="checkbox"
                              checked={include.has(r.row)}
                              onChange={() => {
                                const next = new Set(include)
                                if (next.has(r.row)) next.delete(r.row)
                                else next.add(r.row)
                                setInclude(next)
                              }}
                              className="h-4 w-4 accent-accent"
                            />
                            Anyway
                          </label>
                        ) : r.kind === 'invalid' ? (
                          <Pill variant="crit">Skipped</Pill>
                        ) : (
                          <Pill variant="success">Yes</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ButtonRow>
            <Button variant="ghost" onClick={() => setCheck(null)} disabled={busy}>
              Back to columns
            </Button>
            <Button
              onClick={() =>
                act(async () => {
                  setDone(await importApi.run(preview.fileId, mapping, keepNumbers, [...include]))
                  loadRecent()
                })
              }
              disabled={busy || !check.plan.fits || check.ok + include.size === 0}
            >
              {busy ? 'Importing…' : `Import ${(check.ok + include.size).toLocaleString('en-IN')} patients`}
            </Button>
          </ButtonRow>
        </section>
      )}

      {done && (
        <section className="flex flex-col gap-3 rounded-xl border border-ok/40 bg-ok-soft/40 p-5">
          <span className="text-subheading font-medium text-ink">
            {done.rowsImported.toLocaleString('en-IN')} patients imported
            {done.rowsSkipped ? `, ${done.rowsSkipped.toLocaleString('en-IN')} skipped` : ''}.
          </span>
          <span className="text-body text-ink-soft">
            If something looks wrong, you can undo this import until {formatTime(done.undoDeadline, clinic?.timezone)}, as long as
            nothing has been recorded for these patients yet.
          </span>
          <ButtonRow>
            <Button variant="ghost" onClick={startOver}>
              Import another file
            </Button>
            <Link to={clinicPath(clinicSlug, 'patients')}>
              <Button>See patients</Button>
            </Link>
          </ButtonRow>
        </section>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className="text-body font-medium text-ink">Recent imports</span>
          <div className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-white shadow-sm">
            {recent.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-2 text-body text-ink">
                    {b.fileName}
                    {b.undoneAt && <Pill variant="crit">Undone</Pill>}
                  </span>
                  <span className="text-[12px] text-ink-faint">
                    {formatDate(b.createdAt, clinic?.timezone)} {formatTime(b.createdAt, clinic?.timezone)} · {b.rowsImported} imported
                    {b.rowsSkipped ? `, ${b.rowsSkipped} skipped` : ''} · {b.uploadedBy.name}
                    {b.keptNumbers ? ' · kept old numbers' : ''}
                  </span>
                </div>
                {b.canUndo && (
                  <ButtonRow>
                    <Button
                      variant="danger"
                      className="!px-3 !py-1.5 text-[13px]"
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await importApi.undo(b.id)
                          if (done?.id === b.id) startOver()
                          loadRecent()
                        })
                      }
                    >
                      Undo until {formatTime(b.undoDeadline, clinic?.timezone)}
                    </Button>
                  </ButtonRow>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-paper-raised px-3.5 py-3">
      <span className={`text-[24px] font-bold tabular-nums ${tone}`}>{value.toLocaleString('en-IN')}</span>
      <span className="text-[13px] text-ink-soft">{label}</span>
    </div>
  )
}
