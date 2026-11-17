import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { confirmar } from '../Confirmar.tsx';
import { api } from '../api';
import { Selo } from './Crud';

interface Estado { url: string; usuario: string; senha_salva: boolean; agenda: string; origem: 'banco' | 'ambiente' | null }

/** Configurações › Integrações › Agenda por CalDAV: o portal lê (e cria/exclui datas) direto no servidor de agenda, sem o serviço Zimbra. */
export function CalDav({ edita }: { edita: boolean }) {
  const [est, setEst] = useState<Estado | null>(null);
  const [f, setF] = useState({ url: '', usuario: '', senha: '', agenda: '' });
  const [agendas, setAgendas] = useState<string[] | null>(null);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  const [ocupado, setOcupado] = useState('');

  const carregar = useCallback(async () => {
    try {
      const e = await api<Estado>('/api/integracoes/caldav');
      setEst(e); setF({ url: e.url, usuario: e.usuario, senha: '', agenda: e.agenda });
    } catch (x) { setFalha((x as Error).message); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = async (nome: string, fn: () => Promise<void>) => {
    setOcupado(nome); setFalha(''); setAviso('');
    try { await fn(); } catch (x) { setFalha((x as Error).message); } finally { setOcupado(''); }
  };
  const testar = async () => {
    const r = await api<{ ok: boolean; agendas: string[] }>('/api/integracoes/caldav/testar', {});
    setAgendas(r.agendas);
    setAviso(r.agendas.length ? `Conexão OK: ${r.agendas.length} agenda(s) encontrada(s). Escolha a da empresa abaixo e salve.` : 'Conexão OK, mas nenhuma agenda de eventos foi encontrada nesta conta.');
  };
  const salvar = (e: FormEvent) => { e.preventDefault(); void executar('salvar', async () => {
    await api('/api/integracoes/caldav', { url: f.url, usuario: f.usuario, senha: f.senha || undefined, agenda: f.agenda }, 'PUT');
    await carregar(); setAviso('Salvo. Testando a conexão…'); await testar();
  }); };
  const desconectar = async () => {
    if (!(await confirmar({ titulo: 'Desconectar', mensagem: 'Desconectar o portal da agenda CalDAV? O calendário deixa de mostrar os eventos dela até reconectar.', confirmar: 'Desconectar', perigo: true }))) return;
    void executar('desconectar', async () => { await api('/api/integracoes/caldav', { desconectar: true }, 'PUT'); setAgendas(null); await carregar(); setAviso('Desconectado.'); });
  };

  if (!est && !falha) return null;
  const conectado = !!est?.origem;
  return (
    <form className="cartao-sec int-bloco" onSubmit={salvar}>
      <h3>Agenda por CalDAV (direto do portal) {conectado ? <Selo texto="Configurada" tom="ok" /> : <Selo texto="Não configurada" tom="neutro" />}</h3>
      <p className="suave">Liga o calendário do portal ao servidor de agenda sem precisar do serviço Zimbra abaixo. Quando preenchida, tem prioridade sobre ele. No Zimbra o endereço é <code>https://servidor/dav/conta@empresa.com.br/</code>.</p>
      {aviso && <p className="ok" role="status">{aviso}</p>}
      {falha && <p className="erro" role="alert">{falha}</p>}
      <div className="grade2">
        <label className="cheia">Endereço do CalDAV
          <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://webmail.suaempresa.com.br/dav/agenda@suaempresa.com.br/" disabled={!edita} /></label>
        <label>Usuário
          <input value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} autoComplete="off" placeholder="agenda@suaempresa.com.br" disabled={!edita} /></label>
        <label>Senha
          <input type="password" autoComplete="new-password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} disabled={!edita}
            placeholder={est?.senha_salva ? '•••••••• (já salva — deixe em branco para manter)' : 'Senha da conta'} />
          <small className="suave">Use uma conta própria da empresa para o portal. A senha fica só no servidor e nunca volta para o navegador.</small></label>
        <label className="cheia">Agenda da empresa
          {agendas
            ? <select value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} disabled={!edita}>
                <option value="">Escolha uma agenda… (enquanto vazio, o calendário não mostra nada)</option>
                {[...new Set([...(f.agenda ? [f.agenda] : []), ...agendas])].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            : <input value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} placeholder="Clique em “Testar” para listar, ou digite o nome (ex.: Calendar)" disabled={!edita} />}
          <small className="suave">Só os eventos dela aparecem para todos, e as datas novas são criadas nela. Evite agendas pessoais.</small></label>
      </div>
      {edita && <div className="barra">
        <button className="btn" disabled={ocupado !== ''}>{ocupado === 'salvar' ? 'Salvando…' : 'Salvar e testar'}</button>
        <button type="button" className="btn btn-sec" disabled={ocupado !== '' || !conectado} onClick={() => void executar('testar', testar)}>{ocupado === 'testar' ? 'Testando…' : 'Testar conexão'}</button>
        {conectado && est?.origem === 'banco' && <button type="button" className="btn btn-sec" disabled={ocupado !== ''} onClick={desconectar}>Desconectar</button>}
      </div>}
      {est?.origem === 'ambiente' && <p className="suave">Conexão vinda das variáveis de ambiente do servidor (CALDAV_URL, CALDAV_USUARIO, CALDAV_SENHA). Salvar aqui passa a valer no lugar delas.</p>}
    </form>
  );
}
