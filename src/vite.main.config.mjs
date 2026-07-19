import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    lib: {
      entry: path.join(__dirname, 'main/index.js'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: path.join(__dirname, '../dist/main'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'sql.js', 'path', 'fs', 'child_process', 'os', 'crypto'],
    },
  },
})
