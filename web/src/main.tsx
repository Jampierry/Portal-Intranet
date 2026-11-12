import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ConfirmarHost } from './Confirmar.tsx';
import './estilo.css';
import './css/parte-01.css';
import './css/parte-02.css';
import './css/parte-03.css';
import './css/parte-04.css';
import './css/parte-05.css';
import './css/parte-06.css';
import './css/parte-07.css';
import './css/parte-08.css';
import './css/parte-09.css';
import './css/parte-10.css';
import './css/parte-11.css';

createRoot(document.getElementById('raiz')!).render(<><App /><ConfirmarHost /></>);

// PWA: registra o service worker só no site publicado (em desenvolvimento ele atrapalharia o recarregamento do Vite).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* sem service worker o portal funciona igual, só não instala */ }); });
}
