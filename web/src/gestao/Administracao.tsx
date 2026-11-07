import { useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { dataCurta, useLista } from '../dados';
import { JanelaForm, Selo } from './Crud';
import type { PerfilAcesso } from '../sessao';
import { AjustesUsuario, useCatalogo, type Ajustes } from './Permissoes';
import { useOrdenacao } from './Ordenar';

interface Usr { id: number; login: string; nome: string; perfil: PerfilAcesso; perfil_nome: string; ativo: number; trocar_senha: number; ultimo_acesso: string | null; permissoes: Ajustes }

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
  const [novo, setNovo] = useState<{ login: string; nome: string; perfil: PerfilAcesso; senha: string; permissoes: Ajustes } | null>(null);
  const [edit, setEdit] = useState<Usr | null>(null);
  const [reset, setReset] = useState<{ u: Usr; senha: string } | null>(null);

  return (
    <section className="crud">
      <div className="barra">
        <p className="suave" style={{ margin: 0 }}>
          O <b>perfil</b> define o padrão de cada pessoa (veja e edite em Perfis). Em <b>Editar</b>, você pode permitir ou negar itens só para ela: isso vale por cima do perfil.
        </p>
        {libera('criar') && <button className="btn" onClick={() => setNovo({ login: '', nome: '', perfil: 'consulta', senha: gerarSenha(), permissoes: {} })}><Icone nome="mais" tamanho={15} /> Novo usuário</button>}
      </div>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
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
          <label>Login *<input value={novo.login} onChange={(e) => setNovo({ ...novo, login: e.target.value.toLowerCase() })} maxLength={32} minLength={3} required autoCapitalize="none" spellCheck={false} />
            <small className="suave">Só letras minúsculas, números, ponto, hífen e sublinhado. Ex.: maria.silva</small></label>
          <label>Perfil *
            <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value as PerfilAcesso })}>
              {perfisEscolha.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select></label>
          <CampoSenha valor={novo.senha} mudar={(senha) => setNovo({ ...novo, senha })} />
          <AjustesUsuario perfil={novo.perfil} ajustes={novo.permissoes} mudar={(permissoes) => setNovo({ ...novo, permissoes })} />
        </JanelaForm>
      )}

      {edit && (
        <JanelaForm titulo={`Editar ${edit.login}`} aoFechar={() => setEdit(null)}
          aoEnviar={async () => { await api(`/api/usuarios/${edit.id}`, { nome: edit.nome, perfil: edit.perfil, ativo: !!edit.ativo, permissoes: edit.permissoes }, 'PUT'); setAviso('Usuário atualizado.'); setEdit(null); recarregar(); }}>
          <label>Nome completo *<input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} maxLength={80} required /></label>
          <label>Perfil *
            <select value={edit.perfil} onChange={(e) => setEdit({ ...edit, perfil: e.target.value as PerfilAcesso })}>
              {perfisEscolha.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select></label>
          <label className="linha"><input type="checkbox" checked={!!edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked ? 1 : 0 })} />Usuário ativo (desativar derruba o acesso na hora)</label>
          <AjustesUsuario perfil={edit.perfil} ajustes={edit.permissoes} mudar={(permissoes) => setEdit({ ...edit, permissoes })} />
        </JanelaForm>
      )}

      {reset && (
        <JanelaForm titulo={`Redefinir senha de ${reset.u.login}`} rotuloEnviar="Redefinir" aoFechar={() => setReset(null)}
          aoEnviar={async () => { await api(`/api/usuarios/${reset.u.id}/senha`, { senha: reset.senha }); setAviso(`Senha de "${reset.u.login}" redefinida. Nova senha provisória: ${reset.senha}`); setReset(null); recarregar(); }}>
          <p className="suave" style={{ marginTop: 0 }}>A pessoa será desconectada e precisará criar uma senha nova no próximo acesso.</p>
          <CampoSenha valor={reset.senha} mudar={(senha) => setReset({ ...reset, senha })} />
        </JanelaForm>
      )}
    </section>
  );
}

const ACAO: Record<string, string> = {
  login: 'Entrou', sair: 'Saiu', login_falhou: 'Login recusado', login_bloqueado: 'Login bloqueado (muitas tentativas)', senha_trocada: 'Trocou a própria senha',
  senha_redefinida: 'Senha redefinida pelo admin', usuario_criado: 'Usuário criado', usuario_alterado: 'Usuário alterado', perfil_alterado: 'Permissões do perfil alteradas',
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
      <p className="suave" style={{ margin: 0 }}>Últimos 200 registros. A auditoria só aceita inclusão: ninguém consegue alterar ou apagar o histórico. Senhas nunca são gravadas.</p>
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
