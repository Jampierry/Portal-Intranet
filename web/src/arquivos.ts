// Leitura de arquivos no navegador, compartilhada pelo visualizador de documentos e pela prévia dos cartões.

export const nomeDoCabecalho = (cd: string | null) => {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd ?? '');
  try { return m ? decodeURIComponent(m[1]) : ''; } catch { return ''; }
};
export const extensao = (nome: string, mime: string) => {
  const e = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase();
  if (e) return e;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return mime.slice(6).replace('jpeg', 'jpg');
  if (mime.startsWith('text/csv')) return 'csv';
  if (mime.startsWith('text/')) return 'txt';
  return '';
};

/** CSV simples (separador ; ou ,), com aspas. */
export function lerCsv(t: string): string[][] {
  const sep = (t.split('\n', 1)[0].match(/;/g)?.length ?? 0) >= (t.split('\n', 1)[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: string[][] = []; let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); campo = ''; linhas.push(linha); linha = []; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.slice(0, 2000);
}

export const ESTILO_DOC = `body{font:14px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#1a1a1a;background:#fff;margin:0;padding:28px 36px;max-width:820px}
img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}
h1,h2,h3{line-height:1.25}a{color:#0b5cad}@media print{body{padding:0;max-width:none}}`;

const letrasParaIndice = (ref: string) => { let n = 0; for (const ch of /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? '') n = n * 26 + (ch.charCodeAt(0) - 64); return Math.max(0, n - 1); };

/** Primeira planilha de um arquivo Excel (.xlsx) como linhas de texto (até `maxLinhas` linhas e 20 colunas). Só lê; nada é executado. */
export async function lerPlanilha(buf: ArrayBuffer, maxLinhas = 2000): Promise<string[][]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = async (nome: string) => { const f = zip.file(nome); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const comp = await xml('xl/sharedStrings.xml');
  const textos = comp ? [...comp.getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('')) : [];
  let caminho = 'xl/worksheets/sheet1.xml';
  const [wb, rels] = [await xml('xl/workbook.xml'), await xml('xl/_rels/workbook.xml.rels')];
  const rid = wb?.getElementsByTagName('sheet')[0]?.getAttribute('r:id');
  const alvo = rid && rels ? [...rels.getElementsByTagName('Relationship')].find((x) => x.getAttribute('Id') === rid)?.getAttribute('Target') : null;
  if (alvo) caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
  const folha = await xml(caminho);
  if (!folha) return [];
  const linhas: string[][] = [];
  for (const row of [...folha.getElementsByTagName('row')].slice(0, maxLinhas)) {
    const cel: string[] = [];
    for (const c of [...row.getElementsByTagName('c')]) {
      const col = letrasParaIndice(c.getAttribute('r') ?? '');
      if (col >= 20) continue;
      const t = c.getAttribute('t');
      let v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      if (t === 's') v = textos[Number(v)] ?? '';
      else if (t === 'inlineStr') v = [...c.getElementsByTagName('t')].map((x) => x.textContent ?? '').join('');
      cel[col] = v;
    }
    linhas.push(Array.from(cel, (x) => x ?? ''));
  }
  return linhas;
}
