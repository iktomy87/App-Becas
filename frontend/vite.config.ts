import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Destino del proxy: lo consume ESTE archivo, en el servidor de Vite. Por eso
// la variable NO lleva el prefijo `VITE_`.
//
// Ojo: Vite mete en el bundle del navegador toda variable de entorno con
// prefijo `VITE_`, así que si el destino del proxy se llamara `VITE_API_URL`
// acabaría también en `config.ts` como `API_BASE_URL` y el navegador pediría
// `http://app:3000`. El nombre `app` sólo resuelve dentro de la red de compose
// (docker-compose.dev.yml), no en el host, así que la respuesta del navegador es
// "NetworkError when attempting to fetch resource" sin llegar a ningún servidor.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

// Host al que el navegador (en el host de Docker) debe conectar el WebSocket de HMR.
// En Docker: 'localhost' (el puerto 5173 está mapeado al host).
// En dev nativo: también 'localhost', por lo que el default siempre funciona.
const hmrHost = process.env.VITE_HMR_HOST ?? 'localhost'
const hmrPort = parseInt(process.env.VITE_HMR_PORT ?? '5173', 10)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // escucha en todas las interfaces (necesario en Docker)
    port: 5173,
    hmr: {
      // Le dice al cliente del navegador a dónde conectar el WebSocket de HMR.
      // Sin esto, dentro de Docker el WS apunta a la IP interna del contenedor
      // (ej. 172.19.0.5) en lugar de localhost → NetworkError.
      host: hmrHost,
      port: hmrPort,
    },
    proxy: {
      // Reenvía al backend las rutas raíz que expone. La lista tiene que
      // coincidir con los @Controller de nivel raíz de backend/src; hoy son
      // tres: convocatorias, propuestas y especialidades.
      //
      // Antes listaba también `importacion` y `padron`, que no existen como
      // prefijos raíz (viven bajo `convocatorias/:id/...`), y le faltaba
      // `especialidades`, que sí. Con esa lista, `/especialidades` caía en el
      // `try_files` de Vite y devolvía 404 en vez de llegar al backend.
      // Si se agrega un @Controller raíz nuevo, hay que agregarlo acá.
      '^/(convocatorias|propuestas|especialidades)': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})


