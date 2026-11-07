import { useEffect, useState } from 'react';
import { Icone } from '../icones';
import { LinkApp } from '../aplicacoes/LinkApp';
import type { Banner } from '../dados';
import type { Tela } from '../Menu';

const TELAS_LINK = ['inicio', 'comunicados', 'documentos', 'publicar', 'configuracoes', 'pessoas', 'ajuda'];

/** Carrossel "Novidades da semana": banners cadastrados em Publicar › Banners. Gira sozinho, pausa com o mouse/foco e respeita "reduzir movimento". */
export function Novidades({ banners, irPara }: { banners: Banner[]; irPara: (t: Tela, slug?: string) => void }) {
  const n = banners.length;
  const [i, setI] = useState(0);
  const [sobre, setSobre] = useState(false);
  const [parado, setParado] = useState(false);
  const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const girando = n > 1 && !sobre && !parado && !reduzido;
  const atual = n === 0 ? 0 : Math.min(i, n - 1);

  useEffect(() => {
    if (!girando) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6500);
    return () => clearInterval(t);
  }, [girando, n]);

  const ir = (d: number) => setI((atual + d + n) % n);
  const abrir = (link: string) => {
    const [t, slug] = link.slice(1).split('/');
    if (TELAS_LINK.includes(t)) irPara(t as Tela, slug ? decodeURIComponent(slug) : undefined);
  };

  return (
    <section className="hero novidades" aria-roledescription="carrossel" aria-label="Novidades da semana"
      onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)} onFocus={() => setSobre(true)} onBlur={() => setSobre(false)}>
      {banners.map((b, k) => (
        <div key={b.id} className={`slide${k === atual ? ' ativo' : ''}`} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${n}`} aria-hidden={k !== atual}>
          {b.imagem ? <img className="slide-fundo" src={b.imagem} alt="" /> : <span className="slide-fundo slide-cor" />}
          <span className="slide-veu" />
          <div className="slide-texto">
            <small className="eyebrow">NOVIDADES DA SEMANA</small>
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
          <button className="nov-seta esq" onClick={() => ir(-1)} aria-label="Banner anterior"><Icone nome="esq" /></button>
          <button className="nov-seta dir" onClick={() => ir(1)} aria-label="Próximo banner"><Icone nome="dir" /></button>
          <div className="nov-pontos">
            {banners.map((b, k) => <button key={b.id} aria-label={`Ir para o banner ${k + 1}`} aria-current={k === atual ? 'true' : undefined} onClick={() => setI(k)} />)}
          </div>
          <button className="nov-pausa" disabled={reduzido} aria-pressed={parado} onClick={() => setParado(!parado)} aria-label={parado ? 'Retomar rotação' : 'Pausar rotação'}>
            <Icone nome={parado || reduzido ? 'tocar' : 'pausa'} tamanho={14} />
          </button>
        </>
      )}
    </section>
  );
}
