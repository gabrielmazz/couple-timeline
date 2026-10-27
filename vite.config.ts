import path from 'node:path'
import os from 'node:os'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const basePath = process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? '/couple-timeline/' : '/')
const isWsl = process.platform === 'linux' && Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  cacheDir: isWsl ? path.join(os.tmpdir(), `couple-timeline-vite-${process.pid}`) : undefined,
  plugins: [react(), tailwindcss()],
  optimizeDeps: isWsl
    ? {
        include: [
          '@mantine/core',
          '@mantine/dates',
          '@mantine/form',
          '@mantine/hooks',
          '@mantine/notifications',
          'firebase/app',
          'firebase/auth',
          'firebase/firestore',
          'dayjs',
          'lucide-react',
          'maplibre-gl',
          'motion/react',
          'react',
          'react-dom',
          'react-router-dom',
          'zod',
        ],
      }
    : undefined,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/node_modules/**', '**/node_modules-windows-backup/**', '**/dist/**'],
    },
  },
})
