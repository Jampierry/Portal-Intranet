import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Selo } from './Crud';

interface Conta {
  id: string; nome: string; tipo: 'zimbra' | 'google' | 'microsoft' | 'smtp'; user: string; host: string; smtp_host: string; smtp_port: number;
  funcoes: string[]; agendas: string[] | null; oauth: boolean; conectada: boolean; principal: boolean;
}
interface Dados {
  contas: Conta[]; tipos: Record<string, { nome: string; funcoes: string[]; oauth?: boolean }>;
  oauth: Record<string, { client_id: string; segredo_salvo: boolean }>; redirect_uri: string;
}
interface Agenda { id: string; nome: string; selecionada: boolean; compartilhada?: boolean }

const FUNCOES: Record<string, string> = {
  email: 'Ler e-mails', envio: 'Enviar e-mails', agenda: 'Agenda (calendário)', agenda_escrita: 'Criar e excluir eventos',
  notificacoes: 'Avisos do portal por e-mail', contatos: 'Contatos', tarefas: 'Tarefas', arquivos: 'Arquivos',
};
const CURTO: Record<string, string> = { email: 'E-mails', envio: 'Envio', agenda: 'Agenda', agenda_escrita: 'Criar eventos', notificacoes: 'Avisos', contatos: 'Contatos', tarefas: 'Tarefas', arquivos: 'Arquivos' };
const ROTULO: Record<string, string> = { google: 'Google', microsoft: 'Microsoft', zimbra: 'Zimbra', smtp: 'SMTP' };
const VAZIA = { id: '', nome: '', tipo: 'google' as Conta['tipo'], user: '', host: '', smtp_host: '', smtp_port: '', senha: '', funcoes: [] as string[] };

