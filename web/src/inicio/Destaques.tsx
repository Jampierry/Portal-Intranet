import { useEffect, useRef, useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Destaque } from '../dados';
import { Capa } from '../Capa';

const ROTULOS = { mes: 'Destaque do mês', ano: 'Destaque do ano' } as const;
const ROTULOS_CURTOS = { mes: 'Mês', ano: 'Ano' } as const;
const POR_VEZ = 3;

/** Carrossel do colaborador destaque (mês/ano). Compacto = uma pessoa por vez. Rotação lenta, pausável e desligada com movimento reduzido. Sem ranking. */
export function Destaques({ compacto = false }: { compacto?: boolean }) {
  const porVez = compacto ? 1 : POR_VEZ;
  const { dados } = useLista<Destaque>('/api/destaques');
  const [tipo, setTipo] = useState<'mes' | 'ano'>('mes');
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [reduzido, setReduzido] = useState(false);
  const itens = (dados ?? []).filter((d) => d.tipo === tipo);
  const paginas = Math.max(1, Math.ceil(itens.length / porVez));
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
  const visiveis = itens.slice(pag * porVez, pag * porVez + porVez);

  return (
    <section className={`cartao-sec destaques${compacto ? ' compacto' : ''}`} aria-labelledby="dest-titulo">
      <div className="sec-topo">
        <h2 id="dest-titulo"><Icone nome="pessoas" tamanho={compacto ? 22 : 24} /> Colaborador Destaque</h2>
        <div className="abas" role="tablist" aria-label="Período dos destaques" ref={abas}>
          {(['mes', 'ano'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tipo === t} onClick={() => { setTipo(t); setI(0); }}>{compacto ? ROTULOS_CURTOS[t] : ROTULOS[t]}</button>
          ))}
        </div>
        <button className="btn-pausa" disabled={reduzido} aria-pressed={!girando} title={girando ? 'Pausar animação' : 'Retomar animação'} aria-label={girando ? 'Pausar animação' : 'Retomar animação'} onClick={() => setAuto((a) => !a)}>
          <span className="icone-btn"><Icone nome={girando ? 'pausa' : 'tocar'} tamanho={14} /></span>{!compacto && (reduzido ? 'Movimento reduzido' : girando ? 'Pausar animação' : 'Retomar animação')}
        </button>
      </div>
      {itens.length === 0 ? <p className="vazio">Sem destaques publicados.</p> : (
        <>
          <div className="carrossel" aria-live={girando ? 'off' : 'polite'}>
            <button className="seta-car" onClick={() => mover(-1)} aria-label="Colaborador anterior"><Icone nome="esq" /></button>
            <div className="pessoas">
              {visiveis.map((d) => (
                <article className="pessoa" key={d.nome}>
                  <Capa semente={d.nome} icone="pessoas" foto={d.foto} classe="capa-pessoa">{!d.foto && <span className="iniciais-capa">{d.iniciais}</span>}</Capa>
                  <div><h3>{d.nome}</h3><small className="area">{d.area}</small><p>{d.apresentacao}</p></div>
                </article>
              ))}
            </div>
            <button className="seta-car" onClick={() => mover(1)} aria-label="Próximo colaborador"><Icone nome="dir" /></button>
          </div>
          <div className="pontos" aria-label={`Página ${pag + 1} de ${paginas}`}>
            {Array.from({ length: paginas }, (_, n) => <button key={n} aria-label={`Ir para a página ${n + 1}`} aria-current={n === pag ? 'true' : undefined} onClick={() => setI(n)} />)}
          </div>
        </>
      )}
    </section>
  );
}
