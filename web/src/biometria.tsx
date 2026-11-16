import { useEffect, useState } from 'react';
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from './api';
import { avisar, confirmar } from './Confirmar';
import { dataCurta } from './dados';
import { Icone } from './icones';
import type { Usuario } from './sessao';

/** Digital ou rosto do aparelho: só existe em HTTPS (ou localhost) e em aparelho com biometria/PIN cadastrados. */
export async function biometriaDisponivel(): Promise<boolean> {
  try { return window.isSecureContext && browserSupportsWebAuthn() && await platformAuthenticatorIsAvailable(); } catch { return false; }
}
export function useBiometriaDisponivel(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => { let vivo = true; void biometriaDisponivel().then((v) => { if (vivo) setOk(v); }); return () => { vivo = false; }; }, []);
  return ok;
}

/** Traduz os erros do navegador (pessoa cancelou, aparelho sem biometria etc.) para uma frase clara. */
function mensagem(e: unknown, aoEntrar = false): string {
  const x = e as { name?: string; message?: string; cause?: { name?: string } } | undefined;
  const nome = x?.name;
  // O navegador responde "NotAllowedError" (em inglês) quando a pessoa cancela, demora ou não há biometria sua neste aparelho.
  if ([nome, x?.cause?.name].some((n) => n === 'NotAllowedError' || n === 'AbortError') || /timed out|not allowed/i.test(x?.message ?? '')) {
    return aoEntrar
      ? 'Não encontramos uma biometria sua neste aparelho, ou a verificação foi cancelada.'
      : 'O cadastro da biometria foi cancelado ou demorou demais. Tente de novo.';
  }
  if (nome === 'InvalidStateError') return 'Este aparelho já tem uma biometria cadastrada para você.';
  if (nome === 'NotSupportedError' || nome === 'SecurityError') return 'Este aparelho ou endereço não permite biometria. Use o login e a senha.';
  return (e as Error)?.message || 'Não foi possível usar a biometria.';
}

/** Erro da entrada por biometria; `semCadastro` = o aparelho não tem biometria sua (ou a pessoa cancelou): vale sugerir o cadastro. */
export class ErroBiometria extends Error {
  semCadastro: boolean;
  constructor(mensagem: string, semCadastro: boolean) { super(mensagem); this.semCadastro = semCadastro; }
}
const ehNaoPermitido = (e: unknown) => {
  const x = e as { name?: string; message?: string; cause?: { name?: string } } | undefined;
  return [x?.name, x?.cause?.name].some((n) => n === 'NotAllowedError' || n === 'AbortError') || /timed out|not allowed/i.test(x?.message ?? '');
};
const CHAVE_OFERTA = 'portal.oferecer-bio';

/** Nome sugerido para o aparelho no cadastro. */
function nomeDoAparelho(): string {
  return /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Celular Android' : /Mac/.test(navigator.platform) ? 'Mac' : 'Computador';
}

export async function entrarComBiometria(manter: boolean): Promise<Usuario> {
  try {
    const { opcoes, desafio_id } = await api<{ opcoes: PublicKeyCredentialRequestOptionsJSON; desafio_id: string }>('/api/biometria/entrar/opcoes', {});
    const resposta = await startAuthentication({ optionsJSON: opcoes });
    return await api<Usuario>('/api/biometria/entrar', { desafio_id, resposta, manter });
  } catch (e) {
    const sem = ehNaoPermitido(e);
    if (sem) { try { sessionStorage.setItem(CHAVE_OFERTA, '1'); } catch { /* sem armazenamento: só não oferece depois */ } }
    throw new ErroBiometria(mensagem(e, true), sem);
  }
}

/** Segunda etapa do login (a senha já foi aceita): confirma com a biometria cadastrada. */
export async function confirmarSegundoFator(ticket: string): Promise<Usuario> {
  try {
    const { opcoes, desafio_id } = await api<{ opcoes: PublicKeyCredentialRequestOptionsJSON; desafio_id: string }>('/api/biometria/segundo-fator/opcoes', { ticket });
    const resposta = await startAuthentication({ optionsJSON: opcoes });
    return await api<Usuario>('/api/biometria/segundo-fator', { ticket, desafio_id, resposta });
  } catch (e) {
    if (ehNaoPermitido(e)) throw new Error('A confirmação por biometria foi cancelada ou este aparelho não tem a sua biometria. Entre de novo; se perdeu o aparelho, peça ao administrador para desligar o segundo fator.');
    throw new Error((e as Error)?.message || 'Não foi possível confirmar a biometria.');
  }
}

export async function cadastrarBiometria(nome: string): Promise<void> {
  try {
    const { opcoes, desafio_id } = await api<{ opcoes: PublicKeyCredentialCreationOptionsJSON; desafio_id: string }>('/api/biometria/registro/opcoes', {});
    const resposta = await startRegistration({ optionsJSON: opcoes });
    await api('/api/biometria/registro', { desafio_id, resposta, nome });
  } catch (e) { throw new Error(mensagem(e)); }
}

interface Passkey { id: number; nome: string; criado_em: string; ultimo_uso: string | null }

