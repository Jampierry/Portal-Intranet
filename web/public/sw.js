// Service worker do portal (PWA). Faz o portal poder ser instalado e abrir mesmo sem rede (só a casca: telas, estilos e ícones).
// Nunca guarda dados: nada de /api (comunicados, pessoas, documentos…) passa por aqui, sempre vem do servidor.
// Estratégia: páginas = rede primeiro, com a última cópia como reserva; arquivos de /assets (nome com hash) = cache primeiro.
const VERSAO = 'portal-v1';
const CASCA = ['/', '/icone.svg', '/manifest.webmanifest', '/icones/icone-192.png', '/icones/icone-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // dados e outros sites: direto na rede
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copia = r.clone(); void caches.open(VERSAO).then((c) => c.put('/', copia)); return r; }).catch(() => caches.match('/').then((r) => r ?? Response.error())));
    return;
  }
  if (url.pathname.startsWith('/assets/') || CASCA.includes(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r ?? fetch(req).then((n) => { if (n.ok) { const copia = n.clone(); void caches.open(VERSAO).then((c) => c.put(req, copia)); } return n; })));
  }
});
