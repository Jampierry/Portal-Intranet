// Tira os prints dos manuais (docs/manuais/img/*.png) com setas e contornos em destaque (azul elétrico com halo branco,
// legível em tema claro e escuro). Usa o portal em desenvolvimento (BASE_URL, padrão http://localhost:5174) com os dados de
// exemplo e o login admin/admin123. Só lê telas e abre formulários: NUNCA salva nada.
//   npm run manuais:prints [nome-do-roteiro]     (o portal precisa estar no ar: npm run dev)
// Os roteiros (o que fotografar e o que apontar) ficam em scripts/manuais-roteiros.mjs.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5174';
const SAIDA = resolve(import.meta.dirname, '..', 'docs', 'manuais', 'img');
mkdirSync(SAIDA, { recursive: true });
const COR = '#1E6BFF';
const AVATAR_DOS_PRINTS = 4;

/** Desenha setas (e contorno) sobre os alvos da página atual. Cada marca: { alvo: Locator, rotulo?, lado: 'esq'|'dir'|'cima'|'baixo', contorno?: false }. */
async function marcar(page, marcas) {
  const dados = [];
  for (const m of marcas) {
    const loc = m.alvo.first();
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const b = await loc.boundingBox();
    if (!b) throw new Error(`alvo sem caixa: ${m.rotulo}`);
    dados.push({ b, rotulo: m.rotulo ?? '', lado: m.lado ?? 'esq', contorno: m.contorno !== false });
  }
  await page.evaluate(({ dados, COR }) => {
    document.getElementById('anot')?.remove();
    const NS = 'http://www.w3.org/2000/svg';
    const vw = innerWidth, vh = innerHeight;
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'anot';
    svg.setAttribute('width', vw); svg.setAttribute('height', vh);
    // O portal usa `zoom` no <html> (escala automática); o inverso aqui deixa o desenho em pixels reais da tela.
    const z = parseFloat(document.documentElement.style.zoom) || 1;
    svg.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;zoom:${1 / z}`;
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<marker id="ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COR}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></marker>`;
    svg.appendChild(defs);
    // Formulários são <dialog> (camada superior da página): o desenho precisa estar dentro dele para aparecer por cima.
    const hospedeiro = document.querySelector('dialog[open]') ?? document.body;
    if (hospedeiro !== document.body) { window.__ovf = hospedeiro.style.overflow; hospedeiro.style.overflow = 'visible'; } // setas fora da janela não podem ser cortadas
    hospedeiro.appendChild(svg);
    { const r = svg.getBoundingClientRect(); svg.style.left = `${-r.left}px`; svg.style.top = `${-r.top}px`; } // dialog com vidro vira referência do fixed: realinha à tela
    const el = (nome, attrs) => { const e = document.createElementNS(NS, nome); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.appendChild(e); return e; };
    for (const { b, rotulo, lado, contorno } of dados) {
      const pad = 4;
      if (contorno) {
        const caixa = { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2, rx: 8, fill: 'none' };
        el('rect', { ...caixa, stroke: '#fff', 'stroke-width': 6 });
        el('rect', { ...caixa, stroke: COR, 'stroke-width': 3 });
      }
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2, comp = 64, folga = pad + 5;
      const pontas = {
        esq: [b.x - folga, cy, -comp, 0], dir: [b.x + b.width + folga, cy, comp, 0],
        cima: [cx, b.y - folga, 0, -comp], baixo: [cx, b.y + b.height + folga, 0, comp],
      };
      let [fx, fy, dx, dy] = pontas[lado];
      // Se a seta sair da tela, vai para o lado oposto do alvo.
      if (fx + dx < 8 || fx + dx > vw - 8 || fy + dy < 8 || fy + dy > vh - 8) {
        const op = { esq: 'dir', dir: 'esq', cima: 'baixo', baixo: 'cima' }[lado];
        [fx, fy, dx, dy] = pontas[op];
      }
      const ini = [fx + dx, fy + dy];
      const linha = { x1: ini[0], y1: ini[1], x2: fx, y2: fy, 'stroke-linecap': 'round' };
      el('line', { ...linha, stroke: '#fff', 'stroke-width': 9 });
      el('line', { ...linha, stroke: COR, 'stroke-width': 5, 'marker-end': 'url(#ponta)' });
      if (rotulo) {
        const t = el('text', { x: 0, y: 0, 'font-size': 14, 'font-weight': 700, 'font-family': 'system-ui, sans-serif', fill: '#fff', 'dominant-baseline': 'middle' });
        t.textContent = rotulo;
        const tb = t.getBBox();
        svg.removeChild(t);
        const px = 9, py = 6, w = tb.width + px * 2, h = tb.height + py * 2;
        let rx = dx < 0 ? ini[0] - w - 4 : dx > 0 ? ini[0] + 4 : ini[0] - w / 2;
        let ry = dy < 0 ? ini[1] - h - 4 : dy > 0 ? ini[1] + 4 : ini[1] - h / 2;
        rx = Math.max(6, Math.min(vw - w - 6, rx)); ry = Math.max(6, Math.min(vh - h - 6, ry));
        el('rect', { x: rx, y: ry, width: w, height: h, rx: 7, fill: COR, stroke: '#fff', 'stroke-width': 2 });
        t.setAttribute('x', rx + px); t.setAttribute('y', ry + h / 2);
        svg.appendChild(t);
      }
    }
  }, { dados, COR });
}

