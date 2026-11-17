import { Icone } from '../icones';
import { useLista } from '../dados';

interface Inst { missao: string; visao: string; proposito: string; valores: string[] }

/** Marca-d'água do bloco: alvo com flecha, só em traço, na cor de destaque do tema. */
function AlvoMarcaDagua() {
  return (
    <svg className="mvv-marca" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="92" cy="112" r="80" /><circle cx="92" cy="112" r="56" /><circle cx="92" cy="112" r="32" /><circle cx="92" cy="112" r="9" className="cheio" />
      <path d="M92 112 L170 34 M152 30 L172 28 L170 48 M140 42 L158 60" />
    </svg>
  );
}

/** Missão, visão e valores da empresa (texto editável em Publicar › Missão, Visão e Valores). Some se nada estiver preenchido.
 *  Cartão de vidro (fundo translúcido nas cores do tema) com ícones redondos; mostra tudo junto e cresce se houver muitos valores. */
export function MissaoVisaoValores() {
  const { dados } = useLista<Inst>('/api/institucional');
  // O endpoint devolve um objeto; useLista aceita qualquer JSON.
  const d = dados as unknown as Inst | null;
  if (!d || (!d.missao && !d.visao && !d.proposito && d.valores.length === 0)) return null;
  const blocos = [
    { chave: 'missao', titulo: 'Missão', icone: 'metas', texto: d.missao },
    { chave: 'visao', titulo: 'Visão', icone: 'olho', texto: d.visao },
    { chave: 'proposito', titulo: 'Propósito', icone: 'estrela', texto: d.proposito },
  ].filter((b) => b.texto);
  return (
    <section className="cartao-sec mvv mvv-vidro" aria-labelledby="mvv-titulo">
      <AlvoMarcaDagua />
      <div className="sec-topo"><h2 id="mvv-titulo"><Icone nome="estrela" tamanho={22} /> Diretrizes</h2></div>
      <div className="mvv-corpo">
        {blocos.map((b) => (
          <div key={b.chave} className={`mvv-bloco mvv-${b.chave}`}>
            <h3><span className="mvv-bola"><Icone nome={b.icone} tamanho={16} /></span>{b.titulo}</h3>
            <p>{b.texto}</p>
          </div>
        ))}
      </div>
      {d.valores.length > 0 && (
        <div className="mvv-valores">
          <h3><span className="mvv-bola"><Icone nome="pessoas" tamanho={16} /></span>Valores</h3>
          <ul>{d.valores.map((v) => <li key={v}>{v}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
