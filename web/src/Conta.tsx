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

/** Janela "Minha conta": dados do usuário, avatar (guardado neste navegador), troca de senha e sair. */
export function JanelaConta({ usuario, avatar, mudarAvatar, sair, fechar }: {
  usuario: Usuario; avatar: number | null; mudarAvatar: (a: number | null) => void; sair: () => void; fechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [trocando, setTrocando] = useState(false);
  const [feito, setFeito] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog className="janela" ref={ref} onClose={fechar} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-label="Minha conta">
      <div className="janela-form">
        <header><h2>Minha conta</h2><button type="button" className="fechar" aria-label="Fechar" onClick={() => ref.current?.close()}>×</button></header>
        <div className="janela-corpo">
          <div className="conta-dados">
            <Avatar nome={usuario.nome} avatar={avatar} tamanho={48} />
            <div><b>{usuario.nome}</b><br /><span className="suave">{usuario.login} · {usuario.perfil_nome}</span></div>
          </div>
          <p className="suave" style={{ margin: '12px 0 6px', fontWeight: 700, fontSize: 13 }}>Avatar</p>
          <div className="avgal">
            <button type="button" className={`avopt${avatar === null ? ' on' : ''}`} aria-label="Usar as iniciais" onClick={() => mudarAvatar(null)}><Avatar nome={usuario.nome} avatar={null} tamanho={44} /></button>
            {Array.from({ length: AVATARES_QTD }, (_, i) => (
              <button type="button" key={i} className={`avopt${avatar === i ? ' on' : ''}`} aria-label={`Avatar ${i + 1}`} aria-pressed={avatar === i} onClick={() => mudarAvatar(i)}><Avatar nome={usuario.nome} avatar={i} tamanho={44} /></button>
            ))}
          </div>
          <hr className="divisor" />
          {feito && <p className="ok" role="status">Senha alterada.</p>}
          {!trocando ? <button className="btn btn-sec" onClick={() => { setTrocando(true); setFeito(false); }}>Trocar senha</button>
            : <FormTrocarSenha aoConcluir={() => { setTrocando(false); setFeito(true); }} />}
        </div>
        <footer><button className="btn btn-sec" onClick={sair}>Sair da conta</button><button className="btn" onClick={() => ref.current?.close()}>Fechar</button></footer>
      </div>
    </dialog>
  );
}
