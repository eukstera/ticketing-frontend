// Hands a generated file (a Blob from the API) to the browser as a download.
// Shared by every "generate a document" feature so they all behave alike.

/**
 * Saves `blob` as `filename` through a temporary link. Returns false instead
 * of throwing if the browser refuses (some block downloads that don't follow a
 * click), so callers can offer a manual button.
 */
export function saveBlob(blob: Blob, filename: string): boolean {
  let url: string | null = null
  try {
    url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  } finally {
    // The click has already started the download; the URL is no longer needed.
    if (url) window.URL.revokeObjectURL(url)
  }
}
