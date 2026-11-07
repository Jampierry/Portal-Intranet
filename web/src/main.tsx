import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './estilo.css';
import './portal.css';

createRoot(document.getElementById('raiz')!).render(<App />);
