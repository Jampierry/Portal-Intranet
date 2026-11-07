import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { Icone } from './icones';
import { LinkApp } from './aplicacoes/LinkApp';
import type { Tela } from './Menu';

interface Dados {
  comunicados: { slug: string; titulo: string; categoria: string }[];
  documentos: { slug: string; titulo: string; categoria: string }[];
  aplicativos: { slug: string; nome: string; categoria: string; url: string }[];
  contatos: { id: number; departamento: string; nome: string; canal: string }[];
}
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca do topo: resultados de comunicados, documentos, aplicativos e contatos, só do que a pessoa pode ver.
 *  Enter leva à primeira tela com resultado; o texto continua filtrando as listas das telas. */
export function BuscaGlobal({ valor, mudar, irPara, permissoes }: { valor: string; mudar: (v: string) => void; irPara: (t: Tela, slug?: string) => void; permissoes: string[] }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const pode = (c: string) => permissoes.includes(c);

  // Carrega só o que a pessoa pode ver, na primeira vez que usa a busca.
  const carregar = () => {
    if (dados) return;
    const ler = <T,>(permitido: boolean, url: string) => (permitido ? api<T[]>(url).catch(() => [] as T[]) : Promise.resolve([] as T[]));
    void Promise.all([
      ler<Dados['comunicados'][number]>(pode('ver.comunicados'), '/api/comunicados'),
      ler<Dados['documentos'][number]>(pode('ver.documentos'), '/api/documentos'),
      ler<Dados['aplicativos'][number]>(true, '/api/aplicacoes'),
      ler<Dados['contatos'][number]>(pode('ver.pessoas'), '/api/contatos'),
    ]).then(([comunicados, documentos, aplicativos, contatos]) => setDados({ comunicados, documentos, aplicativos, contatos }));
  };

  const termo = semAcento(valor.trim());
  const resultados = useMemo(() => {
    if (!dados || termo.length < 2) return null;
    const bate = (...t: string[]) => semAcento(t.join(' ')).includes(termo);
    return {
      comunicados: dados.comunicados.filter((c) => bate(c.titulo, c.categoria)),
      documentos: dados.documentos.filter((d) => bate(d.titulo, d.categoria)),
      aplicativos: dados.aplicativos.filter((a) => bate(a.nome, a.categoria)),
      contatos: dados.contatos.filter((c) => bate(c.nome, c.departamento)),
    };
  }, [dados, termo]);
  const total = resultados ? Object.values(resultados).reduce((n, l) => n + l.length, 0) : 0;

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const ir = (t: Tela, slug?: string) => { setAberto(false); irPara(t, slug); };
  const aoEnter = () => {
    if (!resultados) return;
    if (resultados.comunicados.length) ir('comunicados');
    else if (resultados.documentos.length) ir('documentos');
    else if (resultados.contatos.length) ir('pessoas');
  };

  return (
    <div className="busca-topo" ref={raiz}>
      <Icone nome="busca" tamanho={14} />
      <input type="search" placeholder="Buscar no portal" aria-label="Buscar no portal" aria-expanded={aberto && termo.length >= 2} aria-controls="busca-resultados" autoComplete="off" value={valor}
        onFocus={() => { carregar(); setAberto(true); }} onChange={(e) => { carregar(); setAberto(true); mudar(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false); if (e.key === 'Enter') aoEnter(); }} />
      {aberto && termo.length >= 2 && (
        <div className="busca-resultados" id="busca-resultados" role="region" aria-label="Resultados da busca" aria-live="polite">
          {!resultados && <p className="vazio">Buscando…</p>}
          {resultados && total === 0 && <p className="vazio">Nada encontrado para “{valor.trim()}”.</p>}
          {resultados && resultados.comunicados.length > 0 && <Grupo titulo="Comunicados">{resultados.comunicados.slice(0, 4).map((c) => <button key={c.slug} onClick={() => ir('comunicados', c.slug)}><b>{c.titulo}</b><small>{c.categoria}</small></button>)}</Grupo>}
          {resultados && resultados.documentos.length > 0 && <Grupo titulo="Documentos">{resultados.documentos.slice(0, 4).map((d) => <button key={d.slug} onClick={() => ir('documentos')}><b>{d.titulo}</b><small>{d.categoria}</small></button>)}</Grupo>}
          {resultados && resultados.aplicativos.length > 0 && <Grupo titulo="Aplicativos">{resultados.aplicativos.slice(0, 4).map((a) => <LinkApp key={a.slug} url={a.url} className="busca-item"><b>{a.nome}</b><small>{a.categoria}</small></LinkApp>)}</Grupo>}
          {resultados && resultados.contatos.length > 0 && <Grupo titulo="Contatos">{resultados.contatos.slice(0, 4).map((c) => <button key={c.id} onClick={() => ir('pessoas')}><b>{c.nome}</b><small>{c.departamento} · {c.canal}</small></button>)}</Grupo>}
        </div>
      )}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="busca-grupo"><span>{titulo}</span>{children}</div>;
}
