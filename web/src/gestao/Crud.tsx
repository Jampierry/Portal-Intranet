import { CampoDocumento } from './CampoDocumento';
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { useLista } from '../dados';
import { useOrdenacao, valorOrdenavel } from './Ordenar';
import { CampoLink } from './CampoLink';
import { Dica, DicaAba } from '../Dica';

/** Permissões do usuário logado dentro de Publicar. Sem provedor (null) = tudo liberado; o servidor confere de qualquer forma. */
export const PermissoesCtx = createContext<string[] | null>(null);
export const usePermissoes = () => useContext(PermissoesCtx);
/** Área de permissão a partir do endereço de gestão (/api/gestao/aplicacoes -> aplicativos). */
const areaDe = (base: string) => { const a = base.split('/').pop() ?? ''; return a === 'aplicacoes' ? 'aplicativos' : a; };

export interface Campo {
  chave: string;
  rotulo: string;
  tipo?: 'texto' | 'area' | 'select' | 'data' | 'check' | 'imagem' | 'link' | 'documento';
  opcoes?: [string, string][];
  obrigatorio?: boolean;
  dica?: string;
  max?: number;
  sugestoes?: string[];
  /** Só para tipo 'imagem': busca a imagem sozinha a partir de outro campo (ex.: ícone do aplicativo a partir do endereço). */
  auto?: { endpoint: string; origem: string; rotulo: string };
  metade?: boolean;
}
export interface Coluna<T> { titulo: string; ver: (r: T) => ReactNode; /** Valor para ordenar ao clicar no cabeçalho (padrão: o próprio texto da coluna). */ ordem?: (r: T) => string | number | null }
type Valores = Record<string, string | boolean>;

/** Janela (dialog nativo) com formulário. Fecha com Esc ou clicando fora; erros aparecem dentro dela. */
export function JanelaForm({ titulo, aoFechar, aoEnviar, rotuloEnviar = 'Salvar', children }: {
  titulo: string; aoFechar: () => void; aoEnviar: () => Promise<void>; rotuloEnviar?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setErro(''); setEnviando(true);
    try { await aoEnviar(); } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  };
  return (
    <dialog className="janela janela-larga" ref={ref} onClose={aoFechar} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-label={titulo}>
      <form className="janela-form" onSubmit={enviar}>
        <header><h2>{titulo}</h2><button type="button" className="fechar" aria-label="Fechar" onClick={() => ref.current?.close()}>×</button></header>
        <div className="janela-corpo">{children}{erro && <p className="erro" role="alert">{erro}</p>}</div>
        <footer><button type="button" className="btn btn-sec" onClick={() => ref.current?.close()}>Cancelar</button><button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : rotuloEnviar}</button></footer>
      </form>
    </dialog>
  );
}

function CampoForm({ c, valor, mudar, mudarVarios, todos }: { c: Campo; valor: string | boolean; mudar: (v: string | boolean) => void; mudarVarios: (p: Valores) => void; todos: Valores }) {
  const id = `f-${c.chave}`;
  if (c.tipo === 'check') return <label className="linha" htmlFor={id}><input id={id} type="checkbox" checked={!!valor} onChange={(e) => mudar(e.target.checked)} />{c.rotulo}</label>;
  const comum = { id, value: String(valor ?? ''), required: c.obrigatorio, maxLength: c.max };
  if (c.tipo === 'link') return <CampoLink rotulo={c.rotulo} id={id} valor={String(valor ?? '')} mudar={mudar} dica={c.dica} obrigatorio={c.obrigatorio} metade={c.metade} />;
  if (c.tipo === 'documento') return <CampoDocumento rotulo={c.rotulo} todos={todos} mudarVarios={mudarVarios} />;
  if (c.tipo === 'imagem') return <CampoImagem c={c} id={id} valor={String(valor ?? '')} mudar={mudar} todos={todos} />;
  if (c.sugestoes) return <SeletorComNova c={c} id={id} valor={String(valor ?? '')} mudar={mudar} />;
  return (
    <label htmlFor={id} className={c.metade ? 'meia' : undefined}>{c.rotulo}{c.obrigatorio ? ' *' : ''}
      {c.tipo === 'area' ? <textarea rows={5} {...comum} onChange={(e) => mudar(e.target.value)} />
        : c.tipo === 'select' ? <select {...comum} onChange={(e) => mudar(e.target.value)}>{c.opcoes!.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        : <input type={c.tipo === 'data' ? 'date' : 'text'} {...comum} onChange={(e) => mudar(e.target.value)} />}
      {c.dica && <small className="suave">{c.dica}</small>}
    </label>
  );
}

/** Escolher a imagem de capa em qualquer pasta do computador ou da rede (seletor do navegador); o arquivo é enviado ao portal. */
const urlPlausivel = (v: string) => {
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname); } catch { return false; }
};

