import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { dataCurta, useLista } from '../dados';
import { JanelaForm, Selo } from './Crud';
import type { PerfilAcesso } from '../sessao';
import { AjustesUsuario, useCatalogo, type Ajustes } from './Permissoes';
import { useOrdenacao } from './Ordenar';
import { Dica, DicaAba } from '../Dica';

interface Usr { id: number; login: string; nome: string; email: string | null; perfil: PerfilAcesso; perfil_nome: string; ativo: number; trocar_senha: number; exige_aprovacao?: number; ultimo_acesso: string | null; permissoes: Ajustes }

/** Senha provisória legível (sem caracteres que se confundem). */
function gerarSenha(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint32Array(12));
  return [...b].map((n) => letras[n % letras.length]).join('');
}

function CampoSenha({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <label>Senha provisória *
      <span className="campo-senha">
        <input value={valor} onChange={(e) => mudar(e.target.value)} minLength={8} maxLength={128} required autoComplete="off" spellCheck={false} />
        <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mudar(gerarSenha())}>Gerar</button>
      </span>
      <small className="suave">Passe esta senha à pessoa. No primeiro acesso o sistema pede para ela criar a própria senha.</small>
    </label>
  );
}

/** Lista de aplicativos restritos de uma pessoa (marcados = ela vê). Usada na janela "Aplicativos" e dentro de "Editar usuário". */
function AppsDaPessoa({ id, marcados, mudar }: { id: number; marcados: string[]; mudar: (m: string[]) => void }) {
  const [info, setInfo] = useState<{ restritas: { slug: string; nome: string; categoria: string; ativo: number }[]; liberados: string[]; doPerfil: string[]; perfilNome: string; admin: boolean } | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api<NonNullable<typeof info>>(`/api/usuarios/${id}/aplicativos`).then((r) => { setInfo(r); mudar(r.liberados); }).catch((e) => setErro((e as Error).message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const alternar = (slug: string) => mudar(marcados.includes(slug) ? marcados.filter((x) => x !== slug) : [...marcados, slug]);
  return (
    <>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!info && !erro && <p className="suave">Carregando…</p>}
      {info && (
        <>
          <p className="suave" style={{ marginTop: 0 }}>Os aplicativos <b>comuns</b> aparecem para todos. Os <b>restritos</b> que o perfil <b>{info.perfilNome}</b> libera já vêm marcados (e travados). Marque abaixo outros aplicativos restritos só para esta pessoa.</p>
          {info.admin && <p className="suave">Administradores veem todos os aplicativos, independente desta lista.</p>}
          {info.restritas.length === 0 ? <p className="vazio">Nenhum aplicativo restrito ainda. Para limitar um aplicativo a certas pessoas: Publicar › Aplicativos › Editar › marque “Restrita”.</p> : (
            <div className="lista-marcar" role="group" aria-label="Aplicativos restritos">
              {info.restritas.map((a) => (
                <label key={a.slug} className="linha"><input type="checkbox" checked={info.doPerfil.includes(a.slug) || marcados.includes(a.slug)} disabled={info.doPerfil.includes(a.slug)} onChange={() => alternar(a.slug)} />{a.nome} <small className="suave">{a.categoria}{a.ativo ? '' : ' · inativo'}{info.doPerfil.includes(a.slug) ? ` · pelo perfil ${info.perfilNome}` : marcados.includes(a.slug) ? ' · só esta pessoa' : ''}</small></label>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Janela "Aplicativos" de uma pessoa (atalho na linha da tabela). */
function AplicativosUsuario({ u, aoFechar }: { u: Usr; aoFechar: (msg?: string) => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  return (
    <JanelaForm titulo={`Aplicativos de ${u.nome}`} aoFechar={() => aoFechar()}
      aoEnviar={async () => { await api(`/api/usuarios/${u.id}/aplicativos`, { liberados: marcados }, 'PUT'); aoFechar(`Aplicativos de "${u.login}" atualizados.`); }}>
      <AppsDaPessoa id={u.id} marcados={marcados} mudar={setMarcados} />
    </JanelaForm>
  );
}

function Usuarios({ souAdmin, permissoes }: { souAdmin: boolean; permissoes: string[] }) {
  const libera = (acao: string) => permissoes.includes(`cfg.usuarios.${acao}`);
  // Quem não é administrador não cria nem promove administradores (o servidor também recusa).
  const { dados: catalogo } = useCatalogo();
  const perfisEscolha = (catalogo?.perfis ?? []).filter((p) => souAdmin || p.codigo !== 'admin');
  const { dados, erro, recarregar } = useLista<Usr>('/api/usuarios');
  const ord = useOrdenacao(dados, {
    nome: (u) => u.nome, login: (u) => u.login, perfil: (u) => u.perfil_nome,
    situacao: (u) => (u.ativo ? (u.trocar_senha ? 'Aguardando 1º acesso' : 'Ativo') : 'Desativado'), acesso: (u) => u.ultimo_acesso,
  });
  const [aviso, setAviso] = useState('');
  const [novo, setNovo] = useState<{ login: string; nome: string; email: string; perfil: PerfilAcesso; senha: string; permissoes: Ajustes; exige_aprovacao: boolean } | null>(null);
  const [edit, setEdit] = useState<Usr | null>(null);
  const [reset, setReset] = useState<{ u: Usr; senha: string } | null>(null);
  const [apps, setApps] = useState<Usr | null>(null);
  const [pedidos, setPedidos] = useState<{ id: number; usuario_id: number; criado_em: string; login: string; nome: string }[]>([]);
  const lerPedidos = () => { if (libera('senha')) api<typeof pedidos>('/api/gestao/pedidos-senha').then(setPedidos).catch(() => { /* sem pedidos */ }); };
  useEffect(lerPedidos, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dispensar = async (id: number) => { try { await api(`/api/gestao/pedidos-senha/${id}/dispensar`, {}); lerPedidos(); } catch (e) { setAviso((e as Error).message); } };

  return (
    <section className="crud">
      {libera('criar') && <div className="barra barra-fim">
        <Dica lado="dir">
          O <b>perfil</b> define o padrão de cada pessoa (veja e edite em Perfis). Em <b>Editar</b>, você pode permitir ou negar itens só para ela: isso vale por cima do perfil.
        </Dica>
        <button className="btn" onClick={() => setNovo({ login: '', nome: '', email: '', perfil: 'consulta', senha: gerarSenha(), permissoes: {}, exige_aprovacao: false })}><Icone nome="mais" tamanho={15} /> Novo usuário</button>
      </div>}
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {pedidos.length > 0 && (
        <div className="pedidos-senha" role="region" aria-label="Pedidos de nova senha">
          <b>Pedidos de nova senha ({pedidos.length})</b>
          {pedidos.map((p) => {
            const u = (dados ?? []).find((x) => x.id === p.usuario_id);
            return (
              <div key={p.id} className="pedido-senha">
                <span><b>{p.nome}</b> <small className="suave">({p.login}) · pediu em {dataCurta(p.criado_em)}</small></span>
                <span className="pedido-acoes">
                  {u && <button className="btn btn-pequeno" onClick={() => setReset({ u, senha: gerarSenha() })}><Icone nome="chave" tamanho={13} /> Redefinir senha</button>}
                  <button className="btn btn-sec btn-pequeno" onClick={() => void dispensar(p.id)}>Dispensar</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {dados && (
        <div className="rolagem">
          <table className="dados">
            <thead><tr>{ord.cab('nome', 'Nome')}{ord.cab('login', 'Login')}{ord.cab('perfil', 'Perfil')}{ord.cab('situacao', 'Situação')}{ord.cab('acesso', 'Último acesso')}<th className="col-acoes">Ações</th></tr></thead>
            <tbody>
              {(ord.linhas ?? []).map((u) => (
                <tr key={u.id}>
                  <td data-rotulo="Nome">{u.nome}</td><td data-rotulo="Login">{u.login}</td><td data-rotulo="Perfil">{u.perfil_nome}</td>
                  <td data-rotulo="Situação">{u.ativo ? <Selo texto={u.trocar_senha ? 'Aguardando 1º acesso' : 'Ativo'} tom={u.trocar_senha ? 'aviso' : 'ok'} /> : <Selo texto="Desativado" tom="neutro" />}</td>
                  <td data-rotulo="Último acesso">{u.ultimo_acesso ? dataCurta(u.ultimo_acesso) : '—'}</td>
                  <td className="col-acoes">
                    {libera('editar') && <button className="btn btn-sec btn-pequeno" onClick={() => setEdit(u)}><Icone nome="editar" tamanho={13} /> Editar</button>}
                    {libera('aplicativos') && <button className="btn btn-sec btn-pequeno" onClick={() => setApps(u)}><Icone nome="apps" tamanho={13} /> Aplicativos</button>}
                    {libera('senha') && <button className="btn btn-sec btn-pequeno" onClick={() => setReset({ u, senha: gerarSenha() })}><Icone nome="chave" tamanho={13} /> Redefinir senha</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novo && (
        <JanelaForm titulo="Novo usuário" rotuloEnviar="Criar usuário" aoFechar={() => setNovo(null)}
          aoEnviar={async () => { await api('/api/usuarios', novo); setAviso(`Usuário "${novo.login}" criado. Senha provisória: ${novo.senha}`); setNovo(null); recarregar(); }}>
          <label>Nome completo *<input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} maxLength={80} required /></label>
          <label>E-mail (opcional)<input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} maxLength={120} autoCapitalize="none" spellCheck={false} placeholder="nome@empresa.com.br" />
            <small className="suave">Usado nos avisos de comunicados por e-mail (a pessoa pode desligar em Minha conta).</small></label>
          <label>Login *<input value={novo.login} onChange={(e) => setNovo({ ...novo, login: e.target.value.toLowerCase() })} maxLength={32} minLength={3} required autoCapitalize="none" spellCheck={false} />
            <small className="suave">Só letras minúsculas, números, ponto, hífen e sublinhado. Ex.: maria.silva</small></label>
          <label>Perfil *
            <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value as PerfilAcesso })}>
              {perfisEscolha.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select></label>
          <label className="linha"><input type="checkbox" checked={novo.exige_aprovacao} onChange={(e) => setNovo({ ...novo, exige_aprovacao: e.target.checked })} />Precisa de aprovação do RH para publicar<small className="suave"> (o que ela publicar vai para a fila de aprovação)</small></label>
          <CampoSenha valor={novo.senha} mudar={(senha) => setNovo({ ...novo, senha })} />
          <AjustesUsuario perfil={novo.perfil} ajustes={novo.permissoes} mudar={(permissoes) => setNovo({ ...novo, permissoes })} />
        </JanelaForm>
      )}

      {edit && (
        <JanelaForm titulo={`Editar ${edit.login}`} aoFechar={() => setEdit(null)}
          aoEnviar={async () => { await api(`/api/usuarios/${edit.id}`, { nome: edit.nome, email: edit.email ?? '', perfil: edit.perfil, ativo: !!edit.ativo, permissoes: edit.permissoes, exige_aprovacao: !!edit.exige_aprovacao }, 'PUT'); setAviso('Usuário atualizado.'); setEdit(null); recarregar(); }}>
          <label>Nome completo *<input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} maxLength={80} required /></label>
          <label>E-mail (opcional)<input type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} maxLength={120} autoCapitalize="none" spellCheck={false} placeholder="nome@empresa.com.br" /></label>
          <label>Perfil *
            <select value={edit.perfil} onChange={(e) => setEdit({ ...edit, perfil: e.target.value as PerfilAcesso })}>
              {perfisEscolha.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select></label>
          <label className="linha"><input type="checkbox" checked={!!edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked ? 1 : 0 })} />Usuário ativo (desativar derruba o acesso na hora)</label>
          <label className="linha"><input type="checkbox" checked={!!edit.exige_aprovacao} onChange={(e) => setEdit({ ...edit, exige_aprovacao: e.target.checked ? 1 : 0 })} />Precisa de aprovação do RH para publicar<small className="suave"> (o que ela publicar vai para a fila de aprovação)</small></label>
          <AjustesUsuario perfil={edit.perfil} ajustes={edit.permissoes} mudar={(permissoes) => setEdit({ ...edit, permissoes })} />
        </JanelaForm>
      )}

      {apps && <AplicativosUsuario u={apps} aoFechar={(msg) => { setApps(null); if (msg) setAviso(msg); }} />}

      {reset && (
        <JanelaForm titulo={`Redefinir senha de ${reset.u.login}`} rotuloEnviar="Redefinir" aoFechar={() => setReset(null)}
          aoEnviar={async () => { await api(`/api/usuarios/${reset.u.id}/senha`, { senha: reset.senha }); setAviso(`Senha de "${reset.u.login}" redefinida. Nova senha provisória: ${reset.senha}`); setReset(null); recarregar(); lerPedidos(); }}>
          <p className="suave" style={{ marginTop: 0 }}>A pessoa será desconectada e precisará criar uma senha nova no próximo acesso.</p>
          <CampoSenha valor={reset.senha} mudar={(senha) => setReset({ ...reset, senha })} />
        </JanelaForm>
      )}
    </section>
  );
}

const ACAO: Record<string, string> = {
  publicacao_aprovada: 'Publicação aprovada', publicacao_rejeitada: 'Publicação rejeitada', rede_criada: 'Publicação para rede social criada', rede_alterada: 'Publicação para rede social alterada', rede_apagada: 'Publicação para rede social apagada', rede_enviada: 'Publicação enviada para aprovação', rede_publicada: 'Publicação marcada como publicada', avisos_lidos: 'Avisos do sino marcados como lidos',
  usuario_aplicativos_alterados: 'Aplicativos da pessoa alterados', avisos_email_enviados: 'Aviso de comunicado enviado por e-mail', avisos_email_configurados: 'Avisos por e-mail configurados', perfil_aplicativos_alterados: 'Aplicativos do perfil alterados', calendario_data_criada: 'Data do calendário criada', calendario_data_alterada: 'Data do calendário alterada', calendario_data_apagada: 'Data do calendário apagada',
  calendario_feriados_gerados: 'Feriados do ano gerados', calendario_agendas_alteradas: 'Agendas exibidas no calendário alteradas',
  login: 'Entrou', sair: 'Saiu', login_falhou: 'Login recusado', login_bloqueado: 'Login bloqueado (muitas tentativas)', senha_trocada: 'Trocou a própria senha',
  senha_redefinida: 'Senha redefinida pelo admin', usuario_criado: 'Usuário criado', usuario_alterado: 'Usuário alterado', integracao_zimbra_alterada: 'Conexão com o Zimbra alterada', integracao_zimbra_desconectada: 'Zimbra desconectado', integracao_zimbra_testada: 'Conexão com o Zimbra testada', integracao_zimbra_config: 'Configuração do Zimbra alterada', data_importante_criada: 'Data importante criada', data_importante_excluida: 'Data importante excluída', perfil_criado: 'Perfil criado', perfil_apagado: 'Perfil apagado', perfil_alterado: 'Permissões do perfil alteradas',
  comunicado_criado: 'Comunicado criado', comunicado_alterado: 'Comunicado alterado', comunicado_apagado: 'Comunicado apagado',
  documento_criado: 'Documento criado', documento_alterado: 'Documento alterado', documento_apagado: 'Documento apagado',
  contato_criado: 'Contato criado', contato_alterado: 'Contato alterado', contato_apagado: 'Contato apagado',
  destaque_criado: 'Destaque criado', destaque_alterado: 'Destaque alterado', destaque_apagado: 'Destaque apagado',
  aplicacao_criada: 'Aplicação criada', aplicacao_alterada: 'Aplicação alterada', aplicacao_apagada: 'Aplicação apagada',
  admin_criado_cli: 'Administrador criado (terminal)', admin_redefinido_cli: 'Administrador redefinido (terminal)',
};

function resumo(detalhe: string | null): string {
  if (!detalhe) return '';
  try {
    const o = JSON.parse(detalhe) as Record<string, unknown>;
    return Object.entries(o).filter(([k]) => k !== 'id').map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
  } catch { return ''; }
}

function Auditoria() {
  const { dados, erro } = useLista<{ id: number; quando: string; usuario: string | null; acao: string; detalhe: string | null }>('/api/auditoria');
  const ord = useOrdenacao(dados, { quando: (l) => l.quando, quem: (l) => l.usuario, acao: (l) => ACAO[l.acao] ?? l.acao, detalhe: (l) => resumo(l.detalhe) });
  return (
    <section className="crud">
      <DicaAba>Últimos 200 registros. A auditoria só aceita inclusão: ninguém consegue alterar ou apagar o histórico. Senhas nunca são gravadas.</DicaAba>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados && (
        <div className="rolagem">
          <table className="dados">
            <thead><tr>{ord.cab('quando', 'Quando')}{ord.cab('quem', 'Quem')}{ord.cab('acao', 'O quê')}{ord.cab('detalhe', 'Detalhe')}</tr></thead>
            <tbody>
              {dados.length === 0 && <tr><td colSpan={4} className="vazio">Sem registros.</td></tr>}
              {(ord.linhas ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="nowrap" data-rotulo="Quando">{new Date(l.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td data-rotulo="Quem">{l.usuario ?? '—'}</td><td data-rotulo="O quê">{ACAO[l.acao] ?? l.acao}</td><td className="suave" data-rotulo="Detalhe">{resumo(l.detalhe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Administracao({ parte, souAdmin, permissoes }: { parte: 'usuarios' | 'auditoria'; souAdmin: boolean; permissoes: string[] }) {
  return parte === 'usuarios' ? <Usuarios souAdmin={souAdmin} permissoes={permissoes} /> : <Auditoria />;
}
