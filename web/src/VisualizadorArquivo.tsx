// Visualizador de arquivos dentro do portal: PDF, Word (.docx), texto (.txt, .csv) e imagens, com maximizar, imprimir e baixar.
// O arquivo vem do próprio servidor (mesma origem, com a sessão da pessoa); nada é enviado para fora. Word antigo (.doc) e
// outros formatos não têm pré-visualização no navegador: a janela avisa e deixa o download disponível.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './icones';

export interface ArquivoParaVer { titulo: string; /** rota do arquivo (ex.: /api/documentos/<slug>/arquivo) */ url: string; /** dica do tipo (ex.: "PDF"); o nome real vem do servidor */ formato?: string }
type Conteudo =
  | { tipo: 'pdf'; blobUrl: string }
  | { tipo: 'imagem'; blobUrl: string }
  | { tipo: 'html'; html: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'csv'; linhas: string[][] }
  | { tipo: 'sem-previa'; ext: string };

const nomeDoCabecalho = (cd: string | null) => {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd ?? '');
  try { return m ? decodeURIComponent(m[1]) : ''; } catch { return ''; }
};
const extensao = (nome: string, mime: string) => {
  const e = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase();
  if (e) return e;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return mime.slice(6).replace('jpeg', 'jpg');
  if (mime.startsWith('text/csv')) return 'csv';
  if (mime.startsWith('text/')) return 'txt';
  return '';
};

