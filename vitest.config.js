import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Component tests render real JSX, so they need the same transform the app uses.
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
