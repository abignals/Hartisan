import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: true,   // ou '0.0.0.0'
    port: 5173,
    proxy: {
      '/api': {
      target: 'http://backend:2000',
      changeOrigin: true,
      },
    },
  }
})

// export default {
//   server: {
//     host: true,   // ou '0.0.0.0'
//     port: 5173,
//   }
// }
