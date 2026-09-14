import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // EditorView uses native Vite worker imports; no CDN or worker plugin.
  plugins: [react(), {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml: html => html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`),
  }],
  root: path.join(__dirname, 'renderer'),
  base: './',
  build: {
    // Relative to the renderer root.
    outDir: '../dist/renderer',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 5000,
  },
  server: {
    port: 5173,
  },
})
