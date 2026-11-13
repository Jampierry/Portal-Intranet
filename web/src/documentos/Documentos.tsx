import { avisar } from '../Confirmar.tsx';
import { useEffect, useMemo, useState } from 'react';
import { Icone } from '../icones';
import { iconePorTexto } from '../iconesAuto';
import { Cabecalho, Estado } from '../Cabecalho';
import { LinkApp } from '../aplicacoes/LinkApp';
import { dataCurta, useLista, type Documento } from '../dados';

/** Navegador não abre pasta de rede a partir de página web: o botão copia o caminho para colar no Explorer. */
function CopiarCaminho({ caminho }: { caminho: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { if (!copiado) return; const t = setTimeout(() => setCopiado(false), 2500); return () => clearTimeout(t); }, [copiado]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(caminho); } catch { void avisar({ titulo: 'Copie o caminho', mensagem: caminho }); }
    setCopiado(true);
  };
  return <button type="button" className="btn btn-pri btn-pequeno abrir-doc" onClick={copiar} title={caminho}>{copiado ? 'Caminho copiado!' : 'Copiar caminho de rede'}</button>;
}

export function Documentos({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const { dados, erro } = useLista<Documento>('/api/documentos');
  const [categoria, setCategoria] = useState('Todas');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((d) => d.categoria))], [dados]);
  const [q, setQ] = useState('');
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');
  const termos = [norm(busca), norm(q)].filter(Boolean);
  const lista = (dados ?? []).filter((d) =>
    (categoria === 'Todas' || d.categoria === categoria) && termos.every((t) => [d.titulo, d.resumo, d.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(t))));
  const limpar = () => { limparBusca(); setQ(''); setCategoria('Todas'); };
  return (
    <>
      <Cabecalho titulo="Documentos" sub="Procedimentos, políticas e materiais da equipe, sempre com versão e responsável." />
      <label className="busca-pagina">
        <Icone nome="busca" tamanho={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, assunto ou categoria" aria-label="Buscar documentos" />
      </label>
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
            <span className="icone"><Icone nome={iconePorTexto(`${d.categoria} ${d.titulo}`, 'documentos')} tamanho={22} /></span>
            <div className="texto"><h3>{d.titulo}</h3><p>{d.resumo}</p><small>{d.categoria} · {d.formato}{d.link_oficial ? '' : ' · sem link oficial'}</small>
              {(d.versao || d.responsavel) && <dl className="meta-doc">{d.versao && <div><dt>Versão</dt><dd>{d.versao}</dd></div>}{d.responsavel && <div><dt>Responsável</dt><dd>{d.responsavel}</dd></div>}{d.revisado_em && <div><dt>Revisado em</dt><dd>{dataCurta(d.revisado_em)}</dd></div>}</dl>}
              {d.link_oficial && (d.origem === 'rede'
                ? <CopiarCaminho caminho={d.link_oficial} />
                : (d.origem === 'pasta' || d.origem === 'servidor') && d.link_oficial.startsWith('/')
                ? <a href={d.link_oficial} target="_blank" rel="noopener noreferrer" className="btn btn-pri btn-pequeno abrir-doc">Abrir documento <Icone nome="externo" tamanho={13} /></a>
                : <LinkApp url={d.link_oficial} className="btn btn-pri btn-pequeno abrir-doc">Abrir documento <Icone nome="externo" tamanho={13} /></LinkApp>)}</div>
          </article>
        ))}
      </div>
    </>
  );
}
