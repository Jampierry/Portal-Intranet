// Miniatura "só a página" de um documento, sem barras nem moldura de programa: PDF e imagem viram uma imagem; Word, Excel, CSV e texto
// viram o conteúdo da primeira página (HTML mostrado em um quadro isolado, sem scripts). Outros formatos não têm miniatura.
import { extensao, lerCsv, lerPlanilha, nomeDoCabecalho } from './arquivos';

export type Miniatura = { tipo: 'imagem'; url: string } | { tipo: 'pagina'; html: string };
export const LIMITE_MINIATURA = 12 * 1024 * 1024;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const tabela = (linhas: string[][]) => `<table>${linhas.slice(0, 40).map((l, i) => `<tr>${l.slice(0, 12).map((c) => `<${i === 0 ? 'th' : 'td'}>${esc(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table>`;

/** Primeira página de um PDF desenhada como imagem (leitor próprio do portal, sem a barra do leitor de PDF do navegador). */
async function paginaDoPdf(dados: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(dados), isEvalSupported: false }).promise;
  try {
    const pagina = await pdf.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const vp = pagina.getViewport({ scale: 420 / base.width });
    const tela = document.createElement('canvas');
    tela.width = Math.ceil(vp.width); tela.height = Math.ceil(vp.height);
    const ctx = tela.getContext('2d');
    if (!ctx) throw new Error('sem canvas');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) throw new Error('sem imagem');
    return URL.createObjectURL(blob);
  } finally { void pdf.destroy(); }
}

/** Baixa o documento e monta a miniatura; devolve null quando o formato não tem miniatura ou o arquivo passa do limite. */
export async function montarMiniatura(url: string, sinal: AbortSignal): Promise<Miniatura | null> {
  const r = await fetch(url, { credentials: 'same-origin', signal: sinal });
  if (!r.ok || Number(r.headers.get('content-length') ?? 0) > LIMITE_MINIATURA) return null;
  const ext = extensao(nomeDoCabecalho(r.headers.get('Content-Disposition')), r.headers.get('Content-Type') ?? '');
  if (/^(png|jpe?g|gif|webp)$/.test(ext)) return { tipo: 'imagem', url: URL.createObjectURL(await r.blob()) };
  if (!['pdf', 'docx', 'xlsx', 'csv', 'txt'].includes(ext)) return null;
  const buf = await r.arrayBuffer();
  if (buf.byteLength > LIMITE_MINIATURA) return null;
  if (ext === 'pdf') return { tipo: 'imagem', url: await paginaDoPdf(buf) };
  if (ext === 'docx') { const mammoth = await import('mammoth'); return { tipo: 'pagina', html: (await mammoth.convertToHtml({ arrayBuffer: buf })).value || '<p></p>' }; }
  if (ext === 'xlsx') return { tipo: 'pagina', html: tabela(await lerPlanilha(buf, 40)) };
  const texto = new TextDecoder().decode(buf.slice(0, 20000));
  return ext === 'csv' ? { tipo: 'pagina', html: tabela(lerCsv(texto)) } : { tipo: 'pagina', html: `<pre style="white-space:pre-wrap;font:13px/1.5 Consolas,monospace;margin:0">${esc(texto)}</pre>` };
}
