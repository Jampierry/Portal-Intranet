import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone } from '../icones';
import { LinkApp } from '../aplicacoes/LinkApp';
import type { Banner } from '../dados';
import type { Tela } from '../Menu';
import { ehVideo, VideoFundo } from '../midia';
import { api } from '../api';
import { modoAbertura, urlSegura } from '../links';
import { VisualizadorArquivo, type ArquivoParaVer } from '../VisualizadorArquivo';

const TELAS_LINK = ['inicio', 'comunicados', 'documentos', 'publicar', 'configuracoes', 'pessoas', 'ajuda'];

/** Fundo do banner que aproveita o máximo do card: se a proporção da imagem/vídeo é próxima da do card (corte de até ~28%), ele preenche tudo;
 *  se for muito diferente (ex.: vídeo vertical), aparece inteiro e as sobras são preenchidas com a própria mídia desfocada. */
export function FundoSlide({ imagem, tocando = true }: { imagem?: string | null; tocando?: boolean }) {
  const caixa = useRef<HTMLSpanElement>(null);
  const [razao, setRazao] = useState<number | null>(null); // largura ÷ altura da mídia
  const [cartao, setCartao] = useState(0); // largura ÷ altura do card
  useEffect(() => {
    const medir = () => { const c = caixa.current; if (c && c.clientHeight > 0) setCartao(c.clientWidth / c.clientHeight); };
    medir();
    const o = typeof ResizeObserver === 'function' && caixa.current ? new ResizeObserver(medir) : null;
    if (o && caixa.current) o.observe(caixa.current);
    return () => o?.disconnect();
  }, []);
  useEffect(() => { setRazao(null); }, [imagem]);
  if (!imagem) return <span className="slide-fundo slide-cor" />;
  const medido = (l: number, a: number) => { if (l > 0 && a > 0) setRazao(l / a); };
  const corte = razao && cartao ? 1 - Math.min(razao, cartao) / Math.max(razao, cartao) : 0; // fração da mídia que o "cover" cortaria
  const inteira = corte > 0.28;
  const video = ehVideo(imagem);
  const principal = video
    ? <VideoFundo className={`slide-fundo${inteira ? ' contido' : ''}`} src={imagem} tocando={tocando} aoMedir={medido} />
    : <img className={`slide-fundo${inteira ? ' contido' : ''}`} src={imagem} alt="" onLoad={(e) => medido(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} />;
  return (
    <span className="slide-fundo slide-caixa" ref={caixa}>
      {inteira && (video
        ? <VideoFundo className="slide-fundo slide-desfoque" src={imagem} tocando={tocando} />
        : <img className="slide-fundo slide-desfoque" src={imagem} alt="" aria-hidden="true" />)}
      {principal}
    </span>
  );
}

/** Um carrossel (grande ou menor). Todos recebem o mesmo "tick" e por isso giram juntos; setas e pontos só deslocam este carrossel. */
function Carrossel({ lista, tick, irPara, abrirDoc, menor, titulo, pausa, parado }: {
  lista: Banner[]; tick: number; irPara: (t: Tela, slug?: string) => void; abrirDoc: (slug: string) => void; menor?: boolean; titulo: string; /** Botão de pausa apertado: vídeos também param. */ parado?: boolean;
  pausa?: { parado: boolean; alternar: () => void; reduzido: boolean };
}) {
  const n = lista.length;
  const [desvio, setDesvio] = useState(0);
  const atual = (((tick + desvio) % n) + n) % n;
  const abrir = (link: string) => {
    const [t, slug] = link.slice(1).split('/');
    if (t === 'documentos' && slug) { abrirDoc(decodeURIComponent(slug)); return; } // documento escolhido: abre no visualizador, sem sair do Início
    if (TELAS_LINK.includes(t)) irPara(t as Tela, slug ? decodeURIComponent(slug) : undefined);
  };
  return (
    <section className={`hero novidades${menor ? ' menor' : ''}`} aria-roledescription="carrossel" aria-label={titulo}>
      {lista.map((b, k) => (
        <div key={b.id} className={`slide${k === atual ? ' ativo' : ''}`} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${n}`} aria-hidden={k !== atual}>
          <FundoSlide imagem={b.imagem} tocando={k === atual && !parado} />
          <span className="slide-veu" />
          <div className="slide-texto">
            {!menor && <small className="eyebrow">NOVIDADES DA SEMANA</small>}
            <h2>{b.titulo}</h2>
            {b.subtitulo && <p>{b.subtitulo}</p>}
            {b.link && b.botao_texto && (b.link.startsWith('#')
              ? <button className="btn btn-coral" onClick={() => abrir(b.link!)}>{b.botao_texto} <Icone nome="seta" tamanho={16} /></button>
              : <LinkApp url={b.link} className="btn btn-coral">{b.botao_texto} <Icone nome="seta" tamanho={16} /></LinkApp>)}
          </div>
        </div>
      ))}
      {n > 1 && (
        <>
          <button className="nov-seta esq" onClick={() => setDesvio(desvio - 1)} aria-label={`${titulo}: anterior`}><Icone nome="esq" /></button>
          <button className="nov-seta dir" onClick={() => setDesvio(desvio + 1)} aria-label={`${titulo}: próximo`}><Icone nome="dir" /></button>
          <div className="nov-pontos">
            {lista.map((b, k) => <button key={b.id} aria-label={`${titulo}: ir para o banner ${k + 1}`} aria-current={k === atual ? 'true' : undefined} onClick={() => setDesvio(k - tick)} />)}
          </div>
        </>
      )}
      {pausa && (
        <button className="nov-pausa" aria-pressed={pausa.parado} onClick={pausa.alternar} aria-label={pausa.parado ? 'Retomar rotação dos banners' : 'Pausar rotação dos banners'}>
          <Icone nome={pausa.parado ? 'tocar' : 'pausa'} tamanho={14} />
        </button>
      )}
    </section>
  );
}

/** true enquanto a janela casa com a media query (acompanha redimensionar e girar o celular). */
function useMedia(consulta: string): boolean {
  const [ok, setOk] = useState(() => typeof matchMedia === 'function' && matchMedia(consulta).matches);
  useEffect(() => {
    const m = matchMedia(consulta);
    const f = () => setOk(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [consulta]);
  return ok;
}

/** Topo do Início: um carrossel grande (esquerda) e até dois menores (direita), girando juntos.
 *  Cada banner escolhe em qual carrossel aparece (Publicar › Banners). Carrossel grande vazio = faixa padrão.
 *  No celular (até 700 px) não cabem três faixas: viram um carrossel só, na ordem esquerda, meio, direita; terminados os da esquerda, entram os do meio e assim por diante. */
export function Novidades({ banners, irPara, padrao }: { banners: Banner[]; irPara: (t: Tela, slug?: string) => void; padrao: ReactNode }) {
  const por = (p: string) => banners.filter((b) => b.posicao === p);
  const principal = por('principal'), meio = por('lateral1'), direita = por('lateral2');
  const movel = useMedia('(max-width: 700px)');
  const unico = [...principal, ...meio, ...direita];
  const maior = movel ? unico.length : Math.max(principal.length, meio.length, direita.length);

  const [tick, setTick] = useState(0);
  const [sobre, setSobre] = useState(false);
  const [parado, setParado] = useState(false);
  const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const girando = maior > 1 && !sobre && !parado; // gira sozinho mesmo com "reduzir animações" no Windows (a troca é só um esmaecer suave)
  useEffect(() => {
    if (!girando) return;
    const t = setInterval(() => setTick((x) => x + 1), 6500);
    return () => clearInterval(t);
  }, [girando]);

  const [vendo, setVendo] = useState<ArquivoParaVer | null>(null);
  const abrirDoc = (slug: string) => {
    api<{ slug: string; titulo: string; formato: string; link_oficial: string | null }[]>('/api/documentos').then((lista) => {
      const d = lista.find((x) => x.slug === slug);
      if (d?.link_oficial?.startsWith('/')) setVendo({ titulo: d.titulo, url: d.link_oficial, formato: d.formato });
      else if (d?.link_oficial && urlSegura(d.link_oficial)) { const m = modoAbertura(window.innerWidth); window.open(d.link_oficial, m.target, m.rel); }
      else irPara('documentos');
    }).catch(() => irPara('documentos'));
  };
  const visualizador = vendo && <VisualizadorArquivo arquivo={vendo} aoFechar={() => setVendo(null)} />;
  const pausa = { parado, alternar: () => setParado(!parado), reduzido };
  const primeiroComBanner = [principal, meio, direita].findIndex((l) => l.length > 0); // um botão de pausa só, no primeiro carrossel que tem banner
  const comPausa = (idx: number) => (maior > 1 && idx === primeiroComBanner ? pausa : undefined);

  if (movel) {
    return (
      <div className="novidades-grade so-principal" onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)}>
        {unico.length > 0
          ? <Carrossel lista={unico} tick={tick} irPara={irPara} abrirDoc={abrirDoc} titulo="Novidades" pausa={comPausa(primeiroComBanner)} parado={parado} />
          : <div className="nov-slot">{padrao}</div>}
        {visualizador}
      </div>
    );
  }

  // Os três carrosséis aparecem sempre; o que não tem banner mostra uma arte fixa com o propósito dele.
  const slots = [
    { lista: principal, titulo: 'Destaques', menor: false },
    { lista: meio, titulo: 'Avisos rápidos', menor: true },
    { lista: direita, titulo: 'Mais novidades', menor: true },
  ];
  return (
    <div className="novidades-grade"
      onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)} onFocus={(e) => { if (e.target.matches(':focus-visible')) setSobre(true); }} onBlur={() => setSobre(false)}>
      {slots.map((s, k) => s.lista.length > 0
        ? <Carrossel key={k} lista={s.lista} tick={tick} irPara={irPara} abrirDoc={abrirDoc} menor={s.menor} titulo={s.titulo} pausa={comPausa(k)} parado={parado} />
        : k === 0 ? <div className="nov-slot" key={k}>{padrao}</div> : <SlotVazio key={k} k={k} titulo={s.titulo} />)}
      {visualizador}
    </div>
  );
}

const TEXTO_VAZIO = [
  { icone: 'estrela', texto: 'Os grandes destaques e novidades da empresa aparecem aqui.' },
  { icone: 'sino', texto: 'Lembretes e avisos rápidos para o dia a dia aparecem aqui.' },
  { icone: 'calendario', texto: 'Campanhas, eventos e novidades da semana aparecem aqui.' },
];
/** Arte fixa de um carrossel sem banner: ícone, nome e para que ele serve. */
function SlotVazio({ k, titulo }: { k: number; titulo: string }) {
  const { icone, texto } = TEXTO_VAZIO[k] ?? TEXTO_VAZIO[0];
  return (
    <section className="hero novidades menor nov-vazio" aria-label={`${titulo}: nenhuma publicação no momento`}>
      <span className="slide-fundo slide-cor" />
      <span className="nov-vazio-aneis" aria-hidden="true" />
      <div className="nov-vazio-conteudo">
        <span className="nov-vazio-icone"><Icone nome={icone} tamanho={22} /></span>
        <div><h3>{titulo}</h3><p>{texto}</p></div>
      </div>
    </section>
  );
}
