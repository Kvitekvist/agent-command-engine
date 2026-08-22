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