function CampoImagem({ c, id, valor, mudar, todos }: { c: Campo; id: string; valor: string; mudar: (v: string) => void; todos: Valores }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const tentadas = useRef(new Set<string>());
  const origem = c.auto ? String(todos[c.auto.origem] ?? '') : '';
  const buscar = async (silencioso: boolean) => {
    if (!c.auto) return;
    tentadas.current.add(origem); setErro(''); setEnviando(true);
    try { const r = await api<{ logo: string }>(c.auto.endpoint, { url: origem }); mudar(r.logo); }
    catch (x) { if (!silencioso) setErro((x as Error).message); } finally { setEnviando(false); }
  };
  // Ao informar o endereço do aplicativo, tenta trazer o ícone dele sozinho (uma vez por endereço, só se ainda não há imagem).
  useEffect(() => {
    if (!c.auto || valor || !urlPlausivel(origem) || tentadas.current.has(origem)) return;
    const t = setTimeout(() => void buscar(true), 1500);
    return () => clearTimeout(t);
  }, [origem, valor]); // eslint-disable-line react-hooks/exhaustive-deps
  const escolher = async (arq: File | undefined) => {
    if (!arq) return;
    setErro('');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) return setErro('Use uma imagem PNG, JPG, WebP ou GIF.');
    if (arq.size > 5 * 1024 * 1024) return setErro('A imagem passa de 5 MB. Escolha uma menor.');
    setEnviando(true);
    try {
      const r = await fetch('/api/gestao/imagens', { method: 'POST', headers: { 'Content-Type': arq.type }, body: arq, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
      if (!r.ok || !j.url) throw new Error(j.erro ?? `Erro ${r.status}`);
      mudar(j.url);
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  };
  return (
    <div className="campo-imagem">
      <span className="rotulo-campo" id={`${id}-rot`}>{c.rotulo}</span>
      <div className="campo-imagem-linha">
        {valor ? <img className="campo-imagem-previa" src={valor} alt="Prévia da imagem escolhida" /> : <span className="campo-imagem-vazia">Sem imagem</span>}
        <div className="campo-imagem-acoes">
          <label className="btn btn-sec btn-pequeno" htmlFor={id} style={{ margin: 0 }}>{enviando ? 'Enviando…' : valor ? 'Trocar imagem…' : 'Escolher imagem…'}</label>
          <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="so-leitor" aria-labelledby={`${id}-rot`} disabled={enviando}
            onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ''; }} />
          {c.auto && <button type="button" className="btn btn-sec btn-pequeno" disabled={enviando || !urlPlausivel(origem)} onClick={() => void buscar(false)}>{c.auto.rotulo}</button>}
          {valor && <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mudar('')}>Remover</button>}
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <small className="suave">{c.dica ?? 'PNG, JPG, WebP ou GIF, até 5 MB. Escolha no seu computador ou numa pasta da rede. Sem imagem = capa em cor do tema.'}</small>
    </div>
  );
}

