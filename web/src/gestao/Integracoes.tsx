import { confirmar } from '../Confirmar.tsx';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Selo } from './Crud';
import { DicaAba } from '../Dica';
import { ContasEmail } from './ContasEmail';
import { AvisosEmail } from './AvisosEmail';

interface EstadoServico {
  host: string; user: string; smtp_host: string; smtp_port: number; senha_salva: boolean; servico_user: string; servico_senha_salva: boolean;
  remetente_nome: string; dominios_permitidos: string[]; limite_hora: number; api_usa: string; servicos: Record<string, boolean>;
  provedor: string; permitir_outros_dominios: boolean; provedores: Record<string, string>;
}
interface Situacao {
  url: string; token_salvo: boolean; origem: 'banco' | 'ambiente' | null; agenda_destino: string;
  servico: { alcancavel: boolean; erro?: string; config?: EstadoServico };
}
interface Agenda { id: string; nome: string; selecionada: boolean }

const SERVICOS: [string, string, string][] = [
  ['agenda', 'Agenda', 'Ler as datas importantes e mostrar no calendário do menu.'],
  ['agenda_escrita', 'Criar e excluir eventos', 'Permite cadastrar datas importantes pelo portal (quem tiver permissão).'],
  ['email', 'Ler e-mails', 'Leitura da caixa (usado só pelo assistente/MCP; o portal não lê e-mails).'],
  ['envio', 'Enviar e-mails', 'Envio de mensagens pela conta (assistente/MCP).'],
  ['notificacoes', 'Notificações do portal', 'Mensagens padronizadas do portal por e-mail (exige conta de serviço).'],
  ['contatos', 'Contatos', 'Consulta de contatos do Zimbra.'],
  ['tarefas', 'Tarefas', 'Consulta de listas e tarefas.'],
  ['arquivos', 'Arquivos (Briefcase)', 'Listar e baixar arquivos da pasta Briefcase.'],
];

