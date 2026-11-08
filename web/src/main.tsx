import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './estilo.css';
import './portal.css';

createRoot(document.getElementById('raiz')!).render(<App />);

// PWA: registra o service worker só no site publicado (em desenvolvimento ele atrapalharia o recarregamento do Vite).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* sem service worker o portal funciona igual, só não instala */ }); });
}
