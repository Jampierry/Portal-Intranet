import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { JanelaForm, Selo } from './Crud';
import { useOrdenacao } from './Ordenar';

export interface AcaoPerm { chave: string; rotulo: string }
export interface AreaPerm { id: string; rotulo: string; acoes: AcaoPerm[] }
export interface GrupoPerm { grupo: string; areas: AreaPerm[] }
export interface PerfilPerm { codigo: string; nome: string; sistema: boolean; fixo: boolean; permissoes: string[]; usuarios: number }
export interface Catalogo { catalogo: GrupoPerm[]; perfis: PerfilPerm[] }
export type Ajustes = Record<string, boolean>;

/** Catálogo de permissões e o que cada perfil tem hoje. */
export function useCatalogo() {
  const [dados, setDados] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  useEffect(() => { api<Catalogo>('/api/perfis').then((d) => { setDados(d); setErro(''); }).catch((e: Error) => setErro(e.message)); }, [versao]);
  return { dados, erro, recarregar: () => setVersao((v) => v + 1) };
}

const todasAsChaves = (cat: GrupoPerm[]) => cat.flatMap((g) => g.areas.flatMap((a) => a.acoes.map((x) => x.chave)));

/** Marca/desmarca uma ação. A primeira ação da área ("ver"/"acessar") é o portão: desmarcá-la desmarca as outras;
 *  marcar qualquer outra marca também a primeira. */
function alternarAcao(marcadas: Set<string>, area: AreaPerm, chave: string): Set<string> {
  const s = new Set(marcadas);
  const portao = area.acoes[0].chave;
  if (s.has(chave)) {
    s.delete(chave);
    if (chave === portao) area.acoes.forEach((a) => s.delete(a.chave));
  } else { s.add(chave); s.add(portao); }
  return s;
}

