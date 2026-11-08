// PWA: manifesto completo, ícones existentes e service worker que nunca guarda dados da API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const publico = (p: string) => new URL(`../public/${p}`, import.meta.url);
const manifesto = JSON.parse(readFileSync(publico('manifest.webmanifest'), 'utf8')) as { name: string; short_name: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose?: string }[]; theme_color: string };

test('manifesto instalável: nome, página inicial, modo standalone e ícones de 192 e 512 que existem', () => {
  assert.ok(manifesto.name && manifesto.short_name && manifesto.theme_color);
  assert.equal(manifesto.start_url, '/');
  assert.equal(manifesto.display, 'standalone');
  const tamanhos = manifesto.icons.map((i) => i.sizes);
  assert.ok(tamanhos.includes('192x192') && tamanhos.includes('512x512'));
  assert.ok(manifesto.icons.some((i) => i.purpose === 'maskable'));
  for (const i of manifesto.icons) assert.ok(existsSync(publico(i.src.slice(1))), `ícone ausente: ${i.src}`);
});

test('a página liga o manifesto e o service worker é registrado só em produção', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /name="theme-color"/);
  assert.match(readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8'), /import\.meta\.env\.PROD[\s\S]*serviceWorker\.register\('\/sw\.js'\)/);
});

test('o service worker deixa /api e outras origens direto na rede (nada de dados no cache) e guarda só a casca', () => {
  const sw = readFileSync(publico('sw.js'), 'utf8');
  assert.match(sw, /startsWith\('\/api\/'\)\) return/);
  assert.match(sw, /url\.origin !== location\.origin/);
  assert.match(sw, /req\.method !== 'GET'\) return/);
  assert.doesNotMatch(sw, /caches\.open\([^)]*\)\.then\(\(c\) => c\.put\('\/api/);
});