async function tirar(page, nome, marcas = [], opcoes = {}) {
  await page.waitForTimeout(opcoes.espera ?? 500);
  if (marcas.length) await marcar(page, marcas);
  await page.screenshot({ path: resolve(SAIDA, `${nome}.png`), clip: opcoes.clip });
  await page.evaluate(() => { document.getElementById('anot')?.remove(); const d = document.querySelector('dialog[open]'); if (d && window.__ovf !== undefined) d.style.overflow = window.__ovf; });
  console.log('ok', nome);
}

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const tema = (modo = 'claro') => JSON.stringify({ modo, estilo: 'dipaula', menuRecolhido: false, escala: 100 });

async function nova(largura, altura, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'pt-BR' });
  const page = await ctx.newPage();
  // Nos prints a pessoa aparece com o avatar da galeria (número 4: careca com barba, fundo coral), nunca com a foto real do cadastro.
  await page.addInitScript(([t, av]) => { try { localStorage.setItem('portal.tema', t); localStorage.setItem('portal.avatar.admin', av); } catch { /* sem armazenamento */ } }, [tema(), String(AVATAR_DOS_PRINTS)]);
  // Dados pessoais de quem roda o script NUNCA entram nos prints (eles vão para o Git e para a organização):
  // todo e-mail e telefone que aparece numa resposta da API vira um valor fictício, e o perfil pessoal é trocado por um exemplo.
  const ehJson = (url) => { const c = new URL(url).pathname; return c.startsWith('/api/') && !/\/(videos|imagens|manifest|ajuda\/manuais\/img)/.test(c); }; // mídia e imagens passam direto
  await page.route((url) => ehJson(url.href), async (rota) => {
   try {
    const resposta = await rota.fetch();
    if (!(resposta.headers()['content-type'] ?? '').includes('json')) return rota.fulfill({ response: resposta });
    let texto = await resposta.text();
    texto = texto.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'maria.exemplo@exemplo.com.br').replace(/\(\d{2}\) ?9?\d{4}-\d{4}/g, '(62) 99999-0000');
    if (new URL(rota.request().url()).pathname === '/api/eu/perfil') {
      const d = JSON.parse(texto);
      Object.assign(d, { foto: null, apelido: 'Maria Exemplo', emergencia1_nome: 'Contato Exemplo', emergencia1_parent: 'Familiar', emergencia1_tel: '(62) 99999-1111' });
      texto = JSON.stringify(d);
    }
    await rota.fulfill({ response: resposta, body: texto });
   } catch { /* página fechada no meio da requisição */ }
  });
  return page;
}
async function entrar(page, login = 'admin', senha = 'admin123') {
  await page.goto(BASE);
  await page.getByLabel('Login').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.locator('.rodape-portal').waitFor();
  const popup = page.locator('.pulso-overlay');
  if (await popup.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false)) await page.keyboard.press('Escape');
}
const menu = (page, nome) => page.getByRole('navigation', { name: 'Seções do portal' }).getByRole('button', { name: nome, exact: true });
const ir = async (page, nome) => { await menu(page, nome).click(); await page.waitForTimeout(700); };

const { roteiros } = await import('./manuais-roteiros.mjs');
const so = process.argv[2];
for (const [nome, fn] of Object.entries(roteiros)) {
  if (so && so !== nome) continue;
  try { await fn({ nova, entrar, menu, ir, tirar, BASE }); } catch (e) { console.error('FALHOU', nome, '-', String(e.message).split('\n')[0]); process.exitCode = 1; }
}
await browser.close();
