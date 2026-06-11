import { defineConfig } from 'vite'

export default defineConfig({
  base: '/webapp/',
  build: {
    outDir: '../src/main/resources/static/webapp',
    emptyOutDir: true,
  },
})
