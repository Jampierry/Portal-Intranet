import { useEffect, useRef, useState } from 'react';
import { Icone } from '../icones';
import { periodoDe, useLista, type Destaque } from '../dados';
import { Capa } from '../Capa';

const ROTULOS = { mes: 'Destaque do mês', ano: 'Destaque do ano' } as const;
const ROTULOS_CURTOS = { mes: 'Mês', ano: 'Ano' } as const;
const POR_VEZ = 3;

/** Carrossel do colaborador destaque (mês/ano). Compacto = uma pessoa por vez. Rotação lenta, pausável e desligada com movimento reduzido. Sem ranking. */
export function Destaques({ compacto = false }: { compacto?: boolean }) {
  const porVez = POR_VEZ;
  const { dados } = useLista<Destaque>('/api/destaques');
  const [tipo, setTipo] = useState<'mes' | 'ano'>('mes');
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  // Aba Mês: quem foi destaque no mês vigente. Aba Ano: todos os destaques do ano atual (de qualquer mês).
  const hoje = new Date(), mesAtual = hoje.getMonth() + 1, anoAtual = hoje.getFullYear();
  const itens = (dados ?? []).filter((d) => d.ano === anoAtual && (tipo === 'ano' || d.mes === mesAtual));
  const paginas = Math.max(1, Math.ceil(itens.length / porVez));
  const pag = i % paginas;
  const girando = auto; // gira sozinho mesmo com "reduzir animações" no Windows (o usuário pode pausar no botão)
  const abas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!girando || paginas < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % paginas), 7200);
    return () => clearInterval(t);
  }, [girando, paginas]);

  const mover = (d: -1 | 1) => setI((x) => (x + d + paginas) % paginas);
  const grupos = Array.from({ length: paginas }, (_, p) => itens.slice(p * porVez, p * porVez + porVez));

  return (
    <section className={`cartao-sec destaques${compacto ? ' compacto' : ''}`} aria-labelledby="dest-titulo">
      <div className="sec-topo">
        <h2 id="dest-titulo"><Icone nome="pessoas" tamanho={compacto ? 22 : 24} /> Colaborador Destaque</h2>
        <div className="abas" role="tablist" aria-label="Período dos destaques" ref={abas}>
          {(['mes', 'ano'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tipo === t} onClick={() => { setTipo(t); setI(0); }}>{compacto ? ROTULOS_CURTOS[t] : ROTULOS[t]}</button>
          ))}
        </div>
        <button className="btn-pausa" aria-pressed={!girando} title={girando ? 'Pausar animação' : 'Retomar animação'} aria-label={girando ? 'Pausar animação' : 'Retomar animação'} onClick={() => setAuto((a) => !a)}>
          <span className="icone-btn"><Icone nome={girando ? 'pausa' : 'tocar'} tamanho={14} /></span>{!compacto && (girando ? 'Pausar animação' : 'Retomar animação')}
        </button>
      </div>
      {itens.length === 0 ? <p className="vazio">{tipo === 'mes' ? 'Sem destaque publicado neste mês.' : 'Sem destaques publicados neste ano.'}</p> : (
        <>
          <div className="carrossel" aria-live={girando ? 'off' : 'polite'}>
            <button className="seta-car" onClick={() => mover(-1)} aria-label="Colaborador anterior"><Icone nome="esq" /></button>
            <div className="pessoas-janela">
              <div className="pessoas-trilho" style={{ transform: `translateX(-${pag * 100}%)` }}>
                {grupos.map((g, p) => (
                  <div className="pessoas" key={p} aria-hidden={p !== pag}>
                    {g.map((d) => (
                      <article className="pessoa" key={`${d.nome}|${d.ano}|${d.mes}`}>
                        <div className="pessoa-foto">
                          <Capa semente={d.nome} icone="pessoas" foto={d.foto} classe="capa-pessoa">{!d.foto && <span className="iniciais-capa">{d.iniciais}</span>}</Capa>
                          {tipo === 'ano' && <span className="pessoa-periodo" title={`Colaborador destaque de ${periodoDe(d)}`}>{periodoDe(d)}</span>}
                        </div>
                        <div><h3 title={d.nome}>{d.nome}</h3><small className="area">{d.area}</small><p>{d.apresentacao}</p></div>
                      </article>
                    ))}
                  </div>
                ))}
              </div>
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
