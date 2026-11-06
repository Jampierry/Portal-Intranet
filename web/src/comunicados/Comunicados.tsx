import { useMemo, useState } from 'react';
import { Icone } from '../icones';
import { dataCurta, useLista, type Comunicado } from '../dados';

export function ListaComunicados({ itens }: { itens: Comunicado[] }) {
  return (
    <div className="lista-cards">
      {itens.map((c) => (
        <article className="modulo" key={c.slug}>
          <span className="icone"><Icone nome="comunicados" tamanho={22} /></span>
          <span className="texto">
            <b>{c.titulo}</b>
            <small>{c.resumo}</small>
            <small className="acesso">{c.categoria} · {dataCurta(c.publicado_em)}</small>
          </span>
          {c.prioridade === 'urgente' && <span className="chip">URGENTE</span>}
        </article>
      ))}
    </div>
  );
}

export function Comunicados() {
  const { dados, erro } = useLista<Comunicado>('/api/comunicados');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((c) => c.categoria))], [dados]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? []).filter((c) =>
    (categoria === 'Todas' || c.categoria === categoria) && (!termo || [c.titulo, c.resumo, c.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo))));
  const limpar = () => { setBusca(''); setCategoria('Todas'); };
  return (
    <>
      <p className="suave">Acompanhe os avisos da equipe. Conteúdo de demonstração: não representa comunicados oficiais.</p>
      <div className="barra">
        <input className="busca" type="search" placeholder="Buscar comunicado" aria-label="Buscar comunicado" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="pilulas filtros" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => <button key={c} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados === null && !erro && <p className="vazio">Carregando…</p>}
      {dados && lista.length === 0 && <p className="vazio">Nenhum comunicado encontrado. <button className="btn btn-sec btn-pequeno" onClick={limpar}>Limpar busca e filtros</button></p>}
      <ListaComunicados itens={lista} />
    </>
  );
}
