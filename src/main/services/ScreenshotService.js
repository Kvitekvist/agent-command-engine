const fs = require('fs')
const path = require('path')
const { BrowserWindow, screen, desktopCapturer, clipboard } = require('electron')

// TICKET-0034: reworked from TICKET-0032's clipboard-paste model to an
// interactive drag-to-select screen capture, saved into the active
// project's own folder rather than Electron's userData dir -- see
// architecture.md's Screenshots section.

const MIN_SELECTION_PX = 4

function timestampedFilename() {
  const iso = new Date().toISOString().replace(/[:.]/g, '-') // colons aren't valid in Windows filenames
  return `screenshot-${iso}.png`
}

// Appends `.cpi/` to the project's .gitignore (creating the file if it
// doesn't exist yet) so screenshots -- and anything else ACE ever stores
// under the project root -- never get committed to the user's own repo.
function ensureGitignored(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore')
  let content = ''
  try {
    content = fs.readFileSync(gitignorePath, 'utf8')
  } catch (_) {
    // no .gitignore yet -- created below
  }
  if (content.split(/\r?\n/).some((line) => line.trim() === '.cpi/')) return
  const separator = content.length && !content.endsWith('\n') ? '\n' : ''
  fs.writeFileSync(gitignorePath, `${content}${separator}\n# Agent Command Engine data (screenshots, etc.)\n.cpi/\n`)
}

class ScreenshotService {
  // Captures the primary display exactly as it currently appears --
  // including ACE's own window, if it's on screen -- lets the user
  // drag-select a region over it, crops to that region, and saves the
  // result under <projectRoot>/.cpi/screenshots/. Resolves { ok:false,
  // reason:'cancelled' } if the user backs out (Esc/right-click/too-small
  // a selection) rather than throwing, since backing out isn't an error.
  //
  // Deliberately does NOT hide the main window first (an earlier version
  // did): the whole point of this feature is visual UI debugging/feedback
  // on ACE itself (e.g. an agent's terminal), which a screenshot that
  // always excludes ACE can never capture. Standard screen-capture tools
  // (Snipping Tool, Greenshot, etc.) don't hide their own invoking window
  // either -- if the user wants to capture something else instead, they
  // can move or minimize ACE first, same as with any of those.
  async captureRegion(projectRoot) {
    if (!projectRoot) return { ok: false, error: 'No project path' }

    const display = screen.getPrimaryDisplay()
    const pixelWidth = Math.round(display.bounds.width * display.scaleFactor)
    const pixelHeight = Math.round(display.bounds.height * display.scaleFactor)

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: pixelWidth, height: pixelHeight },
    })
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0]
    if (!source || source.thumbnail.isEmpty()) {
      return { ok: false, error: 'No screen source available to capture' }
    }

    const fullImage = source.thumbnail
    const { width: imgWidth, height: imgHeight } = fullImage.getSize()

    const selection = await this._runOverlay(display, fullImage.toDataURL())
    if (!selection) return { ok: false, reason: 'cancelled' }

    // Overlay coordinates are CSS px in a window sized to display.bounds;
    // scale into the full-resolution captured image's own pixel space.
    const scaleX = imgWidth / display.bounds.width
    const scaleY = imgHeight / display.bounds.height
    const cropRect = {
      x: Math.max(0, Math.round(selection.x * scaleX)),
      y: Math.max(0, Math.round(selection.y * scaleY)),
      width: Math.min(imgWidth, Math.round(selection.width * scaleX)),
      height: Math.min(imgHeight, Math.round(selection.height * scaleY)),
    }
    if (cropRect.width < MIN_SELECTION_PX || cropRect.height < MIN_SELECTION_PX) {
      return { ok: false, reason: 'cancelled' }
    }

    const cropped = fullImage.crop(cropRect)
    const folder = path.join(projectRoot, '.cpi', 'screenshots')
    fs.mkdirSync(folder, { recursive: true })
    const filename = timestampedFilename()
    const filePath = path.join(folder, filename)
    fs.writeFileSync(filePath, cropped.toPNG())

    ensureGitignored(projectRoot)

    const relativePath = path.relative(projectRoot, filePath).split(path.sep).join('/')
    clipboard.writeText(relativePath)

    return { ok: true, path: filePath, relativePath, filename }
  }

  // Shows a frameless, transparent, always-on-top window covering exactly
  // the given display, painted with the already-captured frame, and
  // resolves with the user's drag-selected rect (CSS px, window-relative)
  // or null if they cancelled. Kept as its own BrowserWindow (not part of
  // the main window) so it can sit above literally everything on screen,
  // same reasoning as ptyHost.js living in its own process for a different
  // kind of isolation.
  _runOverlay(display, imageDataUrl) {
    return new Promise((resolve) => {
      const overlay = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        show: false,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        skipTaskbar: true,
        hasShadow: false,
        fullscreenable: false,
        backgroundColor: '#000000',
        webPreferences: {
          preload: path.join(__dirname, '..', 'overlay', 'screenshot-overlay-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      })
      overlay.setAlwaysOnTop(true, 'screen-saver')
      overlay.removeMenu()

      let settled = false
      const finish = (result) => {
        if (settled) return
        settled = true
        if (!overlay.isDestroyed()) overlay.destroy()
        resolve(result)
      }

      // Scoped to this window's own webContents (not global ipcMain), so a
      // second capture started before this one settles can never cross-wire.
      const { ipc } = overlay.webContents
      ipc.once('screenshot-overlay:selected', (_, rect) => finish(rect))
      ipc.once('screenshot-overlay:cancelled', () => finish(null))
      overlay.once('closed', () => finish(null))

      overlay.webContents.once('did-finish-load', () => {
        overlay.webContents.send('screenshot-overlay:image', imageDataUrl)
        overlay.show()
        overlay.focus()
      })

      overlay.loadFile(path.join(__dirname, '..', 'overlay', 'screenshot-overlay.html'))
    })
  }
}

module.exports = { ScreenshotService: new ScreenshotService() }
