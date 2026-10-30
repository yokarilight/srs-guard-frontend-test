import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // NestJS 後端；`pnpm dev:mock` 時由 MSW 攔截，不會轉送
      '/api': {
        target: process.env.API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
