import { useEffect, useState } from 'react';
import { api } from '../api';

export interface GrupoPerm { grupo: string; itens: { chave: string; rotulo: string }[] }
export interface PerfilPerm { codigo: string; nome: string; fixo: boolean; permissoes: string[] }
export interface Catalogo { catalogo: GrupoPerm[]; perfis: PerfilPerm[] }
export type Ajustes = Record<string, boolean>;

/** Catálogo de permissões e o que cada perfil tem hoje (só administrador). */
export function useCatalogo() {
  const [dados, setDados] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  useEffect(() => { api<Catalogo>('/api/perfis').then((d) => { setDados(d); setErro(''); }).catch((e: Error) => setErro(e.message)); }, [versao]);
  return { dados, erro, recarregar: () => setVersao((v) => v + 1) };
}

/** Aba Perfis: o administrador marca o que cada perfil pode fazer e quais telas acessa. O administrador é fixo (tem tudo). */
export function EditorPerfis() {
  const { dados, erro, recarregar } = useCatalogo();
  const [marcas, setMarcas] = useState<Record<string, Set<string>>>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  useEffect(() => { if (dados) setMarcas(Object.fromEntries(dados.perfis.map((p) => [p.codigo, new Set(p.permissoes)]))); }, [dados]);
  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!dados) return <p className="vazio">Carregando…</p>;

  const editaveis = dados.perfis.filter((p) => !p.fixo);
  const alternar = (perfil: string, chave: string) => {
    setAviso('');
    setMarcas((m) => { const s = new Set(m[perfil]); if (s.has(chave)) s.delete(chave); else s.add(chave); return { ...m, [perfil]: s }; });
  };
  const sujo = editaveis.some((p) => { const a = marcas[p.codigo]; return !a || a.size !== p.permissoes.length || p.permissoes.some((c) => !a.has(c)); });
  const salvar = async () => {
    setSalvando(true); setFalha(''); setAviso('');
    try {
      for (const p of editaveis) await api(`/api/perfis/${p.codigo}`, { permissoes: [...(marcas[p.codigo] ?? [])] }, 'PUT');
      setAviso('Perfis salvos. Vale já para quem está usando o portal.'); recarregar();
    } catch (e) { setFalha((e as Error).message); } finally { setSalvando(false); }
  };

  return (
    <section className="cartao-sec">
      <p className="suave" style={{ marginTop: 0 }}>
        Marque o que cada perfil pode fazer e quais telas pode acessar. O <b>Administrador</b> sempre pode tudo. Para dar algo a uma pessoa específica,
        sem mudar o perfil dela, use <b>Usuários › Editar › Permissões desta pessoa</b>: o que for definido lá vale por cima do perfil.
      </p>
      <div className="rolagem">
        <table className="dados matriz-perm">
          <thead><tr><th>Permissão</th>{dados.perfis.map((p) => <th key={p.codigo} className="col-marca">{p.nome}</th>)}</tr></thead>
          {dados.catalogo.map((g) => (
            <tbody key={g.grupo}>
              <tr className="grupo-perm"><th colSpan={dados.perfis.length + 1} scope="colgroup">{g.grupo}</th></tr>
              {g.itens.map((i) => (
                <tr key={i.chave}>
                  <td>{i.rotulo}</td>
                  {dados.perfis.map((p) => (
                    <td key={p.codigo} className="col-marca">
                      <input type="checkbox" aria-label={`${p.nome}: ${i.rotulo}`} disabled={p.fixo}
                        checked={p.fixo || !!marcas[p.codigo]?.has(i.chave)} onChange={() => alternar(p.codigo, i.chave)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="suave">As abas de Configurações (Usuários, Perfis, Auditoria) também podem ser liberadas aqui. Quem não é administrador só consegue conceder o que ele mesmo tem e nunca altera administradores.</p>
      {falha && <p className="erro" role="alert">{falha}</p>}
      {aviso && <p className="ok" role="status">{aviso}</p>}
      <div className="barra"><button className="btn" disabled={!sujo || salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar perfis'}</button></div>
    </section>
  );
}

type Escolha = 'herdar' | 'permitir' | 'negar';

/** Dentro do cadastro do usuário: para cada permissão, seguir o perfil ou definir "permitir"/"negar" só para esta pessoa. */
export function AjustesUsuario({ perfil, ajustes, mudar }: { perfil: string; ajustes: Ajustes; mudar: (a: Ajustes) => void }) {
  const { dados, erro } = useCatalogo();
  if (erro) return <p className="erro" role="alert">{erro}</p>;
  if (!dados) return <p className="suave">Carregando permissões…</p>;
  if (perfil === 'admin') return <p className="suave">O Administrador sempre pode tudo; não há o que ajustar.</p>;
  const doPerfil = new Set(dados.perfis.find((p) => p.codigo === perfil)?.permissoes ?? []);
  const valor = (c: string): Escolha => (c in ajustes ? (ajustes[c] ? 'permitir' : 'negar') : 'herdar');
  const definir = (c: string, e: Escolha) => {
    const novo = { ...ajustes };
    if (e === 'herdar') delete novo[c]; else novo[c] = e === 'permitir';
    mudar(novo);
  };
  const qtd = Object.keys(ajustes).length;
  return (
    <fieldset className="perm-usuario">
      <legend>Permissões desta pessoa</legend>
      <p className="suave" style={{ margin: '0 0 8px' }}>
        “Seguir o perfil” usa o que o perfil tem. “Permitir” ou “Negar” vale só para esta pessoa e passa por cima do perfil.
        {qtd > 0 && <> <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mudar({})}>Limpar {qtd} ajuste{qtd > 1 ? 's' : ''}</button></>}
      </p>
      {dados.catalogo.map((g) => (
        <div key={g.grupo} className="perm-grupo">
          <b>{g.grupo}</b>
          {g.itens.map((i) => {
            const v = valor(i.chave);
            const vale = v === 'herdar' ? doPerfil.has(i.chave) : v === 'permitir';
            return (
              <label key={i.chave} className="perm-linha">
                <span>{i.rotulo} <small className={vale ? 'perm-sim' : 'perm-nao'}>{vale ? '· pode' : '· não pode'}</small></span>
                <select value={v} onChange={(e) => definir(i.chave, e.target.value as Escolha)} aria-label={`${i.rotulo}: permissão desta pessoa`}>
                  <option value="herdar">Seguir o perfil ({doPerfil.has(i.chave) ? 'pode' : 'não pode'})</option>
                  <option value="permitir">Permitir</option>
                  <option value="negar">Negar</option>
                </select>
              </label>
            );
          })}
        </div>
      ))}
    </fieldset>
  );
}
