# Icon Setup for ACE

## Overview

ACE now has custom icon support for Windows (.ico) and macOS (.icns) builds, as well as when running from source code.

## Icon Files

- **Source**: `assets/images/logo.png` (1024x1024 purple/white ACE logo)
- **Windows**: `build/icon.ico` (multi-resolution .ico file)
- **macOS**: `build/icon.iconset/` (PNG set for .icns creation)
- **macOS Final**: `build/icon.icns` (created during packaging or manually on Mac)

## Where Icons Appear

1. **Windows .exe** - Application icon and taskbar
2. **macOS .dmg** - Application bundle icon and dock
3. **Running from source** - Window icon (via `run.bat` or dev mode)

## Setup

Icons are already configured! No additional setup needed.

### Regenerating Icons

If you update `assets/images/logo.png`, regenerate icons:

```bash
python scripts/create-icons.py
```

This creates:
- `build/icon.ico` ✓
- `build/icon.iconset/*.png` ✓

On macOS, to manually create .icns:
```bash
./scripts/create-icns-on-mac.sh
```

Or let electron-builder create it automatically during packaging.

## Technical Details

### package.json Configuration

```json
"build": {
  "win": {
    "icon": "../build/icon.ico"
  },
  "mac": {
    "icon": "../build/icon.icns"
  }
}
```

### Runtime Configuration

In `src/main/index.js`:

```javascript
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, '../../build/icon.ico')
  } else if (process.platform === 'darwin') {
    return path.join(__dirname, '../../build/icon.icns')
  }
  return undefined
}

// Used in BrowserWindow creation:
mainWindow = new BrowserWindow({
  icon: iconPath,
  // ...
})
```

## Icon Sizes

### Windows (.ico)
- 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256

### macOS (.icns)
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Each with @2x retina variants where applicable

## Build Process

When running `npm run package`:

1. **Windows**: electron-builder uses `build/icon.ico` directly
2. **macOS**: electron-builder creates `.icns` from `icon.iconset/` if `.icns` doesn't exist

The icon is automatically included in both portable and installer builds.
