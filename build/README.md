# Icon Build Files

This directory contains the icon files for ACE (Agent Command Engine).

## Files

- **icon.ico** - Windows icon (16, 24, 32, 48, 64, 128, 256px sizes)
- **icon.iconset/** - PNG set for macOS .icns creation
- **icon.icns** - macOS icon (to be created on Mac or via build process)

## Creating Icons

### Automatic (from logo.png)

```bash
# From project root
python scripts/create-icons.py
```

This creates:
- `icon.ico` for Windows ✓
- `icon.iconset/` PNG set for macOS ✓

### Creating .icns on macOS

On a Mac, run:
```bash
iconutil -c icns build/icon.iconset -o build/icon.icns
```

Or use the helper script:
```bash
./scripts/create-icns-on-mac.sh
```

### electron-builder Behavior

When you run `npm run package`:

- **Windows**: Uses `build/icon.ico` automatically
- **macOS**: Creates `.icns` from the PNG set if `icon.icns` doesn't exist

electron-builder will automatically generate the .icns file during packaging if it's missing, so you don't strictly need to create it manually. However, having it pre-created ensures consistency.

## Icon Display

### Packaged Apps (exe/dmg)

Icon is set in `src/package.json`:
```json
"build": {
  "win": { "icon": "../build/icon.ico" },
  "mac": { "icon": "../build/icon.icns" }
}
```

### Running from Source

Icon is set in `src/main/index.js`:
```javascript
const iconPath = getIconPath()
mainWindow = new BrowserWindow({
  icon: iconPath,
  // ...
})
```

## Source

Logo: `assets/images/logo.png`