/** Caixas de seleção por tela/aba: cada linha é uma tela (ou aba) e suas ações. */
function GradePermissoes({ catalogo, marcadas, mudar, travada, marca }: {
  catalogo: GrupoPerm[]; marcadas: Set<string>; mudar: (s: Set<string>) => void; travada?: boolean; marca?: (chave: string) => string | null;
}) {
  const todaArea = (a: AreaPerm, ligar: boolean) => { const s = new Set(marcadas); a.acoes.forEach((x) => (ligar ? s.add(x.chave) : s.delete(x.chave))); mudar(s); };
  return (
    <div className="perm-usuario grade-perfil">
      {catalogo.map((g) => (
        <div key={g.grupo} className="perm-grupo">
          <b>{g.grupo}</b>
          {g.areas.map((a) => (
            <div key={a.id} className="perm-area">
              <span className="perm-area-nome">{a.rotulo}
                {!travada && <span className="perm-atalhos"><button type="button" onClick={() => todaArea(a, true)}>tudo</button><button type="button" onClick={() => todaArea(a, false)}>nada</button></span>}
              </span>
              <div className="perm-acoes">
                {a.acoes.map((x, i) => {
                  const nota = marca?.(x.chave);
                  return (
                    <label key={x.chave} className={`perm-check${i === 0 ? ' portao' : ''}`} title={nota ?? undefined}>
                      <input type="checkbox" checked={travada || marcadas.has(x.chave)} disabled={travada} onChange={() => mudar(alternarAcao(marcadas, a, x.chave))} />
                      <span>{x.rotulo}</span>
                      {nota && <small className="perm-ajuste" aria-label={nota}>{nota.startsWith('liberado') ? '+ só ela' : '− só ela'}</small>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Aplicativos restritos que o perfil libera (quem tem o perfil vê; cada pessoa ainda pode receber extras em Usuários). */
function AppsDoPerfil({ codigo, marcados, mudar, travada }: { codigo: string | null; marcados: string[]; mudar: (m: string[]) => void; travada: boolean }) {
  const [restritas, setRestritas] = useState<{ slug: string; nome: string; categoria: string; ativo: number }[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api<{ slug: string; nome: string; categoria: string; ativo: number }[]>('/api/aplicativos-restritos').then(setRestritas).catch((e) => setErro((e as Error).message));
    if (codigo) api<{ liberados: string[] }>(`/api/perfis/${codigo}/aplicativos`).then((r) => mudar(r.liberados)).catch((e) => setErro((e as Error).message));
  }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps
  const alternar = (slug: string) => mudar(marcados.includes(slug) ? marcados.filter((x) => x !== slug) : [...marcados, slug]);
  return (
    <fieldset className="perm-usuario-caixa">
      <legend>Aplicativos restritos deste perfil</legend>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!restritas && !erro && <p className="suave">Carregando…</p>}
      {travada && <p className="suave" style={{ margin: 0 }}>O Administrador vê todos os aplicativos, sempre.</p>}
      {restritas && !travada && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>Os aplicativos <b>comuns</b> aparecem para todos. Marque os <b>restritos</b> que quem tem este perfil vê. Para dar um aplicativo a uma pessoa só, use <b>Usuários › Aplicativos</b>.</p>
          {restritas.length === 0 ? <p className="vazio">Nenhum aplicativo restrito ainda. Para restringir um: Publicar › Aplicativos › Editar › marque “Restrita”.</p> : (
            <div className="lista-marcar" role="group" aria-label="Aplicativos restritos do perfil">
              {restritas.map((a) => <label key={a.slug} className="linha"><input type="checkbox" checked={marcados.includes(a.slug)} onChange={() => alternar(a.slug)} />{a.nome} <small className="suave">{a.categoria}{a.ativo ? '' : ' · inativo'}</small></label>)}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

const resumo = (catalogo: GrupoPerm[], p: PerfilPerm) => catalogo.map((g) => {
  const chaves = g.areas.flatMap((a) => a.acoes.map((x) => x.chave));
  return `${g.grupo}: ${chaves.filter((c) => p.permissoes.includes(c)).length} de ${chaves.length}`;
}).join(' · ');

/** Aba Perfis: lista de perfis (do sistema e personalizados); criar, escolher o que cada um acessa e faz, e apagar. */
export function ListaPerfis({ souAdmin, permissoes }: { souAdmin: boolean; permissoes: string[] }) {
  const { dados, erro, recarregar } = useCatalogo();
  const ord = useOrdenacao(dados?.perfis ?? null, { perfil: (p) => p.nome, codigo: (p) => p.codigo, usuarios: (p) => p.usuarios, tipo: (p) => (p.sistema ? 'Padrão do sistema' : 'Personalizado') });
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  const [form, setForm] = useState<{ codigo: string | null; nome: string; marcadas: Set<string>; sistema: boolean; fixo: boolean; apps: string[] } | null>(null);
  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!dados) return <p className="vazio">Carregando…</p>;
  const pode = (c: string) => permissoes.includes(c);

  const abrir = (p?: PerfilPerm) => setForm(p
    ? { codigo: p.codigo, nome: p.nome, marcadas: new Set(p.permissoes), sistema: p.sistema, fixo: p.fixo, apps: [] }
    : { codigo: null, nome: '', marcadas: new Set(['ver.comunicados', 'ver.documentos', 'documentos.abrir', 'ver.pessoas', 'ver.ajuda']), sistema: false, fixo: false, apps: [] });
  const apagar = async (p: PerfilPerm) => {
    if (!window.confirm(`Apagar o perfil "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    setFalha(''); setAviso('');
    try { await api(`/api/perfis/${p.codigo}`, undefined, 'DELETE'); setAviso(`Perfil "${p.nome}" apagado.`); recarregar(); }
    catch (e) { setFalha((e as Error).message); }
  };

  return (
    <section className="crud">
      <div className="barra">
        <p className="suave" style={{ margin: 0 }}>
          Cada usuário tem um perfil, que define o que ele acessa e o que pode fazer em cada tela e em cada aba. Crie perfis novos (ex.: RH, Chão de fábrica) e marque as permissões de cada um.
          Para dar algo a uma pessoa específica, use <b>Usuários › Editar</b>: o que for definido lá vale por cima do perfil.
        </p>
        {pode('cfg.perfis.criar') && <button className="btn" onClick={() => abrir()}><Icone nome="mais" tamanho={15} /> Novo perfil</button>}
      </div>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {falha && <p className="erro" role="alert">{falha}</p>}
      <div className="rolagem">
        <table className="dados">
          <thead><tr>{ord.cab('perfil', 'Perfil')}{ord.cab('codigo', 'Código')}<th>O que pode fazer</th>{ord.cab('usuarios', 'Usuários')}<th className="col-acoes">Ações</th></tr></thead>
          <tbody>
            {(ord.linhas ?? []).map((p) => (
              <tr key={p.codigo}>
                <td data-rotulo="Perfil"><b>{p.nome}</b> {p.sistema ? <Selo texto="Padrão do sistema" tom="neutro" /> : <Selo texto="Personalizado" tom="ok" />}</td>
                <td data-rotulo="Código">{p.codigo}</td>
                <td data-rotulo="O que pode fazer">{p.fixo ? 'Tudo, sempre (não editável).' : resumo(dados.catalogo, p)}</td>
                <td data-rotulo="Usuários">{p.usuarios}</td>
                <td className="col-acoes">
                  {(p.fixo || pode('cfg.perfis.editar')) && <button className="btn btn-sec btn-pequeno" onClick={() => abrir(p)}><Icone nome="editar" tamanho={13} /> {p.fixo ? 'Ver' : 'Editar'}</button>}
                  {!p.sistema && pode('cfg.perfis.excluir') && <button className="btn btn-vermelho btn-pequeno" onClick={() => void apagar(p)}><Icone nome="lixeira" tamanho={13} /> Apagar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <JanelaForm titulo={form.codigo ? `${form.fixo ? 'Perfil' : 'Editar perfil'}: ${form.nome}` : 'Novo perfil'} rotuloEnviar={form.fixo ? 'Fechar' : form.codigo ? 'Salvar' : 'Criar perfil'} aoFechar={() => setForm(null)}
          aoEnviar={async () => {
            if (form.fixo) { setForm(null); return; }
            const corpo = { nome: form.nome, permissoes: [...form.marcadas] };
            let codigo = form.codigo;
            if (codigo) await api(`/api/perfis/${codigo}`, corpo, 'PUT'); else codigo = (await api<PerfilPerm>('/api/perfis', corpo)).codigo;
            if (permissoes.includes('cfg.perfis.editar') || souAdmin) await api(`/api/perfis/${codigo}/aplicativos`, { liberados: form.apps }, 'PUT');
            setAviso(form.codigo ? `Perfil "${form.nome}" salvo. Vale já para quem está usando o portal.` : `Perfil "${form.nome}" criado.`);
            setForm(null); recarregar();
          }}>
          <label>Nome do perfil *<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={40} minLength={2} required disabled={form.sistema} />
            {form.sistema && <small className="suave">Perfis padrão do sistema mantêm o nome.</small>}</label>
          <p className="suave" style={{ margin: '4px 0' }}>{form.fixo ? 'O Administrador sempre pode tudo.' : 'Marque o que este perfil acessa e pode fazer. Em cada tela/aba, a primeira caixa libera o acesso e as outras dizem o que a pessoa pode fazer dentro dela.'}</p>
          <GradePermissoes catalogo={dados.catalogo} marcadas={form.marcadas} mudar={(marcadas) => setForm({ ...form, marcadas })} travada={form.fixo} />
          <AppsDoPerfil codigo={form.codigo} marcados={form.apps} mudar={(apps) => setForm((f) => (f ? { ...f, apps } : f))} travada={form.fixo} />
          {!souAdmin && !form.fixo && <p className="suave">Você só consegue conceder permissões que você mesmo tem.</p>}
        </JanelaForm>
      )}
    </section>
  );
}

/** Dentro do cadastro do usuário: caixas mostrando o que a pessoa pode. Marcar/desmarcar diferente do perfil vira um ajuste só dela. */
export function AjustesUsuario({ perfil, ajustes, mudar }: { perfil: string; ajustes: Ajustes; mudar: (a: Ajustes) => void }) {
  const { dados, erro } = useCatalogo();
  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!dados) return <p className="suave">Carregando permissões…</p>;
  if (perfil === 'admin') return <p className="suave">O Administrador sempre pode tudo; não há o que ajustar.</p>;
  const info = dados.perfis.find((p) => p.codigo === perfil);
  const doPerfil = new Set(info?.permissoes ?? []);
  const todas = todasAsChaves(dados.catalogo);
  // Valor que vale hoje = perfil + ajustes.
  const efetivas = new Set(todas.filter((c) => (c in ajustes ? ajustes[c] : doPerfil.has(c))));
  const aplicar = (novas: Set<string>) => {
    const out: Ajustes = {};
    for (const c of todas) if (novas.has(c) !== doPerfil.has(c)) out[c] = novas.has(c); // só o que difere do perfil
    mudar(out);
  };
  const qtd = Object.keys(ajustes).length;
  return (
    <fieldset className="perm-usuario-caixa">
      <legend>Permissões desta pessoa</legend>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 8px' }}>
        <p className="suave" style={{ margin: 0, flex: '1 1 260px' }}>
          Vem marcado o que o perfil <b>{info?.nome}</b> permite. Marque ou desmarque para ajustar só esta pessoa: o que você mudar aqui vale por cima do perfil. Itens diferentes do perfil ganham a marca <b>+ só ela</b> (liberado) ou <b>− só ela</b> (bloqueado).
        </p>
        {qtd > 0 && <button type="button" className="btn btn-sec btn-pequeno" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={() => mudar({})}>Voltar ao padrão do perfil ({qtd} ajuste{qtd > 1 ? 's' : ''})</button>}
      </div>
      <GradePermissoes catalogo={dados.catalogo} marcadas={efetivas} mudar={aplicar}
        marca={(c) => (c in ajustes ? (ajustes[c] ? 'liberado só para esta pessoa' : 'bloqueado só para esta pessoa') : null)} />
    </fieldset>
  );
}
