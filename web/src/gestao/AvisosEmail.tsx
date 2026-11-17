import { useEffect, useState } from 'react';
import { api } from '../api';

interface Cfg { ativo: boolean; so_urgentes: boolean; url_portal: string; destinatarios: number; conectado: boolean; origem: 'proprio' | 'caldav' | 'ambiente' | 'zimbra' | null }
interface Smtp { host: string; porta: string; usuario: string; senha_salva: boolean; remetente: string; origem: string | null; efetivo: { host: string; porta: number; usuario: string; remetente: string } | null }

/** Configurações › Integrações: aviso de novos comunicados por e-mail (enviado por SMTP pelo próprio portal, usando a conta do CalDAV ou outra). */
export function AvisosEmail({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('cfg.integracoes.editar');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [senha, setSenha] = useState('');
  useEffect(() => { api<Cfg>('/api/integracoes/avisos').then(setCfg).catch((e: Error) => setErro(e.message)); api<Smtp>('/api/integracoes/smtp').then(setSmtp).catch(() => setSmtp(null)); }, []);
  if (!cfg) return erro ? <p className="erro" role="alert">{erro}</p> : null;
  const salvar = async () => {
    setErro(''); setAviso(''); setOcupado(true);
    try { setCfg(await api<Cfg>('/api/integracoes/avisos', { ativo: cfg.ativo, so_urgentes: cfg.so_urgentes, url_portal: cfg.url_portal }, 'PUT')); setAviso('Configuração dos avisos salva.'); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const testar = async () => {
    setErro(''); setAviso(''); setOcupado(true);
    try { const r = await api<{ para: string }>('/api/integracoes/avisos/teste', {}); setAviso(`E-mail de teste enviado para ${r.para}.`); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const salvarSmtp = async (limpar = false) => {
    if (!smtp) return;
    setErro(''); setAviso(''); setOcupado(true);
    try {
      const novo = await api<Smtp>('/api/integracoes/smtp', limpar ? { limpar: true } : { host: smtp.host, porta: smtp.porta, usuario: smtp.usuario, remetente: smtp.remetente, senha: senha || undefined }, 'PUT');
      setSmtp(novo); setSenha(''); setCfg(await api<Cfg>('/api/integracoes/avisos'));
      setAviso(limpar ? 'Voltou a usar a conta do CalDAV para enviar.' : 'Servidor de envio salvo.');
    } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const testarSmtp = async () => {
    setErro(''); setAviso(''); setOcupado(true);
    try { const r = await api<{ host: string; porta: number; usuario: string }>('/api/integracoes/smtp/testar', {}); setAviso(`Conexão com o servidor de e-mail OK (${r.usuario} em ${r.host}:${r.porta}).`); }
    catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const origemTxt = cfg.origem === 'caldav' ? 'a conta do CalDAV' : cfg.origem === 'proprio' ? 'o servidor de envio abaixo' : cfg.origem === 'ambiente' ? 'as variáveis do servidor' : cfg.origem === 'zimbra' ? 'o serviço Zimbra (zimbra-mcp)' : '';
  return (
    <div className="cartao-sec int-bloco">
        <h3>4. Aviso de comunicados por e-mail</h3>
        <p className="suave" style={{ marginTop: 0 }}>Quando um comunicado é publicado pela primeira vez, quem tem e-mail cadastrado (Usuários › Editar), pode ver comunicados e não desligou os avisos em “Minha conta” recebe um e-mail padronizado enviado pelo próprio portal (SMTP). Cada comunicado avisa uma vez só, mesmo que seja editado depois.</p>
        {!cfg.conectado && <p className="erro" role="status">Ainda não há servidor de e-mail. Configure o CalDAV (a mesma conta serve para enviar) ou preencha o servidor de envio abaixo.</p>}
        {cfg.conectado && origemTxt && <p className="suave" style={{ margin: 0 }}>Enviando por: {origemTxt}{smtp?.efetivo ? ` (${smtp.efetivo.usuario} em ${smtp.efetivo.host}:${smtp.efetivo.porta})` : ''}.</p>}
        {aviso && <p className="ok" role="status">{aviso}</p>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <label className="linha"><input type="checkbox" checked={cfg.ativo} disabled={!edita} onChange={(e) => setCfg({ ...cfg, ativo: e.target.checked })} />Enviar aviso por e-mail quando um comunicado for publicado</label>
        <label className="linha"><input type="checkbox" checked={cfg.so_urgentes} disabled={!edita || !cfg.ativo} onChange={(e) => setCfg({ ...cfg, so_urgentes: e.target.checked })} />Só comunicados marcados como urgentes</label>
        <label>Endereço do portal (para o botão “Abrir no portal”)
          <input value={cfg.url_portal} disabled={!edita} onChange={(e) => setCfg({ ...cfg, url_portal: e.target.value })} placeholder="https://portal.suaempresa.com.br" maxLength={200} />
          <small className="suave">Opcional. Sem ele, o e-mail não leva botão.</small>
        </label>
        {smtp && <details open={!cfg.conectado || undefined}>
          <summary>Servidor de envio (SMTP)</summary>
          <p className="suave" style={{ margin: '6px 0' }}>Deixe em branco para usar o mesmo servidor, usuário e senha do CalDAV. Preencha só se a TI indicar outra conta para enviar e-mails.</p>
          <div className="grade2">
            <label>Servidor<input value={smtp.host} disabled={!edita} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder={smtp.efetivo?.host ?? 'correio.suaempresa.com.br'} /></label>
            <label>Porta<input value={smtp.porta} disabled={!edita} inputMode="numeric" onChange={(e) => setSmtp({ ...smtp, porta: e.target.value.replace(/D/g, '') })} placeholder="465" /><small className="suave">465 (SSL) é o padrão.</small></label>
            <label>Usuário<input value={smtp.usuario} disabled={!edita} autoComplete="off" onChange={(e) => setSmtp({ ...smtp, usuario: e.target.value })} placeholder={smtp.efetivo?.usuario ?? 'conta@suaempresa.com.br'} /></label>
            <label>Senha<input type="password" value={senha} disabled={!edita} autoComplete="new-password" onChange={(e) => setSenha(e.target.value)} placeholder={smtp.senha_salva ? '•••••••• (já salva — deixe em branco para manter)' : 'igual à do CalDAV'} /></label>
            <label>Remetente (De)<input value={smtp.remetente} disabled={!edita} onChange={(e) => setSmtp({ ...smtp, remetente: e.target.value })} placeholder={smtp.efetivo?.remetente ?? 'avisos@suaempresa.com.br'} /></label>
          </div>
          {edita && <div className="btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void salvarSmtp()}>Salvar servidor</button>
            <button type="button" className="btn btn-sec" disabled={ocupado || !cfg.conectado} onClick={() => void testarSmtp()}>Testar conexão</button>
            {(smtp.host || smtp.usuario || smtp.senha_salva) && <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => void salvarSmtp(true)}>Voltar ao CalDAV</button>}
          </div>}
        </details>}
        <p className="suave" style={{ margin: 0 }}>{cfg.destinatarios} pessoa{cfg.destinatarios === 1 ? '' : 's'} receberiam hoje.</p>
        {edita && <div className="btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={ocupado} onClick={() => void salvar()}>Salvar</button>
          <button className="btn btn-sec" disabled={ocupado || !cfg.conectado} onClick={() => void testar()}>Enviar e-mail de teste para mim</button>
        </div>}
    </div>
  );
}
