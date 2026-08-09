// Drag-to-select UI for the screenshot capture overlay (TICKET-0034).
// Runs in the overlay BrowserWindow's renderer, talking to the main
// process only through window.overlay (see screenshot-overlay-preload.js).
const img = document.getElementById('shot')
const sel = document.getElementById('sel')

let startX = 0
let startY = 0
let dragging = false

window.overlay.onImage((dataUrl) => {
  img.src = dataUrl
})

function updateSelection(curX, curY) {
  const x = Math.min(startX, curX)
  const y = Math.min(startY, curY)
  const w = Math.abs(curX - startX)
  const h = Math.abs(curY - startY)
  sel.style.left = x + 'px'
  sel.style.top = y + 'px'
  sel.style.width = w + 'px'
  sel.style.height = h + 'px'
}

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  sel.style.display = 'block'
  updateSelection(e.clientX, e.clientY)
})

window.addEventListener('mousemove', (e) => {
  if (!dragging) return
  updateSelection(e.clientX, e.clientY)
})

window.addEventListener('mouseup', (e) => {
  if (!dragging) return
  dragging = false
  window.overlay.selected({
    x: Math.min(startX, e.clientX),
    y: Math.min(startY, e.clientY),
    width: Math.abs(e.clientX - startX),
    height: Math.abs(e.clientY - startY),
  })
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.overlay.cancelled()
})

window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  window.overlay.cancelled()
})
