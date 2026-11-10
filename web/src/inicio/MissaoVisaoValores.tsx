import { Icone } from '../icones';
import { useLista } from '../dados';

interface Inst { missao: string; visao: string; proposito: string; valores: string[] }

/** Missão, visão e valores da empresa (texto editável em Publicar › Missão, Visão e Valores). Some se nada estiver preenchido.
 *  Mostra tudo junto: se houver muitos valores, o bloco cresce e a página ganha altura (rolagem da página). */
export function MissaoVisaoValores() {
  const { dados } = useLista<Inst>('/api/institucional');
  // O endpoint devolve um objeto; useLista aceita qualquer JSON.
  const d = dados as unknown as Inst | null;
  if (!d || (!d.missao && !d.visao && !d.proposito && d.valores.length === 0)) return null;
  return (
    <section className="cartao-sec mvv" aria-labelledby="mvv-titulo">
      <div className="sec-topo"><h2 id="mvv-titulo"><Icone nome="estrela" tamanho={22} /> Diretrizes</h2></div>
      <div className="mvv-corpo">
        {d.missao && <div className="mvv-bloco"><h3>Missão</h3><p>{d.missao}</p></div>}
        {d.visao && <div className="mvv-bloco"><h3>Visão</h3><p>{d.visao}</p></div>}
        {d.proposito && <div className="mvv-bloco"><h3>Propósito</h3><p>{d.proposito}</p></div>}
      </div>
      {d.valores.length > 0 && (
        <div className="mvv-valores">
          <h3>Valores</h3>
          <ul>{d.valores.map((v) => <li key={v}>{v}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
