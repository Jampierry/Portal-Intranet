import { useMemo, useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Documento } from '../dados';

export function Documentos() {
  const { dados, erro } = useLista<Documento>('/api/documentos');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((d) => d.categoria))], [dados]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? []).filter((d) =>
    (categoria === 'Todas' || d.categoria === categoria) && (!termo || [d.titulo, d.resumo, d.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo))));
  const limpar = () => { setBusca(''); setCategoria('Todas'); };
  return (
    <>
      <p className="suave">Catálogo demonstrativo: títulos e dados fictícios. Nenhum arquivo está anexado e não há download nesta versão.</p>
      <div className="barra">
        <input className="busca" type="search" placeholder="Buscar documento" aria-label="Buscar documento" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="pilulas filtros" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => <button key={c} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados === null && !erro && <p className="vazio">Carregando…</p>}
      {dados && lista.length === 0 && <p className="vazio">Nenhum documento encontrado. <button className="btn btn-sec btn-pequeno" onClick={limpar}>Limpar busca e filtros</button></p>}
      <div className="lista-cards">
        {lista.map((d) => (
          <article className="modulo" key={d.slug}>
            <span className="icone"><Icone nome="documentos" tamanho={22} /></span>
            <span className="texto"><b>{d.titulo}</b><small>{d.resumo}</small><small className="acesso">{d.categoria} · {d.formato} · sem arquivo</small></span>
          </article>
        ))}
      </div>
    </>
  );
}
