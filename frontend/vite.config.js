import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // используем jsdom для эмуляции браузерного окружения
    environment: 'jsdom',
    // глобальные функции vitest — describe, test, expect без импорта
    globals: true,
    // подключаем матчеры jest-dom перед каждым тестом
    setupFiles: ['./src/tests/setup.js'],
  },
})