/** Configurações › Integrações: conexão com o serviço Zimbra e a configuração do próprio serviço, sem sair do portal. */
export function Integracoes({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('cfg.integracoes.editar');
  const [sit, setSit] = useState<Situacao | null>(null);
  const [falha, setFalha] = useState('');
  const [aviso, setAviso] = useState('');
  const [conexao, setConexao] = useState({ url: '', token: '', agenda: '' });
  const [conta, setConta] = useState({ host: '', user: '', senha: '', smtp_host: '', smtp_port: '465' });
  const [outros, setOutros] = useState(false);
  const [servicos, setServicos] = useState<Record<string, boolean>>({});
  const [agendas, setAgendas] = useState<Agenda[] | null>(null);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState('');
  const [teste, setTeste] = useState<string>('');

  const carregar = useCallback(async () => {
    try {
      const s = await api<Situacao>('/api/integracoes/zimbra');
      setSit(s); setFalha('');
      setConexao((c) => ({ ...c, url: s.url || 'http://127.0.0.1:8765', token: '', agenda: s.agenda_destino }));
      const cfg = s.servico.config;
      if (cfg) {
        setConta((c) => ({ ...c, host: cfg.host, user: cfg.user, senha: '', smtp_host: cfg.smtp_host, smtp_port: String(cfg.smtp_port || 465) }));
        setServicos(cfg.servicos); setOutros(!!cfg.permitir_outros_dominios);
        if (cfg.servicos.agenda) {
          api<Agenda[]>('/api/integracoes/zimbra/agendas').then((a) => { setAgendas(a); setEscolhidas(new Set(a.filter((x) => x.selecionada).map((x) => x.id))); }).catch(() => setAgendas(null));
        } else setAgendas(null);
      }
    } catch (e) { setFalha((e as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (nome: string, f: () => Promise<void>) => {
    setOcupado(nome); setFalha(''); setAviso('');
    try { await f(); } catch (e) { setFalha((e as Error).message); } finally { setOcupado(''); }
  };

  const salvarConexao = (e: FormEvent) => { e.preventDefault(); void executar('conexao', async () => {
    await api('/api/integracoes/zimbra', { url: conexao.url, token: conexao.token || undefined, agenda: conexao.agenda }, 'PUT');
    setAviso('Conexão salva.'); await carregar();
  }); };
  const desconectar = async () => { if (!(await confirmar({ titulo: 'Desconectar', mensagem: 'Desconectar o portal do serviço Zimbra? O calendário deixa de mostrar datas até reconectar.', confirmar: 'Desconectar', perigo: true }))) return; void executar('conexao', async () => {
    await api('/api/integracoes/zimbra', { desconectar: true }, 'PUT'); setAviso('Desconectado.'); await carregar();
  }); };
  const salvarServico = (e: FormEvent) => { e.preventDefault(); void executar('servico', async () => {
    const corpo: Record<string, unknown> = { provedor: 'zimbra', permitir_outros_dominios: outros, host: conta.host, user: conta.user, smtp_host: conta.smtp_host, smtp_port: Number(conta.smtp_port) || undefined, servicos };
    if (conta.senha) corpo.senha = conta.senha;
    if (agendas) corpo.agendas = [...escolhidas];
    await api('/api/integracoes/zimbra/config', corpo, 'PUT');
    setAviso('Configuração do serviço salva. Já vale para o portal.'); await carregar();
  }); };
  const testar = () => void executar('teste', async () => {
    setTeste('Testando… (pode levar alguns segundos)');
    try {
      const r = await api<{ pessoal?: { ok?: boolean; erro?: string }; servico?: { ok?: boolean; erro?: string } }>('/api/integracoes/zimbra/testar', {});
      const linha = (n: string, v?: { ok?: boolean; erro?: string }) => (v ? `${n}: ${v.ok ? 'login OK' : `falhou — ${v.erro ?? 'sem detalhe'}`}` : '');
      setTeste([linha('Conta do Zimbra', r.pessoal), linha('Conta de serviço', r.servico)].filter(Boolean).join(' · ') || 'Conexão OK.');
    } catch (e) { setTeste(''); throw e; }
  });

  if (!sit && !falha) return <p className="vazio">Carregando…</p>;
  const online = !!sit?.servico.alcancavel;
  const cfg = sit?.servico.config;

  return (
    <section className="crud integracoes">
      <DicaAba>
        O portal usa o serviço <b>Zimbra</b> (pasta <code>MCP/zimbra-mcp</code>) para o <b>calendário de datas importantes</b>. Aqui você liga o portal ao serviço e configura a conta do Zimbra, sem abrir outra página.
        Senhas e token ficam guardados no servidor e nunca voltam para o navegador.
      </DicaAba>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {falha && <p className="erro" role="alert">{falha}</p>}

      <form className="cartao-sec int-bloco" onSubmit={salvarConexao}>
        <h3>1. Conexão do portal com o serviço
          {' '}{online ? <Selo texto="Serviço respondendo" tom="ok" /> : <Selo texto={sit?.token_salvo || sit?.origem ? 'Sem resposta do serviço' : 'Não conectado'} tom={sit?.origem ? 'erro' : 'neutro'} />}
        </h3>
        {!online && sit?.servico.erro && <p className="suave">{sit.servico.erro}</p>}
        <div className="grade2">
          <label>Endereço do serviço
            <input value={conexao.url} onChange={(e) => setConexao({ ...conexao, url: e.target.value })} placeholder="http://127.0.0.1:8765" disabled={!edita} />
            <small className="suave">Onde o serviço está rodando (mesma máquina do portal: http://127.0.0.1:8765).</small></label>
          <label>Token do serviço
            <input type="password" autoComplete="off" value={conexao.token} onChange={(e) => setConexao({ ...conexao, token: e.target.value })} placeholder={sit?.token_salvo ? '•••••••• (já salvo — deixe em branco para manter)' : 'Cole o token do serviço'} disabled={!edita} />
            <small className="suave">Aparece no console do serviço ao iniciar (ou em <code>config.json</code>, campo <code>token</code>).</small></label>
          <label className="cheia">Agenda onde as datas importantes são lidas e criadas
            {agendas
              ? <select value={conexao.agenda} onChange={(e) => setConexao({ ...conexao, agenda: e.target.value })} disabled={!edita}>
                  <option value="">Escolha uma agenda… (enquanto vazio, o calendário não mostra nada)</option>
                  {agendas.map((a) => <option key={a.id} value={a.nome}>{a.nome}</option>)}
                </select>
              : <input value={conexao.agenda} onChange={(e) => setConexao({ ...conexao, agenda: e.target.value })} placeholder="Nome (ou parte do nome) da agenda da empresa" disabled={!edita} />}
            <small className="suave">Escolha uma agenda da empresa (não use agendas pessoais ou de salas): só os eventos dela aparecem para todos no calendário, e as novas datas são criadas nela.</small></label>
        </div>
        {edita && <div className="barra">
          <button className="btn" disabled={ocupado !== ''}>{ocupado === 'conexao' ? 'Salvando…' : 'Salvar conexão'}</button>
          {(sit?.token_salvo) && <button type="button" className="btn btn-sec" onClick={desconectar} disabled={ocupado !== ''}>Desconectar</button>}
          <button type="button" className="btn btn-sec" onClick={testar} disabled={ocupado !== '' || !online}>Testar login no Zimbra</button>
        </div>}
        {teste && <p className="suave" role="status">{teste}</p>}
        {sit?.origem === 'ambiente' && <p className="suave">Conexão vinda das variáveis de ambiente do servidor (ZIMBRA_API_URL/TOKEN). Salvar aqui passa a valer no lugar delas.</p>}
      </form>

      {online && cfg && (
        <form className="int-form" onSubmit={salvarServico}>
          <div className="cartao-sec int-bloco">
          <h3>2. Conta Zimbra principal</h3>
          <div className="grade2">
            <label>Servidor (host)<input value={conta.host} onChange={(e) => setConta({ ...conta, host: e.target.value })} required disabled={!edita} placeholder="webmail.suaempresa.com.br" /></label>
            <label>E-mail da conta<input type="email" value={conta.user} onChange={(e) => setConta({ ...conta, user: e.target.value })} required disabled={!edita} /></label>
            <label>Senha da conta
              <input type="password" autoComplete="new-password" value={conta.senha} onChange={(e) => setConta({ ...conta, senha: e.target.value })} disabled={!edita}
                placeholder={cfg.senha_salva ? '•••••••• (já salva — deixe em branco para manter)' : 'Digite a senha'} />
              <small className="suave">Guardada no Gerenciador de Credenciais do Windows, no servidor do serviço.</small></label>
            <label>SMTP (envio) — opcional
              <span className="linha-smtp"><input value={conta.smtp_host} onChange={(e) => setConta({ ...conta, smtp_host: e.target.value })} placeholder="igual ao servidor" disabled={!edita} />
                <input className="curto" value={conta.smtp_port} onChange={(e) => setConta({ ...conta, smtp_port: e.target.value.replace(/\D/g, '') })} disabled={!edita} aria-label="Porta SMTP" /></span></label>
          </div>
          </div>
          <div className="cartao-sec int-bloco int-funcoes">
          <h3>Funções da conta Zimbra principal</h3>
          <div className="int-duas">
          <fieldset className="int-servicos int-cols2">
            <legend>O que o portal e o assistente podem usar</legend>
            {SERVICOS.map(([chave, nome, desc]) => (
              <label key={chave} className="perm-check int-servico" title={desc}>
                <input type="checkbox" checked={!!servicos[chave]} disabled={!edita}
                  onChange={(e) => setServicos({ ...servicos, [chave]: e.target.checked, ...(chave === 'agenda' && !e.target.checked ? { agenda_escrita: false } : {}), ...(chave === 'agenda_escrita' && e.target.checked ? { agenda: true } : {}) })} />
                <span><b>{nome}</b></span>
              </label>
            ))}
          </fieldset>
          {servicos.agenda && (
            <fieldset className="int-servicos int-cols2">
              <legend>Agendas do Zimbra usadas no calendário</legend>
              {agendas === null ? <p className="suave">Salve com “Agenda” ligada para listar as agendas.</p>
                : agendas.length === 0 ? <p className="suave">Nenhuma agenda encontrada.</p>
                : agendas.map((a) => (
                  <label key={a.id} className="perm-check">
                    <input type="checkbox" disabled={!edita} checked={escolhidas.has(a.id)}
                      onChange={() => { const s = new Set(escolhidas); if (s.has(a.id)) s.delete(a.id); else s.add(a.id); setEscolhidas(s); }} />
                    <span>{a.nome}</span>
                  </label>
                ))}
              <small className="suave">Sem nenhuma marcada, o serviço usa todas as agendas da conta.</small>
            </fieldset>
          )}
          </div>
          <label className="perm-check int-servico int-outros">
            <input type="checkbox" checked={outros} disabled={!edita} onChange={(e) => setOutros(e.target.checked)} />
            <span><b>Permitir avisos para outros domínios (vale para todas as contas)</b><small className="suave">Desligado: só e-mails do domínio da empresa recebem avisos. Ligado: qualquer endereço válido (ex.: gmail.com) pode receber.</small></span>
          </label>
          {edita && <div className="barra"><button className="btn" disabled={ocupado !== ''}>{ocupado === 'servico' ? 'Salvando…' : 'Salvar conta Zimbra e funções'}</button></div>}
          </div>
        </form>
      )}
      {online && cfg && <ContasEmail edita={edita} />}
      <AvisosEmail permissoes={permissoes} />
      {!online && sit?.origem && (
        <p className="suave">Para ligar o serviço: abra a pasta <code>MCP/zimbra-mcp</code> e rode <code>.venv\Scripts\python zimbra_web.py</code>. Depois volte aqui e clique em “Salvar conexão”.</p>
      )}
    </section>
  );
}
