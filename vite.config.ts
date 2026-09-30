import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Port 5180 so Denti never clashes with other local apps (Ranco uses 5173).
    port: 5180,
    strictPort: true,
    // The app calls /api on its own address; this forwards those calls to the local API.
    // Keeping the API on the same address lets sign in cookies stay first party.
    proxy: {
      '/api': {
        // DENTI_API_URL points a second copy of the app at a different API, for testing.
        target: process.env.DENTI_API_URL || 'http://localhost:8100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
