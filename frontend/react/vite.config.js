/*
  vite.config.js

  Configuración de Vite para el frontend React.

  ¿Por qué existe?
  - Vite permite configurar el servidor de desarrollo (puerto, proxy, etc.).
  - El frontend React se ejecuta en un puerto distinto al backend.

  ¿Para qué sirve?
  - Define el puerto 5173.
  - Configura proxy para:
    - /api -> backend (evita problemas de CORS y URLs hardcodeadas).
    - /src/assets -> backend (portadas/imágenes servidas como estáticos).
*/

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // Las portadas se sirven como archivos estáticos desde el backend.
      // En React (Vite) las imágenes se piden como /src/assets/images/<archivo>.
      // Este proxy evita tener que hardcodear la URL completa del backend.
      '/src/assets': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
