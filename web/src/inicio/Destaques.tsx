import { useEffect, useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Destaque } from '../dados';

const ROTULOS = { mes: 'Destaque do mês', ano: 'Destaques do ano' } as const;

/** Carrossel de pessoas em destaque (mês/ano). Rotação lenta, pausável e desligada com movimento reduzido. Sem ranking. */
export function Destaques() {
  const { dados } = useLista<Destaque>('/api/destaques');
  const [tipo, setTipo] = useState<'mes' | 'ano'>('mes');
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [reduzido, setReduzido] = useState(false);
  const itens = (dados ?? []).filter((d) => d.tipo === tipo);
  const girando = auto && !reduzido;

  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setReduzido(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    if (!girando || itens.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % itens.length), 7200);
    return () => clearInterval(t);
  }, [girando, itens.length]);

  const mover = (d: -1 | 1) => setI((x) => (x + d + itens.length) % itens.length);
  const atual = itens[i % Math.max(itens.length, 1)];

  return (
    <section className="cartao destaques" aria-labelledby="dest-titulo">
      <div className="barra">
        <div><h2 id="dest-titulo">Pessoas em destaque</h2><small className="suave">Reconhecimento demonstrativo — nomes e histórias fictícios.</small></div>
        <div className="pilulas" role="tablist" aria-label="Período dos destaques">
          {(['mes', 'ano'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tipo === t} aria-pressed={tipo === t} onClick={() => { setTipo(t); setI(0); }}>{ROTULOS[t]}</button>
          ))}
        </div>
      </div>
      {!atual ? <p className="vazio">Sem destaques publicados.</p> : (
        <>
          <article className="destaque-pessoa" aria-live={girando ? 'off' : 'polite'}>
            <span className="av">{atual.iniciais}</span>
            <div><small className="suave">{atual.rotulo}</small><h3>{atual.nome}</h3><p className="suave">{atual.area}</p><p>{atual.apresentacao}</p></div>
          </article>
          <div className="barra rodape-carrossel">
            <div className="linha-botoes">
              <button className="icone-btn" onClick={() => mover(-1)} aria-label="Pessoa anterior"><Icone nome="esq" /></button>
              <span className="suave" aria-live="polite">{String(i % itens.length + 1).padStart(2, '0')} / {String(itens.length).padStart(2, '0')}</span>
              <button className="icone-btn" onClick={() => mover(1)} aria-label="Próxima pessoa"><Icone nome="dir" /></button>
              <button className="btn btn-sec btn-pequeno" disabled={reduzido} aria-pressed={!girando} onClick={() => setAuto((a) => !a)}>
                <Icone nome={girando ? 'pausa' : 'tocar'} tamanho={14} />{reduzido ? 'Movimento reduzido' : girando ? 'Pausar' : 'Retomar'}
              </button>
            </div>
            <div className="pontos" aria-label={`Pessoa ${i % itens.length + 1} de ${itens.length}`}>
              {itens.map((d, n) => <button key={d.nome} aria-label={`Mostrar ${d.nome}`} aria-current={n === i % itens.length ? 'true' : undefined} onClick={() => setI(n)} />)}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
