import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o navegador fala só com o Vite (5174), que repassa /api para o servidor (3100).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:3100' } },
});
