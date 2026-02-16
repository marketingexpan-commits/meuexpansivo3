import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome 68', 'defaults', 'not IE 11'],
    }),
  ],
  build: {
    target: 'es2015',
  }
})
