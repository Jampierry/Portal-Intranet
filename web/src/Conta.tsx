import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { Avatar, AVATARES_QTD } from './perfil';
import type { Usuario } from './sessao';

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
function AvisosEmailPessoa() {
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

/** Instalação do portal como aplicativo (PWA): o navegador avisa quando dá para instalar; guardamos o aviso para o botão do menu. */
interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let instalador: EventoInstalar | null = null;
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); instalador = e as EventoInstalar; });
  addEventListener('appinstalled', () => { instalador = null; });
}
const emApp = () => typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;

/** Menu da conta (abre ao clicar no avatar, igual ao menu de aparência): dados, avatar, avisos por e-mail, senha, instalar o portal e sair. */
export function MenuConta({ usuario, avatar, mudarAvatar, sair }: { usuario: Usuario; avatar: number | null; mudarAvatar: (a: number | null) => void; sair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [feito, setFeito] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  useEffect(() => { if (!aberto) { setTrocando(false); setFeito(false); } }, [aberto]);
  const instalar = async () => { if (!instalador) return; await instalador.prompt(); await instalador.userChoice.catch(() => null); instalador = null; setAberto(false); };
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
          <h3>Avatar</h3>
          <div className="avgal">
            <button type="button" className={`avopt${avatar === null ? ' on' : ''}`} aria-label="Usar as iniciais" onClick={() => mudarAvatar(null)}><Avatar nome={usuario.nome} avatar={null} tamanho={32} /></button>
            {Array.from({ length: AVATARES_QTD }, (_, i) => (
              <button type="button" key={i} className={`avopt${avatar === i ? ' on' : ''}`} aria-label={`Avatar ${i + 1}`} aria-pressed={avatar === i} onClick={() => mudarAvatar(i)}><Avatar nome={usuario.nome} avatar={i} tamanho={32} /></button>
            ))}
          </div>
          <AvisosEmailPessoa />
          <h3>Segurança</h3>
          {feito && <p className="ok" role="status" style={{ margin: '0 0 8px' }}>Senha alterada.</p>}
          {!trocando ? <button className="btn btn-sec btn-pequeno" onClick={() => { setTrocando(true); setFeito(false); }}>Trocar senha</button>
            : <FormTrocarSenha aoConcluir={() => { setTrocando(false); setFeito(true); }} />}
          {instalador && !emApp() && <><h3>Aplicativo</h3><button className="btn btn-sec btn-pequeno" onClick={() => void instalar()}>Instalar o portal neste dispositivo</button></>}
        </div>
      )}
    </div>
  );
}
