import { useState, type FormEvent, type ReactNode } from 'react';
import { Icone, IconeSistema } from './icones';
import { Lema } from './Capa';
import { FormTrocarSenha } from './Conta';

function Moldura({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <main className="entrar">
      <section className="entrar-marca" aria-hidden="true">
        <div className="entrar-logo"><IconeSistema tamanho={34} /><span>Di Paula</span></div>
        <div><Lema linhas={['PESSOAS', 'PROCESSOS', 'RESULTADOS']} /><small>MODA EM MOVIMENTO</small></div>
      </section>
      <section className="entrar-form">
        <h1>{titulo}</h1>
        <p className="suave">{sub}</p>
        {children}
        <small className="suave entrar-rodape">Intranet Di Paula · Conteúdo de demonstração</small>
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

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try { await entrar(login.trim(), senha); }
    catch (x) { setErro((x as Error).message); setSenha(''); }
    finally { setEnviando(false); }
  };

  return (
    <Moldura titulo="Entrar no portal" sub="Use o login e a senha que o administrador criou para você.">
      <form onSubmit={enviar} className="entrar-campos">
        <label>Login<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus /></label>
        <label>Senha
          <span className="campo-senha">
            <input type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="icone-btn" aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={ver} onClick={() => setVer(!ver)}><Icone nome={ver ? 'olho-off' : 'olho'} tamanho={15} /></button>
          </span>
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn btn-pri entrar-botao" disabled={enviando || !login || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <small className="suave">Esqueceu a senha? Peça ao administrador para redefinir.</small>
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
