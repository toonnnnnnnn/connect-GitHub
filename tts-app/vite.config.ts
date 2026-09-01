import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Some filesystems fire spurious change events for tsconfig files,
    // which otherwise triggers a full dev-server restart loop.
    watch: null,
  },
})
