// Gera os ícones PNG do portal (192 e 512) a partir de web/public/icone.svg, com o Edge/Chromium do Playwright.
// Uso: node scripts/gerar-icones.mjs   (substitui o antigo gerar-icones.ps1, que desenhava o ícone antigo)
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../web/public/icone.svg', import.meta.url), 'utf8');
const pasta = new URL('../web/public/icones/', import.meta.url);
mkdirSync(pasta, { recursive: true });
const navegador = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
for (const tamanho of [192, 512]) {
  const p = await navegador.newPage({ viewport: { width: tamanho, height: tamanho } });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${tamanho}px;height:${tamanho}px}</style>${svg}`);
  await p.screenshot({ path: new URL(`icone-${tamanho}.png`, pasta).pathname.replace(/^\/([A-Za-z]:)/, '$1'), omitBackground: true });
  await p.close();
}
await navegador.close();
console.log('Ícones gerados: icone-192.png e icone-512.png');