const NOVA = '__nova__';
/** Seleção entre valores já usados, com opção de digitar um novo (visual igual ao dos outros selects). */
function SeletorComNova({ c, id, valor, mudar }: { c: Campo; id: string; valor: string; mudar: (v: string) => void }) {
  const lista = c.sugestoes!;
  const [nova, setNova] = useState(() => valor !== '' && !lista.includes(valor));
  const opcoes = valor && !lista.includes(valor) && !nova ? [...lista, valor] : lista;
  return (
    <div className={c.metade ? 'meia' : undefined}>
      <label htmlFor={id}>{c.rotulo}{c.obrigatorio ? ' *' : ''}
        <select id={id} required={c.obrigatorio} value={nova ? NOVA : valor}
          onChange={(e) => { if (e.target.value === NOVA) { setNova(true); mudar(''); } else { setNova(false); mudar(e.target.value); } }}>
          <option value="" disabled>Selecione…</option>
          {opcoes.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value={NOVA}>＋ Nova categoria…</option>
        </select>
      </label>
      {nova && <label htmlFor={`${id}-nova`}>Nome da nova categoria
        <input id={`${id}-nova`} type="text" autoFocus required={c.obrigatorio} maxLength={c.max} value={valor} onChange={(e) => mudar(e.target.value)} />
      </label>}
      {c.dica && <small className="suave">{c.dica}</small>}
    </div>
  );
}

/** Tela de cadastro genérica (lista + novo/editar/apagar) usada em comunicados, documentos, destaques e aplicações. */
export function Crud<T>({ base, rotuloItem, idDe, campos, colunas, valoresNovos, paraForm, podeApagar, acoesExtra, introducao }: {
  base: string; rotuloItem: string; idDe: (r: T) => string | number; campos: Campo[]; colunas: Coluna<T>[];
  valoresNovos: Valores; paraForm: (r: T) => Valores; podeApagar?: (r: T) => boolean;
  acoesExtra?: (r: T, salvar: (v: Valores) => Promise<void>) => ReactNode; introducao?: string;
}) {
  const { dados, erro, recarregar } = useLista<T>(base);
  const ord = useOrdenacao(dados, Object.fromEntries(colunas.map((c) => [c.titulo, (r: T) => (c.ordem ? c.ordem(r) : valorOrdenavel(c.ver(r)))])));
  const perms = usePermissoes();
  const area = areaDe(base);
  const libera = (acao: string) => perms === null || perms.includes(`pub.${area}.${acao}`);
  const [edit, setEdit] = useState<{ id: string | number | null; v: Valores } | null>(null);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');

  const salvar = async (id: string | number | null, v: Valores) => {
    const corpo: Record<string, unknown> = {};
    for (const c of campos) corpo[c.chave] = v[c.chave];
    if (id === null) await api(base, corpo); else await api(`${base}/${encodeURIComponent(String(id))}`, corpo, 'PUT');
    recarregar();
  };
  const apagar = async (r: T, nome: string) => {
    if (!window.confirm(`Apagar ${rotuloItem} "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setFalha('');
    try { await api(`${base}/${encodeURIComponent(String(idDe(r)))}`, undefined, 'DELETE'); setAviso(`${rotuloItem[0].toUpperCase()}${rotuloItem.slice(1)} apagado.`); recarregar(); }
    catch (x) { setFalha((x as Error).message); }
  };

  return (
    <section className="crud">
      {introducao && !libera('criar') && <DicaAba>{introducao}</DicaAba>}
      {libera('criar') && <div className="barra barra-fim">
        {introducao && <Dica lado="dir">{introducao}</Dica>}
        <button className="btn" onClick={() => setEdit({ id: null, v: valoresNovos })}><Icone nome="mais" tamanho={15} /> Novo {rotuloItem}</button>
      </div>}
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {(erro || falha) && <p className="erro" role="alert">{erro || falha}</p>}
      {dados === null && !erro && <p className="vazio">Carregando…</p>}
      {dados && (
        <div className="rolagem">
          <table className="dados">
            <thead><tr>{colunas.map((c) => ord.cab(c.titulo, c.titulo))}<th className="col-acoes">Ações</th></tr></thead>
            <tbody>
              {dados.length === 0 && <tr><td colSpan={colunas.length + 1} className="vazio">Nada cadastrado ainda.</td></tr>}
              {(ord.linhas ?? []).map((r) => {
                const nome = String(colunas[0].ver(r));
                return (
                  <tr key={idDe(r)}>
                    {colunas.map((c) => <td key={c.titulo} data-rotulo={c.titulo}>{c.ver(r)}</td>)}
                    <td className="col-acoes">
                      {acoesExtra?.(r, (v) => salvar(idDe(r), v).then(() => setAviso('Alteração salva.')))}
                      {libera('editar') && <button className="btn btn-sec btn-pequeno" onClick={() => setEdit({ id: idDe(r), v: paraForm(r) })} aria-label={`Editar ${nome}`}><Icone nome="editar" tamanho={13} /> Editar</button>}
                      {libera('excluir') && (podeApagar?.(r) ?? true) && <button className="btn btn-vermelho btn-pequeno" onClick={() => void apagar(r, nome)} aria-label={`Apagar ${nome}`}><Icone nome="lixo" tamanho={13} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <JanelaForm titulo={edit.id === null ? `Novo ${rotuloItem}` : `Editar ${rotuloItem}`} aoFechar={() => setEdit(null)}
          aoEnviar={async () => { await salvar(edit.id, edit.v); setAviso(`${rotuloItem[0].toUpperCase()}${rotuloItem.slice(1)} salvo.`); setEdit(null); }}>
          <div className="grade2">
            {campos.map((c) => (
              <div key={c.chave} className={c.metade ? undefined : 'cheia'}>
                <CampoForm c={c} todos={edit.v} valor={edit.v[c.chave] ?? ''} mudar={(valor) => setEdit((e) => e && { ...e, v: { ...e.v, [c.chave]: valor } })} mudarVarios={(p) => setEdit((e) => e && { ...e, v: { ...e.v, ...p } })} />
              </div>
            ))}
          </div>
        </JanelaForm>
      )}
    </section>
  );
}

/** Etiqueta de situação (rascunho, publicado…). */
export function Selo({ texto, tom }: { texto: string; tom: 'ok' | 'aviso' | 'neutro' | 'erro' }) {
  return <span className={`selo-st st-${tom}`}>{texto}</span>;
}
