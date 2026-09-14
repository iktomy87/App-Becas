import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Reenvía al backend todo lo que NO sea un asset del frontend.
      // La regex captura cualquier ruta que empiece por uno de estos prefijos de API.
      '^/(convocatorias|propuestas|ranking|importacion|padron)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})


