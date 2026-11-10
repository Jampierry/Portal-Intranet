import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { iconePorTexto } from '../iconesAuto';
import { Capa, Lema } from '../Capa';
import { Cabecalho, Estado } from '../Cabecalho';
import { useEmpresa } from '../empresa';
import { dataCurta, useLista, type Comunicado } from '../dados';

const iconeDe = (c: { categoria: string; titulo: string }) => iconePorTexto(`${c.categoria} ${c.titulo}`, 'comunicados');

/** Cartão de comunicado: capa, categoria, título, resumo, data e seta. */
export function CartaoComunicado({ c }: { c: Comunicado }) {
  return (
    <article className="cartao-com">
      <Capa semente={c.slug} icone={iconeDe(c)} foto={c.imagem} classe="capa-card">{c.prioridade === 'urgente' && <span className="selo">URGENTE</span>}</Capa>
      <div className="cartao-com-corpo">
        <small className="cat">{c.categoria}</small>
        <h3><a className="cobre-cartao" href={`#comunicados/${encodeURIComponent(c.slug)}`}>{c.titulo}</a></h3>
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

type ComDetalhe = Comunicado & { corpo: string | null; lido_em?: string | null };
/** Caixa "Li e estou ciente" (só em comunicado que exige confirmação de leitura). */
function ConfirmarLeitura({ c, aoConfirmar }: { c: ComDetalhe; aoConfirmar: (quando: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  if (!c.exige_leitura) return null;
  if (c.lido) return <p className="leitura-ok" role="status"><Icone nome="info" tamanho={16} /> Leitura confirmada{c.lido_em ? ` em ${dataCurta(c.lido_em.slice(0, 10))}` : ''}.</p>;
  const confirmar = async () => { setErro(''); setOcupado(true); try { const r = await api<{ lido_em: string }>(`/api/comunicados/${encodeURIComponent(c.slug)}/confirmar`, {}); aoConfirmar(r.lido_em); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); } };
  return (
    <div className="leitura-pede" role="group" aria-label="Confirmação de leitura">
      <p><b>Este comunicado pede a confirmação da sua leitura.</b> Leia o texto acima e confirme que está ciente.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="btn" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? 'Confirmando…' : 'Li e estou ciente'}</button>
    </div>
  );
}

/** Detalhe de um comunicado publicado: categoria, data, corpo em parágrafos e outros da mesma categoria. */
function ComunicadoDetalhe({ slug }: { slug: string }) {
  const [c, setC] = useState<ComDetalhe | null | 'erro'>(null);
  const { dados } = useLista<Comunicado>('/api/comunicados');
  useEffect(() => { setC(null); api<ComDetalhe>(`/api/comunicados/${encodeURIComponent(slug)}`).then(setC).catch(() => setC('erro')); }, [slug]);
  const voltar = <a className="link-ver voltar" href="#comunicados"><Icone nome="esq" tamanho={15} /> Voltar aos comunicados</a>;
  if (c === 'erro') return <><Cabecalho interno titulo="Comunicado não encontrado" sub="Ele pode ter sido arquivado ou o endereço está incorreto." />{voltar}</>;
  if (c === null) return <p className="vazio">Carregando…</p>;
  const paragrafos = (c.corpo ?? c.resumo).split(/\n{2,}/).filter(Boolean);
  const outros = (dados ?? []).filter((x) => x.categoria === c.categoria && x.slug !== c.slug).slice(0, 3);
  return (
    <>
      {voltar}
      <article className="detalhe-com">
        <Capa semente={c.slug} icone={iconeDe(c)} foto={c.imagem} classe="capa-detalhe">{c.prioridade === 'urgente' && <span className="selo">URGENTE</span>}</Capa>
        <div className="detalhe-corpo">
          <small className="cat">{c.categoria}</small>
          <h1>{c.titulo}</h1>
          <p className="suave detalhe-data"><Icone nome="calendario" tamanho={15} /> Publicado em {dataCurta(c.publicado_em)}</p>
          {paragrafos.map((p, i) => <p key={i} className={i === 0 ? 'detalhe-lead' : undefined}>{p}</p>)}
          <ConfirmarLeitura c={c} aoConfirmar={(quando) => setC({ ...c, lido: 1, lido_em: quando })} />
        </div>
      </article>
      {outros.length > 0 && <section aria-labelledby="outros-com"><div className="barra"><h2 id="outros-com">Mais em {c.categoria}</h2></div><ListaComunicados itens={outros} /></section>}
    </>
  );
}

export function Comunicados({ slug, busca, limparBusca }: { slug?: string; busca: string; limparBusca: () => void }) {
  if (slug) return <ComunicadoDetalhe slug={slug} />;
  return <ListaDeComunicados busca={busca} limparBusca={limparBusca} />;
}

function ListaDeComunicados({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const empresa = useEmpresa();
  const { dados, erro } = useLista<Comunicado>('/api/comunicados');
  const [categoria, setCategoria] = useState('Todas');
  const [ordem, setOrdem] = useState<Ordem>('recentes');
  const categorias = useMemo(() => ['Todas', ...new Set((dados ?? []).map((c) => c.categoria))], [dados]);
  const [q, setQ] = useState('');
  const [temasAberto, setTemasAberto] = useState(false);
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');
  const termos = [norm(busca), norm(q)].filter(Boolean);
  const lista = (dados ?? [])
    .filter((c) => (categoria === 'Todas' || c.categoria === categoria) && termos.every((t) => [c.titulo, c.resumo, c.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(t))))
    .sort((a, b) => (a.publicado_em ?? '').localeCompare(b.publicado_em ?? '') * (ordem === 'recentes' ? -1 : 1));
  const filtrando = termos.length > 0 || categoria !== 'Todas';
  // Destaque: o primeiro urgente (ou o mais recente) quando não há filtro.
  const destaque = !filtrando ? lista.find((c) => c.prioridade === 'urgente') ?? lista[0] : undefined;
  const resto = destaque ? lista.filter((c) => c !== destaque) : lista;
  const limpar = () => { limparBusca(); setQ(''); setCategoria('Todas'); };

  return (
    <>
      <div className="com-topo">
        <div className="com-ferramentas">
          <label className="busca-pagina">
            <Icone nome="busca" tamanho={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comunicados" aria-label="Buscar comunicados" />
          </label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por área">
            {categorias.map((c) => <option key={c} value={c}>{c === 'Todas' ? 'Todas as áreas' : c}</option>)}
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar comunicados">
            <option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option>
          </select>
        </div>
      </div>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={limpar} />
      <div className="com-layout">
        <div className="com-principal">
          {destaque && (
            <section className="destaque-com" aria-label="Comunicado em destaque">
              <div className="destaque-com-texto">
                {empresa.rotulo_destaque && <span className="etiqueta">{empresa.rotulo_destaque}</span>}
                <h2>{destaque.titulo}</h2>
                <p>{destaque.resumo}</p>
                <a className="btn btn-pri" href={`#comunicados/${encodeURIComponent(destaque.slug)}`}>Saiba mais <Icone nome="seta" tamanho={16} /></a>
              </div>
              <Capa semente={destaque.slug} icone={iconeDe(destaque)} foto={destaque.imagem} classe="capa-grande">{empresa.lema_destaque.length > 0 && <Lema linhas={empresa.lema_destaque} classe="lema-capa" />}</Capa>
            </section>
          )}
          <div className="temas-flutuante">
            <button type="button" className="temas-botao" aria-expanded={temasAberto} aria-haspopup="true" onClick={() => setTemasAberto((a) => !a)}>
              <Icone nome={categoria === 'Todas' ? 'comunicados' : iconePorTexto(categoria, 'comunicados')} tamanho={16} /> Temas{categoria !== 'Todas' ? `: ${categoria}` : ''} <Icone nome="chev" tamanho={14} classe={temasAberto ? 'gira' : ''} />
            </button>
            {temasAberto && (
              <>
                <button type="button" className="temas-fundo" aria-label="Fechar temas" onClick={() => setTemasAberto(false)} />
                <ul className="temas temas-menu" role="menu">
                  {categorias.map((c) => (
                    <li key={c} role="none"><button role="menuitem" aria-pressed={categoria === c} onClick={() => { setCategoria(c); setTemasAberto(false); }}><Icone nome={c === 'Todas' ? 'comunicados' : iconePorTexto(c, 'comunicados')} tamanho={20} /><span>{c}</span></button></li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {resto.length > 0 && (
            <section className="com-mais" aria-labelledby="mais-com">
              <div className="barra"><h2 id="mais-com">{destaque ? 'Outros comunicados' : `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}`}</h2><span className="suave" aria-live="polite">{filtrando ? `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}` : ''}</span></div>
              <div className="com-rolagem"><ListaComunicados itens={resto} /></div>
            </section>
          )}
        </div>
        <aside className="com-lateral" aria-label="Temas">
          <section className="painel-marca" aria-hidden="true">{empresa.lema.length > 0 && <Lema linhas={empresa.lema} />}<b>{empresa.nome}</b>{empresa.slogan && <small>{empresa.slogan}</small>}</section>
          <section className="painel-lateral">
            <h2>Temas</h2>
            <ul className="temas">
              {categorias.map((c) => (
                <li key={c}><button aria-pressed={categoria === c} onClick={() => setCategoria(c)}><Icone nome={c === 'Todas' ? 'comunicados' : iconePorTexto(c, 'comunicados')} tamanho={22} /><span>{c}</span><Icone nome="dir" tamanho={16} /></button></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
