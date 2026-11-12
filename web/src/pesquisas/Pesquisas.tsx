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
  const [vista, setVista] = useState<'grade' | 'lista'>(() => { try { return localStorage.getItem('portal.pesquisas.vista') === 'lista' ? 'lista' : 'grade'; } catch { return 'grade'; } });
  const trocar = (v: 'grade' | 'lista') => { setVista(v); try { localStorage.setItem('portal.pesquisas.vista', v); } catch { /* vale só nesta sessão */ } };
  const carregar = () => api<ItemResultado[]>('/api/pulso/resultados').then(setLista).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  const abrir = (p: ItemResultado) => setAberto(p);
  const fechar = () => { if (aberto) { void marcarVisto(aberto.id).then(() => carregar()); } setAberto(null); };
  return (
    <section className="cartao-sec pesq-pagina" aria-labelledby="hist-pesq">
      <div className="sec-topo">
        <h2 id="hist-pesq"><Icone nome="pesquisas" tamanho={24} /> Resultados das pesquisas</h2>
        <div className="pilulas filtros vistas" role="group" aria-label="Formato de exibição dos resultados">
          <button aria-pressed={vista === 'grade'} onClick={() => trocar('grade')} title="Miniaturas (cartões)" aria-label="Miniaturas (cartões)"><Icone nome="vista-grade" tamanho={18} /></button>
          <button aria-pressed={vista === 'lista'} onClick={() => trocar('lista')} title="Lista" aria-label="Lista"><Icone nome="vista-lista" tamanho={18} /></button>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="vazio">Carregando…</p>}
      {lista && lista.length === 0 && <p className="vazio">Nenhum resultado divulgado ainda. Quando o RH divulgar o resultado de uma pesquisa, ele aparece aqui.</p>}
      <ul className={'pesq-hist' + (vista === 'lista' ? ' em-lista' : '')}>
        {(lista ?? []).map((p) => (
          <li key={p.id}>
            <button type="button" className="pesq-hist-item" onClick={() => abrir(p)}>
              <span className={'pesq-capa' + (p.imagens?.length ? '' : ' sem-img')} aria-hidden="true">
                {p.imagens?.length ? <img src={p.imagens[0]} alt="" loading="lazy" /> : <Icone nome="pesquisas" tamanho={28} />}
                {(p.imagens?.length ?? 0) > 1 && <span className="pesq-mais">+{p.imagens!.length - 1}</span>}
              </span>
              <span className="texto">
                <b>{p.titulo}</b>
                <small>{p.respostas} resposta{p.respostas === 1 ? '' : 's'}{p.rodada > 1 ? ` · rodada ${p.rodada}` : ''}</small>
                {p.liberado_em && <small>Divulgado em {dataCurta(p.liberado_em)}</small>}
              </span>
              {!p.visto && <span className="selo-novo">Novo</span>}
            </button>
          </li>
        ))}
      </ul>
      {aberto && <JanelaResultado item={aberto} aoFechar={fechar} />}
    </section>
  );
}