/** Meu perfil › Acesso e segurança: cadastrar, listar e remover as biometrias da pessoa. */
export function BiometriaPessoal() {
  const disponivel = useBiometriaDisponivel();
  const [lista, setLista] = useState<Passkey[] | null>(null);
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(false);
  const [segundo, setSegundo] = useState(false);
  const [desligando, setDesligando] = useState(false);
  const [senha, setSenha] = useState('');
  const carregar = () => Promise.all([api<Passkey[]>('/api/biometria'), api<{ segundo_fator: boolean }>('/api/biometria/estado')]).then(([l, e]) => { setLista(l); setSegundo(e.segundo_fator); }).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  const ligar = async () => {
    setErro(''); setMsg('');
    try { await api('/api/biometria/segundo-fator', { ativo: true }, 'PUT'); setSegundo(true); setMsg('Segundo fator ligado: ao entrar com a senha, o portal pede também a sua biometria.'); } catch (x) { setErro((x as Error).message); }
  };
  const desligar = async () => {
    setErro(''); setMsg('');
    try { await api('/api/biometria/segundo-fator', { ativo: false, senha }, 'PUT'); setSegundo(false); setDesligando(false); setSenha(''); setMsg('Segundo fator desligado.'); } catch (x) { setErro((x as Error).message); }
  };

  const adicionar = async () => {
    setErro(''); setMsg(''); setOcupado(true);
    try {
      await cadastrarBiometria(nomeDoAparelho());
      setMsg('Biometria cadastrada. Na próxima vez, use “Entrar com biometria”.');
      await carregar();
    } catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };
  const remover = async (p: Passkey) => {
    if (!(await confirmar({ titulo: 'Remover biometria?', mensagem: `«${p.nome}» deixa de entrar no portal com a digital ou o rosto. A senha continua valendo.`, confirmar: 'Remover', perigo: true }))) return;
    try { await api(`/api/biometria/${p.id}`, undefined, 'DELETE'); await carregar(); setMsg('Biometria removida.'); } catch (x) { setErro((x as Error).message); }
  };

  return (
    <div className="biometria-pessoal">
      <p className="perfil-linha"><span className="suave">Entrar com digital ou rosto</span></p>
      {msg && <p className="ok" role="status">{msg}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {(lista ?? []).length > 0 && (
        <ul className="biometria-lista">
          {(lista ?? []).map((p) => (
            <li key={p.id}>
              <Icone nome="escudo" tamanho={16} />
              <span><b>{p.nome}</b><small className="suave"> · cadastrada em {dataCurta(p.criado_em)}{p.ultimo_uso ? ` · último uso ${dataCurta(p.ultimo_uso)}` : ''}</small></span>
              <button type="button" className="btn btn-sec btn-pequeno" onClick={() => void remover(p)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      {(lista ?? []).length > 0 && (
        <div className="segundo-fator">
          <label className="linha">
            <input type="checkbox" checked={segundo} onChange={() => { if (segundo) setDesligando(true); else void ligar(); }} />
            <span><b>Pedir minha biometria também ao entrar com a senha</b><small className="suave"> (segundo fator, opcional). Mais segurança: só a senha deixa de bastar.</small></span>
          </label>
          {desligando && (
            <form className="segundo-fator-desligar" onSubmit={(e) => { e.preventDefault(); void desligar(); }}>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite sua senha para desligar" aria-label="Sua senha" autoComplete="current-password" />
              <button className="btn btn-pequeno" disabled={!senha}>Desligar</button>
              <button type="button" className="btn btn-sec btn-pequeno" onClick={() => { setDesligando(false); setSenha(''); }}>Cancelar</button>
            </form>
          )}
        </div>
      )}
      {disponivel
        ? <button type="button" className="btn btn-sec btn-pequeno" disabled={ocupado} onClick={() => void adicionar()}>{ocupado ? 'Aguardando o aparelho…' : (lista ?? []).length ? 'Cadastrar outro aparelho' : 'Cadastrar a biometria deste aparelho'}</button>
        : <p className="suave perfil-dica">Disponível quando o portal é aberto em endereço seguro (https) num aparelho com digital, rosto ou PIN configurados.</p>}
    </div>
  );
}

/** Depois do login, sugere cadastrar a biometria deste aparelho (uma vez; de novo se a pessoa tentou entrar por biometria sem ter cadastro). */
export function OfertaBiometria({ usuarioId }: { usuarioId: number }) {
  const disponivel = useBiometriaDisponivel();
  useEffect(() => {
    if (!disponivel) return;
    let vivo = true;
    const chave = `portal.bio-oferta.${usuarioId}`;
    let pedida = false, recusada = false;
    try { pedida = sessionStorage.getItem(CHAVE_OFERTA) === '1'; recusada = localStorage.getItem(chave) === '1' || localStorage.getItem('portal.bio-oferta.nunca') === '1'; } catch { /* sem armazenamento */ }
    if (recusada && !pedida) return;
    const esperar = setTimeout(() => {
      api<Passkey[]>('/api/biometria').then(async (lista) => {
        try { sessionStorage.removeItem(CHAVE_OFERTA); } catch { /* ignora */ }
        if (!vivo || lista.length > 0) return;
        const ok = await confirmar({
          titulo: 'Entrar com digital ou rosto?',
          mensagem: 'Cadastre a biometria deste aparelho para entrar nos próximos acessos sem digitar a senha. Ela fica só no seu aparelho e você pode remover quando quiser em Meu perfil.',
          confirmar: 'Cadastrar agora', cancelar: 'Agora não', icone: 'digital',
        });
        if (!ok) { try { localStorage.setItem(chave, '1'); } catch { /* ignora */ } return; }
        try { await cadastrarBiometria(nomeDoAparelho()); await avisar({ titulo: 'Biometria cadastrada', icone: 'digital', mensagem: 'Na próxima vez, toque no ícone de digital na tela de entrada.' }); }
        catch (x) { await avisar({ titulo: 'Não foi possível cadastrar', mensagem: (x as Error).message }); }
      }).catch(() => { /* sem oferta */ });
    }, 1200);
    return () => { vivo = false; clearTimeout(esperar); };
  }, [disponivel, usuarioId]);
  return null;
}
