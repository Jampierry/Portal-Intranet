import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o navegador fala só com o Vite (5174), que repassa /api para o servidor (3100).
export default defineConfig({
  plugins: [react()],
  // changeOrigin:false mantém o Host original (ex.: 192.168.x.x:5174 no celular): a checagem de origem do servidor compara Origin com Host.
  server: { port: 5174, proxy: { '/api': { target: 'http://127.0.0.1:3100', changeOrigin: false } } },
});
