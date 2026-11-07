import { useEffect, useState, type ReactNode } from 'react';
import { Icone } from '../icones';
import { LinkApp } from '../aplicacoes/LinkApp';
import type { Banner } from '../dados';
import type { Tela } from '../Menu';

const TELAS_LINK = ['inicio', 'comunicados', 'documentos', 'publicar', 'configuracoes', 'pessoas', 'ajuda'];

/** Um carrossel (grande ou menor). Todos recebem o mesmo "tick" e por isso giram juntos; setas e pontos só deslocam este carrossel. */
function Carrossel({ lista, tick, irPara, menor, titulo, pausa }: {
  lista: Banner[]; tick: number; irPara: (t: Tela, slug?: string) => void; menor?: boolean; titulo: string;
  pausa?: { parado: boolean; alternar: () => void; reduzido: boolean };
}) {
  const n = lista.length;
  const [desvio, setDesvio] = useState(0);
  const atual = (((tick + desvio) % n) + n) % n;
  const abrir = (link: string) => {
    const [t, slug] = link.slice(1).split('/');
    if (TELAS_LINK.includes(t)) irPara(t as Tela, slug ? decodeURIComponent(slug) : undefined);
  };
  return (
    <section className={`hero novidades${menor ? ' menor' : ''}`} aria-roledescription="carrossel" aria-label={titulo}>
      {lista.map((b, k) => (
        <div key={b.id} className={`slide${k === atual ? ' ativo' : ''}`} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${n}`} aria-hidden={k !== atual}>
          {b.imagem ? <img className="slide-fundo" src={b.imagem} alt="" /> : <span className="slide-fundo slide-cor" />}
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
        <button className="nov-pausa" disabled={pausa.reduzido} aria-pressed={pausa.parado} onClick={pausa.alternar} aria-label={pausa.parado ? 'Retomar rotação dos banners' : 'Pausar rotação dos banners'}>
          <Icone nome={pausa.parado || pausa.reduzido ? 'tocar' : 'pausa'} tamanho={14} />
        </button>
      )}
    </section>
  );
}

/** Topo do Início: um carrossel grande (esquerda) e até dois menores (direita), girando juntos.
 *  Cada banner escolhe em qual carrossel aparece (Publicar › Banners). Carrossel grande vazio = faixa padrão. */
export function Novidades({ banners, irPara, padrao }: { banners: Banner[]; irPara: (t: Tela, slug?: string) => void; padrao: ReactNode }) {
  const por = (p: string) => banners.filter((b) => b.posicao === p);
  const principal = por('principal');
  const laterais = [por('lateral1'), por('lateral2')].filter((l) => l.length > 0);
  const maior = Math.max(principal.length, ...laterais.map((l) => l.length));

  const [tick, setTick] = useState(0);
  const [sobre, setSobre] = useState(false);
  const [parado, setParado] = useState(false);
  const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const girando = maior > 1 && !sobre && !parado && !reduzido;
  useEffect(() => {
    if (!girando) return;
    const t = setInterval(() => setTick((x) => x + 1), 6500);
    return () => clearInterval(t);
  }, [girando]);

  const pausa = { parado, alternar: () => setParado(!parado), reduzido };
  const comPausa = (idx: number) => (maior > 1 && idx === 0 ? pausa : undefined); // um botão de pausa só, no primeiro carrossel exibido
  const titulos = ['Destaques', 'Avisos rápidos', 'Mais novidades'];

  return (
    <div className={`novidades-grade${laterais.length === 0 ? ' so-principal' : ''}`}
      onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)} onFocus={() => setSobre(true)} onBlur={() => setSobre(false)}>
      {principal.length > 0
        ? <Carrossel lista={principal} tick={tick} irPara={irPara} titulo={titulos[0]} pausa={comPausa(0)} />
        : <div className="nov-slot">{padrao}</div>}
      {laterais.length > 0 && (
        <div className="nov-laterais" style={{ gridTemplateRows: `repeat(${laterais.length}, minmax(0, 1fr))` }}>
          {laterais.map((l, k) => <Carrossel key={l[0].posicao} lista={l} tick={tick} irPara={irPara} menor titulo={titulos[k + 1]} pausa={principal.length === 0 ? comPausa(k) : undefined} />)}
        </div>
      )}
    </div>
  );
}
