// Prefer the browser paste event's payload. Falling back to the async
// clipboard API is only necessary for synthetic/nonstandard events and must
// happen at most once per paste event.
export async function readPasteText(event, clipboard) {
  const getData = event?.clipboardData?.getData
  if (typeof getData === 'function') {
    return getData.call(event.clipboardData, 'text/plain')
  }
  return clipboard.readText()
}

// Use the image belonging to this paste, even if the clipboard changes while IPC runs.
export async function pasteImage(blob, clipboard, projectPath, terminal) {
  const imageBytes = blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
  const result = await clipboard.saveImage(projectPath, imageBytes)
  if (!result.success) throw new Error(result.error || 'Could not save image')
  terminal.paste(result.relativePath)
}
