// Auditoria de contraste (WCAG) de cada combinação estilo × modo.
// Lê as variáveis de web/src/estilo.css e os dados de web/src/temas-dados.ts; nenhuma cor é repetida aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTILOS } from '../src/temas-dados.ts';

const css = readFileSync(new URL('../src/estilo.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Vars = Record<string, string>;
const variaveis = (corpo: string): Vars =>
  Object.fromEntries([...corpo.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)].map((m) => [m[1], m[2].toLowerCase()]));
// Une todos os blocos que casam (o mesmo seletor pode aparecer mais de uma vez).
const bloco = (seletor: RegExp): Vars =>
  Object.assign({}, ...[...css.matchAll(new RegExp(seletor.source, 'gm'))].map((m) => variaveis(m[1])));

const base: Vars = Object.assign({}, ...[...css.matchAll(/^:root\s*\{([^}]*)\}/gm)].map((m) => variaveis(m[1])));
const escuroComum = bloco(/:root\[data-tema=escuro\]\s*\{([^}]*)\}/);
const porEstilo = (modo: string, estilo: string): Vars =>
  bloco(new RegExp(`:root\\[data-tema=${modo}\\]\\[data-estilo=${estilo}\\]\\s*\\{([^}]*)\\}`));

// ---- cores
type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const h = hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const lum = ([r, g, b]: RGB) => {
  const [R, G, B] = [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const contraste = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** color-mix(in srgb, a pct%, b) */
const mix = (a: RGB, pct: number, b: RGB): RGB => a.map((v, i) => v * pct + b[i] * (1 - pct)) as RGB;
const BRANCO: RGB = [255, 255, 255], PRETO: RGB = [0, 0, 0];

interface Par { nome: string; texto: RGB; fundo: RGB; minimo: number }

function pares(estilo: string, modo: 'claro' | 'escuro'): Par[] {
  const v: Vars = { ...base, ...(modo === 'escuro' ? escuroComum : {}), ...porEstilo(modo, estilo) };
  const c = (n: string) => rgb(v[n]);
  const fundo = c('fundo'), card = c('card'), texto = c('texto'), menu = c('menu');
  const suave = mix(texto, 0.66, card);
  const lista: Par[] = [
    { nome: 'texto sobre fundo', texto, fundo, minimo: 4.5 },
    { nome: 'texto sobre card', texto, fundo: card, minimo: 4.5 },
    { nome: 'texto suave sobre card', texto: suave, fundo: card, minimo: 4.5 },
    { nome: 'texto do menu', texto: c('menu-texto'), fundo: menu, minimo: 4.5 },
    { nome: 'texto suave do menu', texto: c('menu-suave'), fundo: menu, minimo: 4.5 },
    { nome: 'status ok sobre card', texto: c('ok'), fundo: card, minimo: 4.5 },
    { nome: 'status erro sobre card', texto: c('erro'), fundo: card, minimo: 4.5 },
  ];
  const acentos: { nome: string; cor: string; sobre: RGB }[] = [
    { nome: 'padrão do estilo', cor: v['acento-padrao'], sobre: c('sobre-acento') },
  ];
  for (const a of acentos) {
    const cor = rgb(a.cor);
    lista.push({ nome: `texto sobre o destaque "${a.nome}"`, texto: a.sobre, fundo: cor, minimo: 4.5 });
    const vinhoTexto = modo === 'escuro' ? mix(cor, 0.5, BRANCO) : mix(cor, 0.5, PRETO);
    lista.push({ nome: `destaque "${a.nome}" como texto sobre card`, texto: vinhoTexto, fundo: card, minimo: 4.5 });
  }
  // Botões de ação coloridos: texto sobre o fundo tonal (13% da cor sobre o card) e, ao passar o mouse, card sobre a cor cheia.
  const vt = rgb(v['acento-padrao']);
  const vinhoTexto = modo === 'escuro' ? mix(vt, 0.5, BRANCO) : mix(vt, 0.5, PRETO);
  for (const n of ['azul', 'laranja', 'verde', 'roxo', 'vermelho']) {
    const cor = mix(c(n), 0.85, vinhoTexto);
    lista.push({ nome: `botão ${n}`, texto: cor, fundo: mix(cor, 0.13, card), minimo: 4.5 });
    lista.push({ nome: `botão ${n} ao passar o mouse`, texto: card, fundo: cor, minimo: 4.5 });
  }
  return lista;
}

test('contraste mínimo em todas as combinações de estilo × modo', () => {
  const falhas: string[] = [];
  for (const e of ESTILOS) {
    for (const modo of ['claro', 'escuro'] as const) {
      for (const p of pares(e.id, modo)) {
        const r = contraste(p.texto, p.fundo);
        if (r < p.minimo) falhas.push(`${e.id} ${modo}: ${p.nome} = ${r.toFixed(2)}:1 (mínimo ${p.minimo})`);
      }
    }
  }
  assert.deepEqual(falhas, [], `\n${falhas.length} falha(s) de contraste:\n - ` + falhas.join('\n - '));
});

test('escuro não usa fundo quase-preto (piso de luminância)', () => {
  const baixos: string[] = [];
  for (const e of ESTILOS) {
    const v = { ...base, ...escuroComum, ...porEstilo('escuro', e.id) };
    for (const n of ['fundo', 'menu']) if (lum(rgb(v[n])) < lum(rgb('#121212')) * 0.85) baixos.push(`${e.id}: --${n} ${v[n]}`);
  }
  assert.deepEqual(baixos, [], `\nquase-preto no escuro:\n - ` + baixos.join('\n - '));
});
