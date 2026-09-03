import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // monacoEditorPlugin (TICKET-0021) bundles Monaco's web workers as local
  // assets instead of ACE's EditorView.jsx needing to fetch them from a
  // CDN -- keeps the editor working the same offline as every other
  // dependency in this Electron app.
  plugins: [react(), monacoEditorPlugin({})],
  root: path.join(__dirname, 'renderer'),
  base: './',
  build: {
    // Relative (not path.join(__dirname, ...)) so it resolves the same way
    // Vite always resolves a relative outDir -- against `root` above, same
    // final absolute location as before. monacoEditorPlugin's own output
    // path is computed as path.join(root, outDir, ...), which silently
    // produces a garbage nested path if outDir is already absolute (plain
    // path.join doesn't special-case an absolute second argument the way
    // path.resolve does) -- switching to relative avoids that without
    // fighting the plugin's internals.
    outDir: '../dist/renderer',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 5000,
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@shared': path.join(__dirname, 'shared'),
    },
  },
})