/** CSV simples (separador ; ou ,), com aspas. */
function lerCsv(t: string): string[][] {
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

const ESTILO_DOC = `body{font:14px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#1a1a1a;background:#fff;margin:0;padding:28px 36px;max-width:820px}
img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}
h1,h2,h3{line-height:1.25}a{color:#0b5cad}@media print{body{padding:0;max-width:none}}`;

export function VisualizadorArquivo({ arquivo, aoFechar }: { arquivo: ArquivoParaVer; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const quadro = useRef<HTMLIFrameElement>(null);
  const [grande, setGrande] = useState(false);
  const [conteudo, setConteudo] = useState<Conteudo | null>(null);
  const [nome, setNome] = useState(arquivo.titulo);
  const [erro, setErro] = useState('');
  const sep = arquivo.url.includes('?') ? '&' : '?';
  const urlBaixar = `${arquivo.url}${sep}baixar=1`;

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    let vivo = true; let blobUrl = '';
    (async () => {
      try {
        const r = await fetch(arquivo.url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(r.status === 403 ? 'Você não tem permissão para abrir este documento.' : 'Não foi possível abrir o arquivo. Ele pode ter sido movido ou removido.');
        const arq = nomeDoCabecalho(r.headers.get('Content-Disposition'));
        const ext = extensao(arq, r.headers.get('Content-Type') ?? '');
        if (!vivo) return;
        if (arq) setNome(arq);
        if (ext === 'pdf' || /^(png|jpe?g|gif|webp)$/.test(ext)) {
          const b = await r.blob(); if (!vivo) return;
          blobUrl = URL.createObjectURL(b);
          setConteudo(ext === 'pdf' ? { tipo: 'pdf', blobUrl } : { tipo: 'imagem', blobUrl });
        } else if (ext === 'docx') {
          const buf = await r.arrayBuffer();
          const mammoth = await import('mammoth');
          const out = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (vivo) setConteudo({ tipo: 'html', html: out.value || '<p>(documento sem texto)</p>' });
        } else if (ext === 'csv') {
          const t = await r.text(); if (vivo) setConteudo({ tipo: 'csv', linhas: lerCsv(t) });
        } else if (ext === 'txt') {
          const t = await r.text(); if (vivo) setConteudo({ tipo: 'texto', texto: t });
        } else if (vivo) setConteudo({ tipo: 'sem-previa', ext: ext.toUpperCase() });
      } catch (e) {
        if (vivo) setErro(e instanceof Error && e.message ? e.message : 'Não foi possível abrir o arquivo.');
      }
    })();
    return () => { vivo = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [arquivo.url]);

  const fechar = () => { ref.current?.close(); aoFechar(); };
  const imprimir = () => {
    const w = quadro.current?.contentWindow;
    if (w) { try { w.focus(); w.print(); return; } catch { /* cai no plano B */ } }
    if (conteudo && 'blobUrl' in conteudo) window.open(conteudo.blobUrl, '_blank', 'noopener');
  };
  const podeImprimir = !!conteudo && conteudo.tipo !== 'sem-previa';
  const doc = (corpo: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${ESTILO_DOC}</style></head><body>${corpo}</body></html>`;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

  let palco: React.ReactNode;
  if (erro) palco = <p className="erro" role="alert">{erro}</p>;
  else if (!conteudo) palco = <p className="suave" role="status">Carregando o arquivo…</p>;
  else if (conteudo.tipo === 'pdf') palco = <iframe ref={quadro} className="visual-quadro" src={conteudo.blobUrl} title={`Documento ${nome}`} />;
  else if (conteudo.tipo === 'imagem') palco = <img className="visual-imagem" src={conteudo.blobUrl} alt={`Documento ${nome}`} />;
  // sandbox sem scripts: o conteúdo do Word nunca executa nada; allow-same-origin deixa o botão Imprimir chamar o print do quadro
  else if (conteudo.tipo === 'html') palco = <iframe ref={quadro} className="visual-quadro visual-papel" sandbox="allow-same-origin allow-modals" srcDoc={doc(conteudo.html)} title={`Documento ${nome}`} />;
  else if (conteudo.tipo === 'texto') palco = <iframe ref={quadro} className="visual-quadro visual-papel" sandbox="allow-same-origin allow-modals" srcDoc={doc(`<pre style="white-space:pre-wrap;font:13px/1.5 Consolas,monospace;margin:0">${esc(conteudo.texto)}</pre>`)} title={`Documento ${nome}`} />;
  else if (conteudo.tipo === 'csv') palco = <iframe ref={quadro} className="visual-quadro visual-papel" sandbox="allow-same-origin allow-modals" srcDoc={doc(`<table>${conteudo.linhas.map((l, i) => `<tr>${l.map((c) => `<${i === 0 ? 'th' : 'td'}>${esc(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table>`)} title={`Documento ${nome}`} />;
  else palco = <div className="visual-sem-previa"><Icone nome="documentos" tamanho={40} /><p><b>Este formato não tem pré-visualização{conteudo.ext ? ` (${conteudo.ext})` : ''}.</b></p><p className="suave">Use o botão Baixar para abrir o arquivo no seu computador.</p></div>;

  // Portal no <body>: o clique dentro da janela não sobe para a tela de trás.
  return createPortal(
    <dialog ref={ref} className={`janela janela-visual${grande ? ' janela-visual-grande' : ''}`} aria-label={`Visualizar ${arquivo.titulo}`}
      onCancel={(e) => { e.preventDefault(); e.stopPropagation(); fechar(); }}
      onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) fechar(); }}>
      <div className="janela-form visual-form">
        <header className="visual-topo">
          <h2 className="visual-titulo" title={nome}>{arquivo.titulo}</h2>
          <div className="visual-acoes">
            <button type="button" className="icone-btn" onClick={() => setGrande(!grande)} aria-pressed={grande} aria-label={grande ? 'Reduzir janela' : 'Maximizar janela'} title={grande ? 'Reduzir' : 'Maximizar'}><Icone nome={grande ? 'minimizar' : 'maximizar'} /></button>
            <button type="button" className="icone-btn" onClick={imprimir} disabled={!podeImprimir} aria-label="Imprimir documento" title="Imprimir"><Icone nome="imprimir" /></button>
            <a className="icone-btn" href={urlBaixar} download aria-label="Baixar documento" title="Baixar"><Icone nome="baixar" /></a>
            <button type="button" className="icone-btn" onClick={fechar} aria-label="Fechar" title="Fechar" autoFocus><Icone nome="fechar" /></button>
          </div>
        </header>
        <div className="visual-palco">{palco}</div>
      </div>
    </dialog>, document.body);
}
