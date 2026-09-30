import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, ImagePlus, RotateCcw, UploadCloud, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field, SelectField } from '../../../components/Field'
import { Pill } from '../../../components/Pill'
import { ApiError } from '../../../lib/api'
import { clinicPath } from '../../../lib/clinic'
import { parseTeeth } from '../../../lib/clinicalApi'
import { formatDate } from '../../../lib/date'
import {
  ACCEPTED_TYPES,
  FILE_KIND_LABEL,
  filesApi,
  guessKind,
  MAX_FILE_BYTES,
  type FileDetails,
  type FileKind,
  type PatientFile,
} from '../../../lib/filesApi'
import { formatBytes } from '../../../lib/planApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'

// The X-rays and photos sheet on a patient's page: upload (several at once, or straight
// from a phone camera), a grid of previews, a full screen viewer, and the 30 day bin.
// Tagging teeth comes with the Standard and Pro plans.

const KIND_OPTIONS = Object.values(FILE_KIND_LABEL)
const KIND_BY_LABEL = Object.fromEntries(Object.entries(FILE_KIND_LABEL).map(([k, v]) => [v, k])) as Record<string, FileKind>
type Filter = 'all' | FileKind

export function ImagesSection() {
  const { patient } = useOutletContext<PatientContext>()
  const { clinic } = useAuth()
  const teethAllowed = clinic?.plan !== 'basic'
  const [files, setFiles] = useState<PatientFile[] | null>(null)
  const [binFiles, setBinFiles] = useState<PatientFile[]>([])
  const [showBin, setShowBin] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [uploading, setUploading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([filesApi.list(patient.id), filesApi.list(patient.id, true)])
      .then(([current, binned]) => {
        setFiles(current)
        setBinFiles(binned)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the files.'))
  }, [patient.id])

  useEffect(() => {
    load()
  }, [load])

  const visible = (files ?? []).filter((f) => filter === 'all' || f.kind === filter)
  const counts = (kind: FileKind) => (files ?? []).filter((f) => f.kind === kind).length
  const openIndex = visible.findIndex((f) => f.id === openId)

  async function restore(file: PatientFile) {
    setError(null)
    try {
      await filesApi.restore(file.id)
      setNotice('Restored.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this file.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-ink-soft">
          {showBin
            ? 'Files in the bin are removed for good 30 days after they were moved there.'
            : files === null
              ? 'Loading…'
              : files.length === 0
                ? 'No X-rays, photos or documents yet.'
                : `${files.length} ${files.length === 1 ? 'file' : 'files'}`}
        </p>
        <ButtonRow>
          {(showBin || binFiles.length > 0) && (
            <Button variant="ghost" onClick={() => setShowBin(!showBin)}>
              {showBin ? 'Back to files' : `Bin (${binFiles.length})`}
            </Button>
          )}
          {!showBin && !uploading && (
            <Button onClick={() => setUploading(true)} className="flex items-center gap-2">
              <ImagePlus size={16} /> Upload
            </Button>
          )}
        </ButtonRow>
      </div>

      {notice && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {uploading && !showBin && (
        <UploadPanel
          patientId={patient.id}
          teethAllowed={teethAllowed}
          onCancel={() => setUploading(false)}
          onFinished={(count) => {
            setUploading(false)
            setNotice(`${count} ${count === 1 ? 'file' : 'files'} uploaded.`)
            load()
          }}
          onSomeSaved={load}
        />
      )}

      {showBin ? (
        <BinList files={binFiles} onRestore={restore} />
      ) : (
        <>
          {files && files.length > 0 && (
            <ButtonRow className="!gap-2">
              {(['all', 'xray', 'photo', 'document'] as Filter[]).map((key) => {
                const count = key === 'all' ? files.length : counts(key)
                if (key !== 'all' && count === 0) return null
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      filter === key ? 'border-accent bg-accent-tint text-accent-deep' : 'border-rule bg-white text-ink-soft hover:text-ink'
                    }`}
                  >
                    {key === 'all' ? 'All' : `${FILE_KIND_LABEL[key]}s`} ({count})
                  </button>
                )
              })}
            </ButtonRow>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((file) => (
              <FileTile key={file.id} file={file} onOpen={() => setOpenId(file.id)} />
            ))}
          </div>
        </>
      )}

      {openIndex >= 0 && (
        <FileViewer
          files={visible}
          index={openIndex}
          teethAllowed={teethAllowed}
          onNavigate={(i) => setOpenId(visible[i].id)}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => setFiles((current) => current?.map((f) => (f.id === updated.id ? updated : f)) ?? null)}
          onBinned={() => {
            setOpenId(null)
            setNotice('Moved to the bin. You can restore it for 30 days.')
            load()
          }}
        />
      )}
    </div>
  )
}

function FileTile({ file, onOpen }: { file: PatientFile; onOpen: () => void }) {
  const { clinic } = useAuth()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border border-rule bg-white text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
    >
      <Preview file={file} />
      <div className="flex min-w-0 flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill variant="accent">{FILE_KIND_LABEL[file.kind]}</Pill>
          {file.teeth.length > 0 && <span className="text-[12px] text-ink-soft">Teeth {file.teeth.join(', ')}</span>}
        </div>
        <span className="truncate text-body text-ink">{file.title ?? formatDate(file.uploadedAt, clinic?.timezone)}</span>
        {file.title && <span className="text-[12px] text-ink-faint">{formatDate(file.uploadedAt, clinic?.timezone)}</span>}
      </div>
    </button>
  )
}

function Preview({ file, small = false }: { file: PatientFile; small?: boolean }) {
  const box = small ? 'h-14 w-14 shrink-0 rounded-lg' : 'aspect-[4/3] w-full'
  if (file.thumbnailUrl) {
    return (
      <div className={`${box} overflow-hidden bg-ink`}>
        <img src={file.thumbnailUrl} alt={file.title ?? FILE_KIND_LABEL[file.kind]} loading="lazy" className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${box} flex flex-col items-center justify-center gap-1 bg-paper-raised text-ink-soft`}>
      <FileText size={small ? 20 : 30} />
      {!small && <span className="text-[12px] font-medium">PDF</span>}
    </div>
  )
}

interface Chosen {
  key: string
  file: File
  progress: number
  status: 'waiting' | 'uploading' | 'done' | 'failed' | 'refused'
  message?: string
}

function refusal(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Only JPG, PNG or WebP images and PDFs can be uploaded.'
  if (file.size > MAX_FILE_BYTES) return 'Each file can be up to 25 MB.'
  return null
}

function UploadPanel({
  patientId,
  teethAllowed,
  onCancel,
  onFinished,
  onSomeSaved,
}: {
  patientId: string
  teethAllowed: boolean
  onCancel: () => void
  onFinished: (count: number) => void
  onSomeSaved: () => void
}) {
  const { staff, clinicSlug } = useAuth()
  const [chosen, setChosen] = useState<Chosen[]>([])
  const [kindLabel, setKindLabel] = useState(FILE_KIND_LABEL.xray)
  const [title, setTitle] = useState('')
  const [teethText, setTeethText] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageFull, setStorageFull] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  function add(list: FileList | null) {
    if (!list || list.length === 0) return
    const added = Array.from(list).map((file, i) => {
      const reason = refusal(file)
      return {
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        progress: 0,
        status: reason ? 'refused' : 'waiting',
        message: reason ?? undefined,
      } satisfies Chosen
    })
    setChosen((current) => {
      const next = [...current, ...added]
      const usable = next.filter((c) => c.status !== 'refused')
      if (usable.length > 0 && usable.every((c) => guessKind(c.file) === 'document')) setKindLabel(FILE_KIND_LABEL.document)
      return next
    })
  }

  function update(key: string, change: Partial<Chosen>) {
    setChosen((current) => current.map((c) => (c.key === key ? { ...c, ...change } : c)))
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    add(e.dataTransfer.files)
  }

  const waiting = chosen.filter((c) => c.status === 'waiting' || c.status === 'failed')

  async function uploadAll() {
    const teeth = teethAllowed && teethText.trim() ? parseTeeth(teethText) : []
    if (teeth === null) {
      setError('Enter teeth as two digit numbers separated by commas, such as 36, 37.')
      return
    }
    setError(null)
    setBusy(true)
    const details: FileDetails = { kind: KIND_BY_LABEL[kindLabel], title, teeth }
    let saved = 0
    let failed = 0
    for (const item of waiting) {
      update(item.key, { status: 'uploading', progress: 0, message: undefined })
      try {
        await filesApi.upload(patientId, item.file, details, (share) => update(item.key, { progress: share }))
        update(item.key, { status: 'done', progress: 1 })
        saved += 1
      } catch (err) {
        failed += 1
        const full = err instanceof ApiError && err.data?.code === 'storage_limit'
        if (full) setStorageFull(true)
        update(item.key, { status: 'failed', message: err instanceof ApiError ? err.message : 'The upload did not finish.' })
        if (full) break
      }
    }
    setBusy(false)
    if (failed === 0 && saved > 0) onFinished(saved + chosen.filter((c) => c.status === 'done').length)
    else if (saved > 0) onSomeSaved()
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-5 transition-colors ${
          dragging ? 'border-accent bg-accent-tint' : 'border-rule bg-paper-raised/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <UploadCloud size={26} className="shrink-0 text-accent" />
          <div className="flex flex-col">
            <span className="text-body font-medium text-ink">Drag X-rays, photos or PDFs here</span>
            <span className="text-[13px] text-ink-soft">JPG, PNG, WebP or PDF, up to 25 MB each. Several at once is fine.</span>
          </div>
        </div>
        <ButtonRow>
          <Button variant="secondary" className="sm:hidden" onClick={() => camera.current?.click()} disabled={busy}>
            Take photo
          </Button>
          <Button variant="tint" onClick={() => picker.current?.click()} disabled={busy}>
            Choose files
          </Button>
        </ButtonRow>
        <input ref={picker} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }} />
      </div>

      {chosen.length > 0 && (
        <ul className="flex flex-col gap-2">
          {chosen.map((c) => (
            <li key={c.key} className="flex flex-col gap-1.5 rounded-lg border border-rule px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-body text-ink">{c.file.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-[12px] text-ink-soft">
                  {formatBytes(c.file.size)}
                  {c.status === 'done' && <Pill variant="success">Uploaded</Pill>}
                  {(c.status === 'failed' || c.status === 'refused') && <Pill variant="crit">Not uploaded</Pill>}
                  {(c.status === 'waiting' || c.status === 'refused') && !busy && (
                    <button
                      type="button"
                      aria-label={`Remove ${c.file.name}`}
                      onClick={() => setChosen((current) => current.filter((x) => x.key !== c.key))}
                      className="rounded-full p-1 text-ink-faint hover:bg-paper-raised hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              </div>
              {c.status === 'uploading' && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-raised">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(c.progress * 100)}%` }} />
                </div>
              )}
              {c.message && <span className="text-[12px] text-crit">{c.message}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className={`grid grid-cols-1 gap-4 ${teethAllowed ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <SelectField label="Type" options={KIND_OPTIONS} value={kindLabel} onChange={(e) => setKindLabel(e.target.value)} />
        <Field label="Note" hint="Optional" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="OPG before root canal" />
        {teethAllowed && (
          <Field label="Teeth" hint="Optional" value={teethText} onChange={(e) => setTeethText(e.target.value)} placeholder="36, 37" />
        )}
      </div>
      {chosen.length > 1 && <p className="text-[13px] text-ink-soft">The type, note and teeth apply to every file in this upload.</p>}

      {storageFull && (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-body text-warn">
          Your storage is full.{' '}
          {staff?.role === 'doctor' ? (
            'Ask the clinic owner to add storage.'
          ) : (
            <Link to={clinicPath(clinicSlug, 'settings/plan')} className="font-medium underline">
              See plan and usage
            </Link>
          )}
        </p>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {chosen.some((c) => c.status === 'done') ? 'Close' : 'Cancel'}
        </Button>
        <Button onClick={uploadAll} disabled={busy || waiting.length === 0}>
          {busy ? 'Uploading…' : waiting.length > 1 ? `Upload ${waiting.length} files` : 'Upload'}
        </Button>
      </ButtonRow>
    </div>
  )
}

function FileViewer({
  files,
  index,
  teethAllowed,
  onNavigate,
  onClose,
  onChanged,
  onBinned,
}: {
  files: PatientFile[]
  index: number
  teethAllowed: boolean
  onNavigate: (index: number) => void
  onClose: () => void
  onChanged: (file: PatientFile) => void
  onBinned: () => void
}) {
  const { clinic } = useAuth()
  const file = files[index]
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPrev = index > 0
  const hasNext = index < files.length - 1

  useEffect(() => {
    setEditing(false)
    setError(null)
  }, [file.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, hasPrev, hasNext, index, onClose, onNavigate])

  async function moveToBin() {
    setBusy(true)
    setError(null)
    try {
      await filesApi.moveToBin(file.id)
      onBinned()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not move this file to the bin.')
      setBusy(false)
    }
  }

  const iconButton = 'flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30'

  return (
    <div role="dialog" aria-modal="true" aria-label="File viewer" className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{file.title ?? FILE_KIND_LABEL[file.kind]}</span>
          <span className="text-[12px] text-white/70">
            {index + 1} of {files.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" title="Previous" className={iconButton} disabled={!hasPrev} onClick={() => onNavigate(index - 1)}>
            <ChevronLeft size={20} />
          </button>
          <button type="button" aria-label="Next" title="Next" className={iconButton} disabled={!hasNext} onClick={() => onNavigate(index + 1)}>
            <ChevronRight size={20} />
          </button>
          <button type="button" aria-label="Close" title="Close" className={iconButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4" onClick={onClose}>
        {file.thumbnailUrl ? (
          <img
            key={file.id}
            src={file.viewUrl}
            alt={file.title ?? FILE_KIND_LABEL[file.kind]}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white/5 px-10 py-8 text-white" onClick={(e) => e.stopPropagation()}>
            <FileText size={48} className="text-white/80" />
            <span className="text-body">PDF document</span>
            <ButtonRow>
              <Button variant="tint" onClick={() => window.open(file.viewUrl, '_blank')}>
                Open PDF
              </Button>
            </ButtonRow>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-lg">
          {editing ? (
            <EditDetails
              file={file}
              teethAllowed={teethAllowed}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                onChanged(updated)
                setEditing(false)
              }}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
                <Pill variant="accent">{FILE_KIND_LABEL[file.kind]}</Pill>
                {file.teeth.length > 0 && <span>Teeth {file.teeth.join(', ')}</span>}
                <span>
                  Uploaded by {file.uploadedBy.name} on {formatDate(file.uploadedAt, clinic?.timezone)}
                </span>
                <span>{formatBytes(file.sizeBytes)}</span>
              </div>
              {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2 text-[13px] text-crit">{error}</p>}
              <ButtonRow>
                <Button variant="ghost" onClick={moveToBin} disabled={busy}>
                  Move to bin
                </Button>
                <Button variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
                  Edit details
                </Button>
                <Button variant="secondary" onClick={() => window.location.assign(file.downloadUrl)} disabled={busy}>
                  Download
                </Button>
              </ButtonRow>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EditDetails({
  file,
  teethAllowed,
  onCancel,
  onSaved,
}: {
  file: PatientFile
  teethAllowed: boolean
  onCancel: () => void
  onSaved: (file: PatientFile) => void
}) {
  const [kindLabel, setKindLabel] = useState(FILE_KIND_LABEL[file.kind])
  const [title, setTitle] = useState(file.title ?? '')
  const [teethText, setTeethText] = useState(file.teeth.join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const teeth = teethAllowed ? (teethText.trim() ? parseTeeth(teethText) : []) : file.teeth
    if (teeth === null) {
      setError('Enter teeth as two digit numbers separated by commas, such as 36, 37.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await filesApi.update(file.id, { kind: KIND_BY_LABEL[kindLabel], title, teeth }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the changes.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid grid-cols-1 gap-3 ${teethAllowed ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <SelectField label="Type" options={KIND_OPTIONS} value={kindLabel} onChange={(e) => setKindLabel(e.target.value)} />
        <Field label="Note" hint="Optional" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        {teethAllowed && <Field label="Teeth" hint="Optional" value={teethText} onChange={(e) => setTeethText(e.target.value)} placeholder="36, 37" />}
      </div>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2 text-[13px] text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ButtonRow>
    </div>
  )
}

function BinList({ files, onRestore }: { files: PatientFile[]; onRestore: (file: PatientFile) => void }) {
  const { clinic } = useAuth()
  if (files.length === 0) return <p className="text-body text-ink-faint">The bin is empty.</p>
  return (
    <ul className="flex flex-col gap-2">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-white p-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <Preview file={file} small />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body text-ink">
                {FILE_KIND_LABEL[file.kind]}
                {file.title ? ` · ${file.title}` : ''}
              </span>
              <span className="text-[12px] text-ink-faint">
                Moved to the bin on {formatDate(file.deletedAt!, clinic?.timezone)}. Removed for good on{' '}
                {formatDate(file.purgeAfter!, clinic?.timezone)}.
              </span>
            </div>
          </div>
          <ButtonRow>
            <Button variant="tint" className="flex items-center gap-1.5" onClick={() => onRestore(file)}>
              <RotateCcw size={14} /> Restore
            </Button>
          </ButtonRow>
        </li>
      ))}
    </ul>
  )
}
