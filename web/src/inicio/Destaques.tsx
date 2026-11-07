import { useEffect, useRef, useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Destaque } from '../dados';
import { Capa } from '../Capa';

const ROTULOS = { mes: 'Destaque do mês', ano: 'Destaques do ano' } as const;
const POR_VEZ = 3;

/** Carrossel de pessoas em destaque (mês/ano). Rotação lenta, pausável e desligada com movimento reduzido. Sem ranking. */
export function Destaques() {
  const { dados } = useLista<Destaque>('/api/destaques');
  const [tipo, setTipo] = useState<'mes' | 'ano'>('mes');
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [reduzido, setReduzido] = useState(false);
  const itens = (dados ?? []).filter((d) => d.tipo === tipo);
  const paginas = Math.max(1, Math.ceil(itens.length / POR_VEZ));
  const pag = i % paginas;
  const girando = auto && !reduzido;
  const abas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setReduzido(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    if (!girando || paginas < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % paginas), 7200);
    return () => clearInterval(t);
  }, [girando, paginas]);

  const mover = (d: -1 | 1) => setI((x) => (x + d + paginas) % paginas);
  const visiveis = itens.slice(pag * POR_VEZ, pag * POR_VEZ + POR_VEZ);

  return (
    <section className="cartao-sec destaques" aria-labelledby="dest-titulo">
      <div className="sec-topo">
        <h2 id="dest-titulo"><Icone nome="pessoas" tamanho={24} /> Pessoas em destaque</h2>
        <div className="abas" role="tablist" aria-label="Período dos destaques" ref={abas}>
          {(['mes', 'ano'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tipo === t} onClick={() => { setTipo(t); setI(0); }}>{ROTULOS[t]}</button>
          ))}
        </div>
        <button className="btn-pausa" disabled={reduzido} aria-pressed={!girando} onClick={() => setAuto((a) => !a)}>
          <span className="icone-btn"><Icone nome={girando ? 'pausa' : 'tocar'} tamanho={14} /></span>{reduzido ? 'Movimento reduzido' : girando ? 'Pausar animação' : 'Retomar animação'}
        </button>
      </div>
      {itens.length === 0 ? <p className="vazio">Sem destaques publicados.</p> : (
        <>
          <div className="carrossel" aria-live={girando ? 'off' : 'polite'}>
            <button className="seta-car" onClick={() => mover(-1)} aria-label="Pessoas anteriores"><Icone nome="esq" /></button>
            <div className="pessoas">
              {visiveis.map((d) => (
                <article className="pessoa" key={d.nome}>
                  <Capa semente={d.nome} icone="pessoas" classe="capa-pessoa"><span className="iniciais-capa">{d.iniciais}</span></Capa>
                  <div><h3>{d.nome}</h3><small className="area">{d.area}</small><p>{d.apresentacao}</p></div>
                </article>
              ))}
            </div>
            <button className="seta-car" onClick={() => mover(1)} aria-label="Próximas pessoas"><Icone nome="dir" /></button>
          </div>
          <div className="pontos" aria-label={`Página ${pag + 1} de ${paginas}`}>
            {Array.from({ length: paginas }, (_, n) => <button key={n} aria-label={`Ir para a página ${n + 1}`} aria-current={n === pag ? 'true' : undefined} onClick={() => setI(n)} />)}
          </div>
        </>
      )}
    </section>
  );
}
