import { useEffect, useState } from 'react';
import { api } from '../api';

interface Cfg { ativo: boolean; so_urgentes: boolean; url_portal: string; destinatarios: number; conectado: boolean }

/** Configurações › Integrações: aviso de novos comunicados por e-mail (enviado pelo serviço Zimbra). */
export function AvisosEmail({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('cfg.integracoes.editar');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { api<Cfg>('/api/integracoes/avisos').then(setCfg).catch((e: Error) => setErro(e.message)); }, []);
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
  return (
    <section className="crud integracoes" style={{ marginTop: 16 }}>
      <div className="int-bloco">
        <h3>Aviso de comunicados por e-mail</h3>
        <p className="suave" style={{ marginTop: 0 }}>Quando um comunicado é publicado pela primeira vez, quem tem e-mail cadastrado (Usuários › Editar), pode ver comunicados e não desligou os avisos em “Minha conta” recebe um e-mail padronizado pelo serviço Zimbra. Cada comunicado avisa uma vez só, mesmo que seja editado depois.</p>
        {!cfg.conectado && <p className="erro" role="status">O serviço Zimbra ainda não está conectado (bloco 1 acima). Sem isso, nenhum e-mail sai.</p>}
        {aviso && <p className="ok" role="status">{aviso}</p>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <label className="linha"><input type="checkbox" checked={cfg.ativo} disabled={!edita} onChange={(e) => setCfg({ ...cfg, ativo: e.target.checked })} />Enviar aviso por e-mail quando um comunicado for publicado</label>
        <label className="linha"><input type="checkbox" checked={cfg.so_urgentes} disabled={!edita || !cfg.ativo} onChange={(e) => setCfg({ ...cfg, so_urgentes: e.target.checked })} />Só comunicados marcados como urgentes</label>
        <label>Endereço do portal (para o botão “Abrir no portal”)
          <input value={cfg.url_portal} disabled={!edita} onChange={(e) => setCfg({ ...cfg, url_portal: e.target.value })} placeholder="https://portal.suaempresa.com.br" maxLength={200} />
          <small className="suave">Opcional. Sem ele, o e-mail não leva botão.</small>
        </label>
        <p className="suave" style={{ margin: 0 }}>{cfg.destinatarios} pessoa{cfg.destinatarios === 1 ? '' : 's'} receberiam hoje.</p>
        {edita && <div className="btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={ocupado} onClick={() => void salvar()}>Salvar</button>
          <button className="btn btn-sec" disabled={ocupado || !cfg.conectado} onClick={() => void testar()}>Enviar e-mail de teste para mim</button>
        </div>}
      </div>
    </section>
  );
}
