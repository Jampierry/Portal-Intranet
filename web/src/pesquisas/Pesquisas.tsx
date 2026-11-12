import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { dataCurta } from '../dados';
import { JanelaResultado, marcarVisto, type ItemResultado } from './JanelaResultado';

/** Menu › Pesquisas: histórico dos resultados que o RH divulgou. É o único lugar para rever um resultado depois que o pop-up foi fechado. */
export function Pesquisas() {
  const [lista, setLista] = useState<ItemResultado[] | null>(null);
  const [aberto, setAberto] = useState<ItemResultado | null>(null);
  const [erro, setErro] = useState('');
  const carregar = () => api<ItemResultado[]>('/api/pulso/resultados').then(setLista).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  const abrir = (p: ItemResultado) => setAberto(p);
  const fechar = () => { if (aberto) { void marcarVisto(aberto.id).then(() => carregar()); } setAberto(null); };
  return (
    <section className="cartao-sec" aria-labelledby="hist-pesq">
      <div className="sec-topo"><h2 id="hist-pesq"><Icone nome="pesquisas" tamanho={24} /> Resultados das pesquisas</h2></div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="vazio">Carregando…</p>}
      {lista && lista.length === 0 && <p className="vazio">Nenhum resultado divulgado ainda. Quando o RH divulgar o resultado de uma pesquisa, ele aparece aqui.</p>}
      <ul className="pesq-hist">
        {(lista ?? []).map((p) => (
          <li key={p.id}>
            <button type="button" className="pesq-hist-item" onClick={() => abrir(p)}>
              <span className="mini-ico"><Icone nome="pesquisas" tamanho={20} /></span>
              <span className="texto">
                <b>{p.titulo}{!p.visto && <span className="selo-novo">Novo</span>}</b>
                <small>{p.respostas} resposta{p.respostas === 1 ? '' : 's'}{p.rodada > 1 ? ` · rodada ${p.rodada}` : ''}{p.liberado_em ? ` · divulgado em ${dataCurta(p.liberado_em)}` : ''}</small>
              </span>
              <Icone nome="dir" tamanho={16} />
            </button>
          </li>
        ))}
      </ul>
      {aberto && <JanelaResultado item={aberto} aoFechar={fechar} />}
    </section>
  );
}
