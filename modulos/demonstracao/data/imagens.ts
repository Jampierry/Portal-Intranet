// Imagens FICTÍCIAS do pacote de exemplo, geradas em código (SVG abstrato, sem fotos nem pessoas reais).
// São gravadas no banco quando os dados de exemplo são ligados; nada fica em arquivo.
let sem = 11;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) >>> 0) / 4294967296);

const PALETAS = [
  ['#5b2a4e', '#c8553d', '#f4d6a0'], ['#1f3a4d', '#3a8f85', '#f2e8cf'], ['#3d2b56', '#8e5ea2', '#f7c6c7'],
  ['#2b4a3a', '#7aa874', '#f6efd9'], ['#4a2b2b', '#d98f3e', '#fbe9c6'], ['#24324f', '#e0675a', '#fdf1de'],
  ['#2e2e3a', '#6c8ebf', '#e9eef7'], ['#503a2b', '#b5651d', '#f8e5c8'],
];
export const TEMAS_CAPA = ['pessoas', 'operacao', 'qualidade', 'seguranca', 'eventos', 'ti', 'comercial', 'beneficios', 'treinamento', 'campanha', 'colecao', 'resultados'] as const;
export type TemaCapa = (typeof TEMAS_CAPA)[number];

/** Capa 800x450: degradê, círculos e linhas de costura. Sempre igual para o mesmo tema. */
export function capa(tema: TemaCapa): string {
  sem = 11 + TEMAS_CAPA.indexOf(tema) * 977;
  const i = TEMAS_CAPA.indexOf(tema);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="Imagem ilustrativa fictícia: ${tema}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/>${formas}${costura}${faixa}</svg>`;
}

const PELE = ['#f1c8a5', '#d9a47c', '#b57a52', '#8a5a3c', '#e8b98f', '#6e4a33'];
const CABELO = ['#2b1d14', '#5a3825', '#1c1c1c', '#8a5a2b', '#3b2f2f', '#a8743a'];
const ROUPA = ['#5b2a4e', '#c8553d', '#3a8f85', '#24324f', '#8e5ea2', '#d98f3e'];
const FUNDO = ['#f4e3d3', '#e3ecf0', '#efe3f1', '#e5efe2', '#f6e6e0', '#e8e8f2'];
export const QTD_AVATARES = 12;

/** Avatar ilustrado 240x240 (silhueta geométrica; não é foto de ninguém). */
export function avatar(i: number): string {
  const p = PELE[i % 6], h = CABELO[(i * 5 + 1) % 6], r = ROUPA[(i * 7 + 2) % 6], f = FUNDO[(i * 3) % 6];
  const longo = i % 3 === 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Avatar ilustrado fictício"><rect width="240" height="240" fill="${f}"/>` +
    `<path d="M30 240 C 40 175, 85 160, 120 160 C 155 160, 200 175, 210 240 Z" fill="${r}"/>` +
    `<rect x="104" y="128" width="32" height="40" rx="12" fill="${p}"/>` +
    (longo ? `<ellipse cx="120" cy="104" rx="52" ry="58" fill="${h}"/>` : '') +
    `<ellipse cx="120" cy="100" rx="38" ry="44" fill="${p}"/>` +
    `<path d="M80 92 C 82 56, 158 56, 160 92 C 150 76, 100 72, 80 92 Z" fill="${h}"/>` +
    `<circle cx="106" cy="104" r="3.5" fill="#2b1d14"/><circle cx="134" cy="104" r="3.5" fill="#2b1d14"/>` +
    `<path d="M108 122 Q120 131 132 122" stroke="#7a3b2e" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}

// Marca da empresa FICTÍCIA "Aurora Esportes": um sol nascente (aurora) sobre uma faixa de linhas.
const SOL = (cor: string, cor2: string) => `<circle cx="40" cy="34" r="17" fill="${cor}"/><g stroke="${cor2}" stroke-width="3.2" stroke-linecap="round"><path d="M12 56h56"/><path d="M18 64h44"/><path d="M26 72h28"/></g>`;
/** Ícone quadrado da empresa (aba Empresa › Ícone). */
export const ICONE_EMPRESA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="Aurora Esportes"><rect width="80" height="80" rx="18" fill="#e4572e"/><circle cx="40" cy="36" r="17" fill="#ffd166"/><g stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"><path d="M12 58h56"/><path d="M18 66h44"/></g></svg>`;
/** Logo larga: tema claro (letras escuras) e tema escuro (letras claras). */
export const logoEmpresa = (escuro: boolean) => {
  const texto = escuro ? '#ffffff' : '#2b1d3a';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 80" role="img" aria-label="Aurora Esportes">${SOL('#ff9f1c', escuro ? '#ffffff' : '#e4572e')}<text x="88" y="46" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="-1" fill="${texto}">aurora</text><text x="89" y="66" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="600" letter-spacing="3.5" fill="${escuro ? '#ff9f1c' : '#e4572e'}">ESPORTES</text></svg>`;
};
