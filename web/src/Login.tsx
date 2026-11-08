import { useState, type FormEvent, type ReactNode } from 'react';
import { Icone } from './icones';
import { MarcaEntrada, useEntrada } from './MarcaEntrada';
import { useEmpresa } from './empresa';
import { FormTrocarSenha } from './Conta';

function Moldura({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  const entrada = useEntrada();
  const empresa = useEmpresa();
  return (
    <main className="entrar">
      <MarcaEntrada cfg={entrada} />
      <section className="entrar-form">
        <div className="entrar-card">
          <small className="entrar-eyebrow">{empresa.nome_portal}</small>
          <h1>{titulo}</h1>
          <p className="suave">{sub}</p>
          {children}
        </div>
        <small className="suave entrar-rodape">{empresa.nome}</small>
      </section>
    </main>
  );
}

export function Login({ entrar }: { entrar: (login: string, senha: string) => Promise<void> }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<'' | 'enviando' | 'enviado'>('');
  const [erroPedido, setErroPedido] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try { await entrar(login.trim(), senha); }
    catch (x) { setErro((x as Error).message); setSenha(''); }
    finally { setEnviando(false); }
  };

  const pedirSenha = async () => {
    setErroPedido('');
    if (!login.trim()) { setErroPedido('Digite o seu login no campo acima e clique de novo em “Esqueci minha senha”.'); return; }
    setPedido('enviando');
    try {
      const r = await fetch('/api/esqueci-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: login.trim() }), credentials: 'same-origin' });
      const j = await r.json().catch(() => ({})) as { erro?: string };
      if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
      setPedido('enviado');
    } catch (x) { setErroPedido((x as Error).message); setPedido(''); }
  };

  return (
    <Moldura titulo="Entrar no portal" sub="Use o login e a senha que o administrador criou para você.">
      <form onSubmit={enviar} className="entrar-campos">
        <label>Login
          <span className="campo-ico">
            <Icone nome="perfil" tamanho={16} />
            <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="seu.login" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
          </span>
        </label>
        <label>Senha
          <span className="campo-ico">
            <Icone nome="chave" tamanho={16} />
            <input type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" autoComplete="current-password" required />
            <button type="button" className="icone-btn" aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={ver} onClick={() => setVer(!ver)}><Icone nome={ver ? 'olho-off' : 'olho'} tamanho={16} /></button>
          </span>
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn btn-pri entrar-botao" disabled={enviando || !login || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <div className="entrar-esqueci">
          {pedido === 'enviado'
            ? <p className="ok" role="status">Pedido enviado. O administrador foi avisado e vai passar uma senha provisória para você.</p>
            : <><button type="button" className="entrar-link" disabled={pedido === 'enviando'} onClick={() => void pedirSenha()}>{pedido === 'enviando' ? 'Enviando…' : 'Esqueci minha senha'}</button>
              <small className="suave">O administrador recebe um aviso para redefinir.</small></>}
          {erroPedido && <p className="erro" role="alert">{erroPedido}</p>}
        </div>
      </form>
    </Moldura>
  );
}

/** Primeiro acesso ou senha redefinida: o portal só libera depois da troca. */
export function TrocaObrigatoria({ nome, aoConcluir, sair }: { nome: string; aoConcluir: () => void; sair: () => void }) {
  return (
    <Moldura titulo="Crie sua senha" sub={`Olá, ${nome}. A senha que você recebeu é provisória: escolha uma só sua para continuar.`}>
      <FormTrocarSenha aoConcluir={aoConcluir} />
      <button className="btn btn-sec" onClick={sair}>Sair</button>
    </Moldura>
  );
}
