import { useMemo, useState } from 'react';
import { Icone } from '../icones';
import { Capa, Lema } from '../Capa';
import { Cabecalho, Estado } from '../Cabecalho';
import { dataCurta, useLista, type Comunicado } from '../dados';

const ICONE_CAT: Record<string, string> = { Pessoas: 'pessoas', Produção: 'fabrica', Qualidade: 'qualidade', Coleções: 'colecoes' };
const iconeDe = (c: string) => ICONE_CAT[c] ?? 'comunicados';

/** Cartão de comunicado: capa, categoria, título, resumo, data e seta. */
export function CartaoComunicado({ c }: { c: Comunicado }) {
  return (
    <article className="cartao-com">
      <Capa semente={c.slug} icone={iconeDe(c.categoria)} classe="capa-card">{c.prioridade === 'urgente' && <span className="selo">URGENTE</span>}</Capa>
      <div className="cartao-com-corpo">
        <small className="cat">{c.categoria}</small>
        <h3>{c.titulo}</h3>
        <p>{c.resumo}</p>
        <footer><span><Icone nome="calendario" tamanho={15} /> {dataCurta(c.publicado_em)}</span><Icone nome="seta" tamanho={16} /></footer>
      </div>
    </article>
  );
}

export function ListaComunicados({ itens, linha = false }: { itens: Comunicado[]; linha?: boolean }) {
  return <div className={`grade-com${linha ? ' linha' : ''}`}>{itens.map((c) => <CartaoComunicado key={c.slug} c={c} />)}</div>;
}

type Ordem = 'recentes' | 'antigos';

export function Comunicados({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const { dados, erro } = useLista<Comunicado>('/api/comunicados');
  const [categoria, setCategoria] = useState('Todas');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((c) => c.categoria))], [dados]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? [])
    .filter((c) => (categoria === 'Todas' || c.categoria === categoria) && (!termo || [c.titulo, c.resumo, c.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo))))
    .sort((a, b) => (a.publicado_em ?? '').localeCompare(b.publicado_em ?? '') * (ordem === 'recentes' ? -1 : 1));
  const filtrando = termo !== '' || categoria !== 'Todas';
  // Destaque: o primeiro urgente (ou o mais recente) quando não há filtro.
  const destaque = !filtrando ? lista.find((c) => c.prioridade === 'urgente') ?? lista[0] : undefined;
  const resto = destaque ? lista.filter((c) => c !== destaque) : lista;
  const limpar = () => { limparBusca(); setCategoria('Todas'); };

  return (
    <>
      <Cabecalho titulo="Comunicados" sub="Fique por dentro do que acontece na Di Paula.">
        <label className="linha ordem">Ordenar
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar comunicados">
            <option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option>
          </select>
        </label>
      </Cabecalho>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={limpar} />
      <div className="com-layout">
        <div className="com-principal">
          {destaque && (
            <section className="destaque-com" aria-label="Comunicado em destaque">
              <div className="destaque-com-texto">
                <span className="etiqueta">DESTAQUE</span>
                <h2>{destaque.titulo}</h2>
                <p>{destaque.resumo}</p>
                <button className="btn btn-pri">Saiba mais <Icone nome="seta" tamanho={16} /></button>
              </div>
              <Capa semente={destaque.slug} icone={iconeDe(destaque.categoria)} classe="capa-grande"><Lema linhas={['PESSOAS', 'MOVIMENTO', 'RESULTADOS', 'SEMPRE']} classe="lema-capa" /></Capa>
            </section>
          )}
          {resto.length > 0 && (
            <section aria-labelledby="mais-com">
              <div className="barra"><h2 id="mais-com">{destaque ? 'Mais comunicados' : `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}`}</h2><span className="suave" aria-live="polite">{filtrando ? `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}` : ''}</span></div>
              <ListaComunicados itens={resto} />
            </section>
          )}
        </div>
        <aside className="com-lateral" aria-label="Temas">
          <section className="painel-lateral">
            <h2>Temas</h2>
            <ul className="temas">
              {categorias.map((c) => (
                <li key={c}><button aria-pressed={categoria === c} onClick={() => setCategoria(c)}><Icone nome={c === 'Todas' ? 'comunicados' : iconeDe(c)} tamanho={22} /><span>{c}</span><Icone nome="dir" tamanho={16} /></button></li>
              ))}
            </ul>
          </section>
          <section className="painel-marca" aria-hidden="true"><Lema linhas={['SONHAR', 'FAZ PARTE', 'DO NOSSO', 'MOVIMENTO']} /><b>Di Paula</b><small>MODA EM MOVIMENTO</small></section>
        </aside>
      </div>
    </>
  );
}