/** Contas conectadas: várias contas de provedores diferentes ao mesmo tempo; cada função (agenda, avisos…) usa todas as contas em que estiver ligada. */
export function ContasEmail({ edita }: { edita: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [form, setForm] = useState<typeof VAZIA | null>(null);
  const [cli, setCli] = useState<Record<string, { client_id: string; client_secret: string }>>({ google: { client_id: '', client_secret: '' }, microsoft: { client_id: '', client_secret: '' } });
  const [agendasDe, setAgendasDe] = useState<{ id: string; lista: Agenda[]; marcadas: Set<string> } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await api<Dados>('/api/integracoes/zimbra/contas');
      setDados(d); setErro('');
      setCli((c) => ({ google: { ...c.google, client_id: d.oauth.google?.client_id ?? '' }, microsoft: { ...c.microsoft, client_id: d.oauth.microsoft?.client_id ?? '' } }));
    } catch (e) { setErro((e as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (nome: string, f: () => Promise<void>) => {
    setOcupado(nome); setErro(''); setAviso('');
    try { await f(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(''); }
  };

  const salvar = (e: FormEvent) => { e.preventDefault(); if (!form) return; void executar('conta', async () => {
    await api('/api/integracoes/zimbra/contas', { ...form, smtp_port: form.smtp_port || undefined, senha: form.senha || undefined }, 'POST');
    setForm(null); setAviso(`Conta salva.${dados?.tipos[form.tipo]?.oauth ? ' Agora clique em Conectar para autorizar o acesso.' : ''}`); await carregar();
  }); };
  const remover = (c: Conta) => { if (!window.confirm(`Remover a conta ${c.nome}? Senhas e autorizações guardadas dela serão apagadas.`)) return; void executar('rem-' + c.id, async () => {
    await api(`/api/integracoes/zimbra/contas/${c.id}`, undefined, 'DELETE'); setAviso('Conta removida.'); await carregar();
  }); };
  const testar = (c: Conta) => void executar('t-' + c.id, async () => {
    const r = await api<{ ok?: boolean; conta?: string }>(`/api/integracoes/zimbra/contas/${c.id}/testar`, {});
    setAviso(`${c.nome}: conexão OK${r.conta ? ` (${r.conta})` : ''}.`);
  });
  const conectar = (c: Conta) => void executar('c-' + c.id, async () => {
    const r = await api<{ url: string }>('/api/integracoes/zimbra/oauth/iniciar', { conta: c.id });
    window.open(r.url, '_blank', 'noopener');
    setAviso('Janela de login aberta. Depois de autorizar, volte aqui e clique em “Atualizar”.');
  });
  const salvarCli = (prov: string) => void executar('cli-' + prov, async () => {
    await api('/api/integracoes/zimbra/oauth/cliente', { provedor: prov, client_id: cli[prov].client_id, client_secret: cli[prov].client_secret || undefined }, 'PUT');
    setCli({ ...cli, [prov]: { ...cli[prov], client_secret: '' } }); setAviso('Aplicativo OAuth salvo.'); await carregar();
  });
  const abrirAgendas = (c: Conta) => void executar('ag-' + c.id, async () => {
    const lista = await api<Agenda[]>(`/api/integracoes/zimbra/contas/${c.id}/agendas`);
    setAgendasDe({ id: c.id, lista, marcadas: new Set(lista.filter((a) => a.selecionada).map((a) => a.id)) });
  });
  const salvarAgendas = (c: Conta) => void executar('sag-' + c.id, async () => {
    if (!agendasDe) return;
    await api('/api/integracoes/zimbra/contas', { id: c.id, tipo: c.tipo, user: c.user, nome: c.nome, host: c.host, smtp_host: c.smtp_host, smtp_port: c.smtp_port || undefined, funcoes: c.funcoes, agendas: [...agendasDe.marcadas] }, 'POST');
    setAgendasDe(null); setAviso('Agendas da conta salvas.'); await carregar();
  });
  const alternarFuncao = (f: string) => setForm((x) => (x ? { ...x, funcoes: x.funcoes.includes(f) ? x.funcoes.filter((y) => y !== f) : [...x.funcoes, f] } : x));

  if (!dados && !erro) return <p className="vazio">Carregando contas…</p>;
  const tipoForm = form ? dados?.tipos[form.tipo] : undefined;

  return (
    <div className="cartao-sec int-bloco int-2col">
      <h3>3. Contas conectadas (várias ao mesmo tempo)</h3>
      <p className="suave">Cada função (agenda, avisos por e-mail, leitura de e-mails…) usa <b>todas</b> as contas em que estiver ligada: os eventos de todas aparecem juntos e os avisos saem pela primeira conta que funcionar. A conta principal é a configurada acima.</p>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}

      {dados && (
        <table className="tabela">
          <thead><tr><th>Conta</th><th>Tipo</th><th>E-mail</th><th>Funções</th><th>Situação</th>{edita && <th>Ações</th>}</tr></thead>
          <tbody>
            {dados.contas.map((c) => (
              <tr key={c.id}>
                <td><b>{c.nome}</b>{c.principal && <small className="suave"> (principal)</small>}</td>
                <td>{ROTULO[c.tipo]}</td>
                <td>{c.user || '—'}</td>
                <td>{c.funcoes.length ? c.funcoes.map((f) => CURTO[f] ?? f).join(' · ') : <span className="suave">nenhuma</span>}</td>
                <td>{c.conectada ? <Selo texto="Conectada" tom="ok" /> : <Selo texto={c.oauth ? 'Falta conectar' : 'Sem senha'} tom="neutro" />}</td>
                {edita && <td className="acoes">
                  {c.oauth && <button type="button" className="btn btn-pequeno" disabled={ocupado !== ''} onClick={() => conectar(c)}>{c.conectada ? 'Reconectar' : 'Conectar'}</button>}
                  {(c.tipo === 'google' || c.tipo === 'microsoft') && c.conectada && c.funcoes.includes('agenda') && <button type="button" className="btn btn-sec btn-pequeno" disabled={ocupado !== ''} onClick={() => abrirAgendas(c)}>Agendas</button>}
                  <button type="button" className="btn btn-sec btn-pequeno" disabled={ocupado !== '' || !c.conectada} onClick={() => testar(c)}>Testar</button>
                  {!c.principal && <>
                    <button type="button" className="btn btn-sec btn-pequeno" disabled={ocupado !== ''} onClick={() => setForm({ ...VAZIA, id: c.id, nome: c.nome, tipo: c.tipo, user: c.user, host: c.host, smtp_host: c.smtp_host, smtp_port: c.smtp_port ? String(c.smtp_port) : '', funcoes: c.funcoes })}>Editar</button>
                    <button type="button" className="btn btn-sec btn-pequeno" disabled={ocupado !== ''} onClick={() => remover(c)}>Remover</button>
                  </>}
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="barra">
        <button type="button" className="btn btn-sec" onClick={() => void carregar()} disabled={ocupado !== ''}>Atualizar</button>
        {edita && !form && <button type="button" className="btn" onClick={() => setForm({ ...VAZIA })}>Adicionar conta</button>}
      </div>

      {agendasDe && (() => { const c = dados?.contas.find((x) => x.id === agendasDe.id); if (!c) return null; return (
        <fieldset className="int-servicos">
          <legend>Agendas de {c.nome} usadas no calendário</legend>
          {agendasDe.lista.map((a) => (
            <label key={a.id} className="perm-check">
              <input type="checkbox" checked={agendasDe.marcadas.has(a.id)} onChange={() => { const s = new Set(agendasDe.marcadas); if (s.has(a.id)) s.delete(a.id); else s.add(a.id); setAgendasDe({ ...agendasDe, marcadas: s }); }} />
              <span>{a.nome}{a.compartilhada && <small className="suave"> compartilhada</small>}</span>
            </label>
          ))}
          <div className="barra"><button type="button" className="btn" onClick={() => salvarAgendas(c)} disabled={ocupado !== ''}>Salvar agendas</button><button type="button" className="btn btn-sec" onClick={() => setAgendasDe(null)}>Cancelar</button></div>
        </fieldset>
      ); })()}

      {form && (
        <form className="int-bloco" onSubmit={salvar}>
          <h4>{dados?.contas.some((c) => c.id === form.id) ? 'Editar conta' : 'Nova conta'}</h4>
          <div className="int-duas">
          <div className="grade2">
            <label>Tipo de conta
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Conta['tipo'], funcoes: [] })}>
                {Object.entries(dados?.tipos ?? {}).map(([id, t]) => <option key={id} value={id}>{t.nome}</option>)}
              </select></label>
            <label>Identificador (sem espaços)
              <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required placeholder="ex.: gmail-rh" disabled={!!dados?.contas.some((c) => c.id === form.id)} /></label>
            <label>Nome para exibir<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Gmail do RH" /></label>
            <label>E-mail da conta<input type="email" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} required /></label>
            {(form.tipo === 'zimbra' || form.tipo === 'smtp') && <>
              {form.tipo === 'zimbra' && <label>Servidor (host)<input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required placeholder="webmail.suaempresa.com.br" /></label>}
              <label>SMTP (envio){form.tipo === 'smtp' ? '' : ' — opcional'}
                <span className="linha-smtp"><input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} required={form.tipo === 'smtp'} placeholder="smtp.provedor.com" />
                  <input className="curto" value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: e.target.value.replace(/\D/g, '') })} placeholder="465" aria-label="Porta SMTP" /></span></label>
              <label>Senha<input type="password" autoComplete="new-password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Vazio = manter a salva (use senha de aplicativo se houver verificação em duas etapas)" /></label>
            </>}
          </div>
          <div className="int-bloco">
          <fieldset className="int-servicos">
            <legend>Funções desta conta</legend>
            {(tipoForm?.funcoes ?? []).map((f) => (
              <label key={f} className="perm-check int-servico"><input type="checkbox" checked={form.funcoes.includes(f)} onChange={() => alternarFuncao(f)} /><span><b>{FUNCOES[f] ?? f}</b></span></label>
            ))}
          </fieldset>
          {tipoForm?.oauth && <p className="suave">Esta conta entra por <b>login OAuth</b> (sem guardar senha): salve e clique em <b>Conectar</b>. Antes, cadastre abaixo o aplicativo do {ROTULO[form.tipo]}.</p>}
          </div>
          </div>
          <div className="barra"><button className="btn" disabled={ocupado !== ''}>{ocupado === 'conta' ? 'Salvando…' : 'Salvar conta'}</button><button type="button" className="btn btn-sec" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}

      {dados && (
        <details className="int-bloco" open={!dados.oauth.google?.client_id && !dados.oauth.microsoft?.client_id && dados.contas.some((c) => c.oauth)}>
          <summary><b>Aplicativos OAuth (Google e Microsoft)</b></summary>
          <p className="suave">O Google e a Microsoft só liberam e-mail e agenda para um aplicativo cadastrado por você (gratuito). Use como <b>endereço de redirecionamento</b> exatamente: <code>{dados.redirect_uri}</code></p>
          <ul className="suave int-duas">
            <li><b>Google:</b> console.cloud.google.com › APIs e serviços › ative “Gmail API” e “Google Calendar API” › Credenciais › ID do cliente OAuth (tipo “Aplicativo da Web”). Em modo de teste, adicione os e-mails como usuários de teste; a autorização expira a cada 7 dias até o aplicativo ser publicado/verificado.</li>
            <li><b>Microsoft:</b> entra.microsoft.com › Registros de aplicativo › Novo (contas em qualquer diretório e contas pessoais) › plataforma “Web” com o endereço acima › Permissões delegadas: Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, User.Read, offline_access › crie um segredo do cliente.</li>
          </ul>
          <div className="int-duas">
          {(['google', 'microsoft'] as const).map((p) => (
            <div key={p} className="int-bloco cartao-sec">
              <label>{ROTULO[p]} — ID do aplicativo (client id)<input value={cli[p].client_id} onChange={(e) => setCli({ ...cli, [p]: { ...cli[p], client_id: e.target.value } })} disabled={!edita} /></label>
              <label>{ROTULO[p]} — segredo do cliente
                <input type="password" autoComplete="off" value={cli[p].client_secret} onChange={(e) => setCli({ ...cli, [p]: { ...cli[p], client_secret: e.target.value } })} disabled={!edita}
                  placeholder={dados.oauth[p]?.segredo_salvo ? '•••••••• (já salvo — deixe em branco para manter)' : 'Cole o segredo'} /></label>
              {edita && <div className="barra"><button type="button" className="btn btn-sec" disabled={ocupado !== '' || !cli[p].client_id.trim()} onClick={() => salvarCli(p)}>Salvar {ROTULO[p]}</button></div>}
            </div>
          ))}
          </div>
        </details>
      )}
    </div>
  );
}
