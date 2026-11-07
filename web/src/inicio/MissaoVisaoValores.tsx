import { useEffect, useState } from 'react';
import { Icone } from '../icones';
import { useLista } from '../dados';

interface Inst { missao: string; visao: string; valores: string[] }
type Aba = 'missao' | 'visao' | 'valores';

/** Tamanho da janela, atualizado ao redimensionar. */
function useJanela() {
  const [t, setT] = useState(() => ({ w: innerWidth, h: innerHeight }));
  useEffect(() => { const f = () => setT({ w: innerWidth, h: innerHeight }); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  return t;
}

/** Missão, visão e valores da empresa (texto editável em Publicar › Missão, Visão e Valores). Some se nada estiver preenchido.
 *  Em janela pequena vira abas (um assunto por vez, sem cortar nada); em janela grande mostra tudo junto. */
export function MissaoVisaoValores() {
  const { dados } = useLista<Inst>('/api/institucional');
  const { w, h } = useJanela();
  const [aba, setAba] = useState<Aba>('missao');
  // O endpoint devolve um objeto; useLista aceita qualquer JSON.
  const d = dados as unknown as Inst | null;
  if (!d || (!d.missao && !d.visao && d.valores.length === 0)) return null;

  const abas = ([['missao', 'Missão', !!d.missao], ['visao', 'Visão', !!d.visao], ['valores', 'Valores', d.valores.length > 0]] as [Aba, string, boolean][]).filter(([, , tem]) => tem);
  const emAbas = w >= 1181 && (w < 1500 || h < 780);
  const atual = abas.find(([id]) => id === aba)?.[0] ?? abas[0][0];
  const mostra = (id: Aba) => !emAbas || atual === id;

  return (
    <section className={`cartao-sec mvv${emAbas ? ' em-abas' : ''}`} aria-labelledby="mvv-titulo">
      <div className="sec-topo">
        <h2 id="mvv-titulo"><Icone nome="estrela" tamanho={22} /> Missão, visão e valores</h2>
        {emAbas && abas.length > 1 && (
          <div className="abas" role="tablist" aria-label="Missão, visão e valores">
            {abas.map(([id, nome]) => <button key={id} role="tab" aria-selected={atual === id} onClick={() => setAba(id)}>{nome}</button>)}
          </div>
        )}
      </div>
      <div className="mvv-rolagem">
        <div className="mvv-corpo">
          {d.missao && mostra('missao') && <div className="mvv-bloco"><h3>Missão</h3><p>{d.missao}</p></div>}
          {d.visao && mostra('visao') && <div className="mvv-bloco"><h3>Visão</h3><p>{d.visao}</p></div>}
        </div>
        {d.valores.length > 0 && mostra('valores') && (
          <div className="mvv-valores">
            <h3>Valores</h3>
            <ul>{d.valores.map((v) => <li key={v}>{v}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
