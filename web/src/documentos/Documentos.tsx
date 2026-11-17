import { avisar } from '../Confirmar.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icone } from '../icones';
import { iconePorTexto } from '../iconesAuto';
import { Cabecalho, Estado } from '../Cabecalho';
import { LinkApp } from '../aplicacoes/LinkApp';
import { dataCurta, useLista, type Documento } from '../dados';
import { VisualizadorArquivo, type ArquivoParaVer } from '../VisualizadorArquivo';
import { ESTILO_DOC } from '../arquivos';
import { montarMiniatura, type Miniatura } from '../previaDocumento';

/** Navegador não abre pasta de rede a partir de página web: o botão copia o caminho para colar no Explorer. */
function CopiarCaminho({ caminho }: { caminho: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { if (!copiado) return; const t = setTimeout(() => setCopiado(false), 2500); return () => clearTimeout(t); }, [copiado]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(caminho); } catch { void avisar({ titulo: 'Copie o caminho', mensagem: caminho }); }
    setCopiado(true);
  };
  return <button type="button" className="btn btn-pri btn-pequeno abrir-doc" onClick={copiar} title={caminho}>{copiado ? 'Caminho copiado!' : 'Copiar caminho de rede'}</button>;
}

const LARGURA_PAGINA = 640; // largura (em px) com que o conteúdo do Word/Excel é montado antes de ser reduzido para caber no quadro
const ESTILO_MINIATURA = `${ESTILO_DOC}body{padding:30px 34px;max-width:none;overflow:hidden}`;

/** Conteúdo da primeira página (Word, Excel, CSV, texto) reduzido para caber no quadro, sem nenhuma barra: só a página. */
function PaginaReduzida({ html }: { html: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ escala: 0.2, altura: 800 });
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => { if (el.clientWidth > 0) setMedida({ escala: el.clientWidth / LARGURA_PAGINA, altura: el.clientHeight / (el.clientWidth / LARGURA_PAGINA) }); };
    medir();
    const o = new ResizeObserver(medir); o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div className="doc-pagina" ref={caixa}>
      <iframe sandbox="" title="" tabIndex={-1} scrolling="no" style={{ width: LARGURA_PAGINA, height: medida.altura, transform: `scale(${medida.escala})` }}
        srcDoc={`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${ESTILO_MINIATURA}</style></head><body>${html}</body></html>`} />
    </div>
  );
}

/** Miniatura do documento no cartão: só a página (PDF e imagem como imagem; Word, Excel, CSV e texto como página reduzida), sem barras
 *  de leitor. Só carrega quando o cartão aparece na tela e só para arquivos do portal de até 12 MB; os demais formatos mostram o ícone do tipo. */
function PreviaDoDocumento({ url, formato, titulo }: { url: string; formato: string; titulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [mini, setMini] = useState<Miniatura | null>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return; }
    const o = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setVisivel(true); o.disconnect(); } }, { rootMargin: '150px' });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!visivel) return;
    const ctl = new AbortController();
    let criada = '';
    montarMiniatura(url, ctl.signal).then((m) => { if (m?.tipo === 'imagem') criada = m.url; if (!ctl.signal.aborted) setMini(m); }).catch(() => { /* sem miniatura: fica o ícone */ });
    return () => { ctl.abort(); if (criada) URL.revokeObjectURL(criada); };
  }, [visivel, url]);
  return (
    <div className={`doc-previa${mini ? ' pronta' : ''}`} ref={caixa} aria-hidden={mini ? undefined : true}>
      {mini?.tipo === 'imagem' && <img src={mini.url} alt={`Prévia de ${titulo}`} />}
      {mini?.tipo === 'pagina' && <PaginaReduzida html={mini.html} />}
      {!mini && <span className="doc-previa-vazia"><Icone nome="documentos" tamanho={28} /><small>{formato}</small></span>}
    </div>
  );
}

export function Documentos({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const { dados, erro } = useLista<Documento>('/api/documentos');
  const [categoria, setCategoria] = useState('Todas');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((d) => d.categoria))], [dados]);
  const [q, setQ] = useState('');
  const [vendo, setVendo] = useState<ArquivoParaVer | null>(null);
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');
  const termos = [norm(busca), norm(q)].filter(Boolean);
  const lista = (dados ?? []).filter((d) =>
    (categoria === 'Todas' || d.categoria === categoria) && termos.every((t) => [d.titulo, d.resumo, d.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(t))));
  const limpar = () => { limparBusca(); setQ(''); setCategoria('Todas'); };
  return (
    <>
      <Cabecalho titulo="Documentos" sub="Procedimentos, políticas e materiais da equipe, sempre com versão e responsável." />
      <label className="busca-pagina">
        <Icone nome="busca" tamanho={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, assunto ou categoria" aria-label="Buscar documentos" />
      </label>
      <div className="barra">
        <div className="pilulas filtros" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => <button key={c} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={limpar} />
      <div className="grade-docs">
        {lista.map((d) => (
          <article className="cartao-doc" key={d.slug}>
            <span className="icone"><Icone nome={iconePorTexto(`${d.categoria} ${d.titulo}`, 'documentos')} tamanho={22} /></span>
            <div className="texto"><h3>{d.titulo}</h3><p>{d.resumo}</p><small>{d.categoria} · {d.formato}{d.link_oficial ? '' : ' · sem link oficial'}</small>
              {(d.versao || d.responsavel) && <dl className="meta-doc">{d.versao && <div><dt>Versão</dt><dd>{d.versao}</dd></div>}{d.responsavel && <div><dt>Responsável</dt><dd>{d.responsavel}</dd></div>}{d.revisado_em && <div><dt>Revisado em</dt><dd>{dataCurta(d.revisado_em)}</dd></div>}</dl>}
              {d.link_oficial && (d.origem === 'rede'
                ? <CopiarCaminho caminho={d.link_oficial} />
                : (d.origem === 'pasta' || d.origem === 'servidor') && d.link_oficial.startsWith('/')
                ? <button type="button" className="btn btn-pri btn-pequeno abrir-doc" onClick={() => setVendo({ titulo: d.titulo, url: d.link_oficial!, formato: d.formato })}>Visualizar <Icone nome="documentos" tamanho={13} /></button>
                : <LinkApp url={d.link_oficial} className="btn btn-pri btn-pequeno abrir-doc">Abrir documento <Icone nome="externo" tamanho={13} /></LinkApp>)}</div>
            {d.link_oficial?.startsWith('/')
              ? <PreviaDoDocumento url={d.link_oficial} formato={d.formato} titulo={d.titulo} />
              : <div className="doc-previa" aria-hidden="true"><span className="doc-previa-vazia"><Icone nome="documentos" tamanho={28} /><small>{d.formato}</small></span></div>}
          </article>
        ))}
      </div>
      {vendo && <VisualizadorArquivo arquivo={vendo} aoFechar={() => setVendo(null)} />}
    </>
  );
}
