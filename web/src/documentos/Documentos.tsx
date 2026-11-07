import { useMemo, useState } from 'react';
import { Icone } from '../icones';
import { Cabecalho, Estado } from '../Cabecalho';
import { LinkApp } from '../aplicacoes/LinkApp';
import { dataCurta, useLista, type Documento } from '../dados';

export function Documentos({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const { dados, erro } = useLista<Documento>('/api/documentos');
  const [categoria, setCategoria] = useState('Todas');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((d) => d.categoria))], [dados]);
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? []).filter((d) =>
    (categoria === 'Todas' || d.categoria === categoria) && (!termo || [d.titulo, d.resumo, d.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo))));
  const limpar = () => { limparBusca(); setCategoria('Todas'); };
  return (
    <>
      <Cabecalho titulo="Documentos" sub="Procedimentos, políticas e materiais da equipe, sempre com versão e responsável." />
      <div className="barra">
        <div className="pilulas filtros" role="group" aria-label="Filtrar por categoria">
          {categorias.map((c) => <button key={c} aria-pressed={categoria === c} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={limpar} />
      <div className="grade-docs">
        {lista.map((d) => (
          <article className="cartao-doc" key={d.slug}>
            <span className="icone"><Icone nome="documentos" tamanho={22} /></span>
            <div className="texto"><h3>{d.titulo}</h3><p>{d.resumo}</p><small>{d.categoria} · {d.formato}{d.link_oficial ? '' : ' · sem link oficial'}</small>
              {(d.versao || d.responsavel) && <dl className="meta-doc">{d.versao && <div><dt>Versão</dt><dd>{d.versao}</dd></div>}{d.responsavel && <div><dt>Responsável</dt><dd>{d.responsavel}</dd></div>}{d.revisado_em && <div><dt>Revisado em</dt><dd>{dataCurta(d.revisado_em)}</dd></div>}</dl>}
              {d.link_oficial && <LinkApp url={d.link_oficial} className="btn btn-pri btn-pequeno abrir-doc">Abrir documento <Icone nome="externo" tamanho={13} /></LinkApp>}</div>
          </article>
        ))}
      </div>
    </>
  );
}
