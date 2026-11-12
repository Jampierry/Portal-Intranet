import { Icone } from './icones';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { Avatar, AVATARES_QTD } from './perfil';
import type { Usuario } from './sessao';
import { ativarPush, desativarPush, pushAtivo, pushSuportado } from './push';

/** Troca de senha (usada na janela "Minha conta" e na tela de primeiro acesso). */
export function FormTrocarSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repete, setRepete] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (nova !== repete) return setErro('A confirmação não é igual à nova senha.');
    setErro(''); setEnviando(true);
    try { await api('/api/eu/senha', { atual, nova }); aoConcluir(); }
    catch (x) { setErro((x as Error).message); }
    finally { setEnviando(false); }
  };
  return (
    <form onSubmit={enviar} className="entrar-campos">
      <label>Senha atual<input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required /></label>
      <label>Nova senha<input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" minLength={8} required /><small className="suave">Mínimo de 8 caracteres.</small></label>
      <label>Repita a nova senha<input type="password" value={repete} onChange={(e) => setRepete(e.target.value)} autoComplete="new-password" required /></label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="btn btn-pri" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
    </form>
  );
}

/** Preferência dos avisos de comunicados por e-mail (só aparece com e-mail cadastrado pelo administrador). */
export function AvisosEmailPessoa() {
  const [d, setD] = useState<{ email: string | null; avisos_email: number } | null>(null);
  useEffect(() => { api<{ email: string | null; avisos_email: number }>('/api/eu/avisos').then(setD).catch(() => setD(null)); }, []);
  if (!d) return null;
  if (!d.email) return <p className="suave" style={{ fontSize: 13 }}>Avisos por e-mail: nenhum e-mail cadastrado para você. Peça ao administrador.</p>;
  return (
    <label className="linha" style={{ marginTop: 8 }}>
      <input type="checkbox" checked={!!d.avisos_email} onChange={async (e) => setD(await api('/api/eu/avisos', { avisos_email: e.target.checked }, 'PUT'))} />
      Receber avisos de comunicados no e-mail <b>{d.email}</b>
    </label>
  );
}

/** Avisos push neste aparelho: liga/desliga e manda um aviso de teste. */
export function AvisosPush() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { void pushAtivo().then(setAtivo).catch(() => setAtivo(false)); }, []);
  if (!pushSuportado()) return <p className="suave" style={{ fontSize: 13 }}>Avisos no aparelho: este navegador não permite (precisa de HTTPS; no iPhone, instale o portal na tela inicial).</p>;
  if (ativo === null) return null;
  const mudar = async (ligar: boolean) => {
    setOcupado(true); setMsg('');
    try {
      if (ligar) { await ativarPush(); await api('/api/push/teste', {}); setMsg('Avisos ativados neste aparelho. Enviamos um aviso de teste.'); } else { await desativarPush(); setMsg('Avisos desligados neste aparelho.'); }
      setAtivo(await pushAtivo());
    } catch (e) { setMsg((e as Error).message); } finally { setOcupado(false); }
  };
  return (
    <div style={{ marginTop: 8 }}>
      <label className="linha"><input type="checkbox" checked={ativo} disabled={ocupado} onChange={(e) => void mudar(e.target.checked)} /> Receber avisos do portal neste aparelho (comunicados, pesquisas, pedidos)</label>
      {msg && <p className="suave" role="status" style={{ fontSize: 13, margin: '4px 0 0' }}>{msg}</p>}
    </div>
  );
}

/** Instalação do portal como aplicativo (PWA): o navegador avisa quando dá para instalar; guardamos o aviso para o botão do menu. */
interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let instalador: EventoInstalar | null = null;
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalador = e as EventoInstalar; });
  addEventListener('appinstalled', () => { instalador = null; try { localStorage.setItem('portal.app.instalado', '1'); } catch { /* sem armazenamento */ } });
}
const lerFlag = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
export const instalarDisponivel = () => !!instalador && !emApp();
/** Mostra o convite até a pessoa instalar o portal ou dizer que não quer. */
export const conviteInstalar = () => !emApp() && !lerFlag('portal.app.instalado') && !lerFlag('portal.app.dispensado');
export async function instalarPortal() { if (!instalador) return; await instalador.prompt(); await instalador.userChoice.catch(() => null); instalador = null; }
const emApp = () => typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;

