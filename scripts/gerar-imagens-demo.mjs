// Gera imagens FICTÍCIAS (SVG, desenhos abstratos, sem fotos nem pessoas reais) para testar o portal com dados.
// Uso: npm run demo:imagens  → grava em web/public/demo/
import { mkdirSync, writeFileSync } from 'node:fs';

const pasta = new URL('../web/public/demo/', import.meta.url);
mkdirSync(pasta, { recursive: true });

let sem = 11;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) >>> 0) / 4294967296);
const grava = (nome, svg) => writeFileSync(new URL(nome, pasta), svg);

// Capas de comunicado 800x450: fundo em degradê + formas (tecido, linhas de costura, círculos).
const PALETAS = [
  ['#5b2a4e', '#c8553d', '#f4d6a0'], ['#1f3a4d', '#3a8f85', '#f2e8cf'], ['#3d2b56', '#8e5ea2', '#f7c6c7'],
  ['#2b4a3a', '#7aa874', '#f6efd9'], ['#4a2b2b', '#d98f3e', '#fbe9c6'], ['#24324f', '#e0675a', '#fdf1de'],
  ['#2e2e3a', '#6c8ebf', '#e9eef7'], ['#503a2b', '#b5651d', '#f8e5c8'],
];
const TEMAS = ['pessoas', 'operacao', 'qualidade', 'seguranca', 'eventos', 'ti', 'comercial', 'beneficios', 'treinamento', 'campanha', 'colecao', 'resultados'];

TEMAS.forEach((tema, i) => {
  const [a, b, c] = PALETAS[i % PALETAS.length];
  let formas = '';
  for (let k = 0; k < 7; k++) {
    const x = Math.round(rnd() * 800), y = Math.round(rnd() * 450), r = 40 + Math.round(rnd() * 130);
    formas += `<circle cx="${x}" cy="${y}" r="${r}" fill="${k % 2 ? c : b}" opacity="${(0.12 + rnd() * 0.2).toFixed(2)}"/>`;
  }
  let costura = '';
  for (let k = 0; k < 6; k++) {
    const y = 60 + k * 62 + Math.round(rnd() * 20);
    costura += `<path d="M-20 ${y} C 200 ${y - 50}, 520 ${y + 60}, 820 ${y - 20}" stroke="${c}" stroke-width="2" stroke-dasharray="10 9" fill="none" opacity=".35"/>`;
  }
  const faixa = `<rect x="0" y="${300 + (i % 3) * 20}" width="800" height="26" fill="${c}" opacity=".18" transform="skewY(-6)"/>`;
  grava(`capa-${tema}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="Imagem ilustrativa fictícia: ${tema}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/>${formas}${costura}${faixa}</svg>`);
});

// Avatares ilustrados 240x240 (silhueta geométrica, não é foto de ninguém).
const PELE = ['#f1c8a5', '#d9a47c', '#b57a52', '#8a5a3c', '#e8b98f', '#6e4a33'];
const CABELO = ['#2b1d14', '#5a3825', '#1c1c1c', '#8a5a2b', '#3b2f2f', '#a8743a'];
const ROUPA = ['#5b2a4e', '#c8553d', '#3a8f85', '#24324f', '#8e5ea2', '#d98f3e'];
const FUNDO = ['#f4e3d3', '#e3ecf0', '#efe3f1', '#e5efe2', '#f6e6e0', '#e8e8f2'];
for (let i = 0; i < 12; i++) {
  const p = PELE[i % 6], h = CABELO[(i * 5 + 1) % 6], r = ROUPA[(i * 7 + 2) % 6], f = FUNDO[(i * 3) % 6];
  const longo = i % 3 === 0;
  grava(`avatar-${String(i + 1).padStart(2, '0')}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Avatar ilustrado fictício"><rect width="240" height="240" fill="${f}"/>` +
    `<path d="M30 240 C 40 175, 85 160, 120 160 C 155 160, 200 175, 210 240 Z" fill="${r}"/>` +
    `<rect x="104" y="128" width="32" height="40" rx="12" fill="${p}"/>` +
    (longo ? `<ellipse cx="120" cy="104" rx="52" ry="58" fill="${h}"/>` : '') +
    `<ellipse cx="120" cy="100" rx="38" ry="44" fill="${p}"/>` +
    `<path d="M80 92 C 82 56, 158 56, 160 92 C 150 76, 100 72, 80 92 Z" fill="${h}"/>` +
    `<circle cx="106" cy="104" r="3.5" fill="#2b1d14"/><circle cx="134" cy="104" r="3.5" fill="#2b1d14"/>` +
    `<path d="M108 122 Q120 131 132 122" stroke="#7a3b2e" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`);
}
console.log(`Imagens geradas em web/public/demo/ (${TEMAS.length} capas, 12 avatares).`);
