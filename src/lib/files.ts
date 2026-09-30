import type { FileDownload } from './api'

// Opening and saving files fetched from the API (PDFs, images). They need the sign in, so
// they are fetched first and handed to the browser as a local copy.

/** Opens the file in a new tab. The tab opens straight away, before the file arrives, so
 * browsers do not treat it as an unwanted pop up. */
export async function viewFile(load: () => Promise<FileDownload>): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const { blob } = await load()
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    tab?.close()
    throw err
  }
}

/** Saves the file to the device, under the name the API suggests. */
export async function saveFile(load: () => Promise<FileDownload>, fallbackName: string): Promise<void> {
  const { blob, name } = await load()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name ?? fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