/** Convite para instalar o portal: fica no menu até instalar ou marcar 'não quero'. Sem o aviso do navegador (ex.: sem HTTPS, iPhone), explica o caminho manual. */
function ConviteInstalar({ aoInstalar }: { aoInstalar: () => void }) {
  const [, forcar] = useState(0);
  if (!conviteInstalar()) return null;
  const dispensar = () => { try { localStorage.setItem('portal.app.dispensado', '1'); } catch { /* vale só nesta sessão */ } forcar((n) => n + 1); };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <>
      <h3>Aplicativo</h3>
      <div className="conta-convite">
      {instalarDisponivel()
        ? <button className="btn btn-sec btn-pequeno" onClick={() => void instalarPortal().then(() => { forcar((n) => n + 1); aoInstalar(); })}>Instalar o portal neste dispositivo</button>
        : <p className="suave" style={{ fontSize: 13, margin: "0 0 6px" }}>{ios ? 'Para instalar: toque em Compartilhar e depois em Adicionar à Tela de Início.' : 'Para instalar: no menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial (precisa de HTTPS).'}</p>}
      <button type="button" className="btn btn-sec btn-pequeno" style={{ marginTop: 6 }} onClick={dispensar}>Não quero instalar</button>
      </div>
    </>
  );
}

/** Menu da conta (abre ao clicar no avatar): dados, botão Meu perfil, avatar, avisos, senha, instalar o portal e sair. */
export function MenuConta({ usuario, avatar, mudarAvatar, abrirPerfil, sair }: { usuario: Usuario; avatar: number | null; mudarAvatar: (a: number | null) => void; abrirPerfil: () => void; sair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [avAberto, setAvAberto] = useState(() => { try { return localStorage.getItem('portal.conta.avatares') === 'aberto'; } catch { return false; } });
  const alternarAv = () => setAvAberto((v) => { try { localStorage.setItem('portal.conta.avatares', v ? 'fechado' : 'aberto'); } catch { /* só nesta sessão */ } return !v; });
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  useEffect(() => { if (!aberto) { setTrocando(false); setFeito(false); } }, [aberto]);
  return (
    <div className="tema-raiz" ref={raiz}>
      <button className="avbtn" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-haspopup="dialog" aria-label="Minha conta" title={`${usuario.nome} — minha conta`}>
        <Avatar nome={usuario.nome} avatar={avatar} tamanho={28} />
      </button>
      {aberto && (
        <div className="tema-painel conta-painel" role="dialog" aria-label="Minha conta">
          <div className="conta-topo">
            <Avatar nome={usuario.nome} avatar={avatar} tamanho={44} />
            <div className="conta-quem"><b>{usuario.nome}</b><small className="suave">{usuario.login} · {usuario.perfil_nome}</small></div>
            <button className="icone-btn conta-sair" onClick={sair} aria-label="Sair do sistema" title="Sair do sistema">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            </button>
          </div>
          <button type="button" className="btn btn-pri conta-perfil-btn" onClick={() => { setAberto(false); abrirPerfil(); }}>Meu perfil</button>
          <h3 className="conta-recolher"><button type="button" aria-expanded={avAberto} aria-controls="conta-avatares" onClick={alternarAv}><Icone nome="dir" tamanho={14} classe="recolher-seta" />Avatar<span className="recolher-dica">{avAberto ? 'Ocultar' : 'Mostrar'}</span></button></h3>
          <div className="avgal" id="conta-avatares" hidden={!avAberto}>
            <button type="button" className={`avopt${avatar === null ? ' on' : ''}`} aria-label="Usar as iniciais" onClick={() => mudarAvatar(null)}><Avatar nome={usuario.nome} avatar={null} tamanho={32} /></button>
            {Array.from({ length: AVATARES_QTD }, (_, i) => (
              <button type="button" key={i} className={`avopt${avatar === i ? ' on' : ''}`} aria-label={`Avatar ${i + 1}`} aria-pressed={avatar === i} onClick={() => mudarAvatar(i)}><Avatar nome={usuario.nome} avatar={i} tamanho={32} /></button>
            ))}
          </div>
          <h3>Segurança</h3>
          {feito && <p className="ok" role="status" style={{ margin: '0 0 8px' }}>Senha alterada.</p>}
          {!trocando ? <button className="btn btn-sec btn-pequeno" onClick={() => { setTrocando(true); setFeito(false); }}>Trocar senha</button>
            : <FormTrocarSenha aoConcluir={() => { setTrocando(false); setFeito(true); }} />}
          <ConviteInstalar aoInstalar={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}

