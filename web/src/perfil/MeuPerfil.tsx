import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api';
import { Avatar, AVATARES_QTD } from '../perfil';
import { Icone } from '../icones';
import type { Usuario } from '../sessao';
import { AvisosEmailPessoa, AvisosPush, FormTrocarSenha } from '../Conta';
import { mascaraTelefone } from '../gestao/Crud';
import { dataCurta } from '../dados';

interface Dados {
  apelido: string | null; celular: string | null; email_alternativo: string | null;
  emergencia1_nome: string | null; emergencia1_parent: string | null; emergencia1_tel: string | null;
  emergencia2_nome: string | null; emergencia2_parent: string | null; emergencia2_tel: string | null;
  observacao_saude: string | null; email: string | null; criado_em: string; ultimo_acesso: string | null;
}
type Form = Record<string, string>;
const CAMPOS_FORM = ['apelido', 'celular', 'email_alternativo', 'emergencia1_nome', 'emergencia1_parent', 'emergencia1_tel', 'emergencia2_nome', 'emergencia2_parent', 'emergencia2_tel', 'observacao_saude'] as const;

/** Bloco com título e dica de privacidade. */
function Bloco({ titulo, icone, dica, children }: { titulo: string; icone: string; dica?: string; children: ReactNode }) {
  return (
    <section className="cartao-sec perfil-bloco">
      <div className="sec-topo"><h2><Icone nome={icone} tamanho={22} /> {titulo}</h2></div>
      {dica && <p className="suave perfil-dica">{dica}</p>}
      {children}
    </section>
  );
}

/** Meu perfil: a própria pessoa cuida de avatar, contato, contato de emergência, e-mail, avisos e senha. */
export function MeuPerfil({ usuario, avatar, mudarAvatar }: { usuario: Usuario; avatar: number | null; mudarAvatar: (a: number | null) => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [f, setF] = useState<Form>({});
  const [msg, setMsg] = useState(''); const [erro, setErro] = useState(''); const [salvando, setSalvando] = useState(false);
  const [email, setEmail] = useState({ aberto: false, novo: '', senha: '', erro: '', ok: '' });
  const [senhaAberta, setSenhaAberta] = useState(false); const [senhaFeita, setSenhaFeita] = useState(false);
  const [avAberto, setAvAberto] = useState(false);

  const carregar = () => api<Dados>('/api/eu/perfil').then((d) => { setDados(d); setF(Object.fromEntries(CAMPOS_FORM.map((k) => [k, d[k] ?? '']))); }).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);
  const campo = (k: (typeof CAMPOS_FORM)[number]) => ({ id: `mp-${k}`, value: f[k] ?? '', onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });
  const tel = (k: (typeof CAMPOS_FORM)[number]) => ({ id: `mp-${k}`, type: 'tel', inputMode: 'numeric' as const, placeholder: '(__) _____-____', maxLength: 15, value: f[k] ?? '', onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: mascaraTelefone(e.target.value) }) });

  const salvar = async (e: FormEvent) => {
    e.preventDefault(); setErro(''); setMsg(''); setSalvando(true);
    try { await api('/api/eu/perfil', f, 'PUT'); setMsg('Dados salvos.'); await carregar(); }
    catch (x) { setErro((x as Error).message); } finally { setSalvando(false); }
  };
  const trocarEmail = async (e: FormEvent) => {
    e.preventDefault(); setEmail({ ...email, erro: '', ok: '' });
    try { await api('/api/eu/email', { email: email.novo, senha: email.senha }, 'PUT'); setEmail({ aberto: false, novo: '', senha: '', erro: '', ok: 'E-mail atualizado.' }); await carregar(); window.dispatchEvent(new Event('portal-avisos-email')); }
    catch (x) { setEmail((s) => ({ ...s, erro: (x as Error).message })); }
  };
  const nomeCurto = f.apelido?.trim() || usuario.nome;

  return (
    <div className="perfil-pagina">
      <section className="cartao-sec perfil-topo">
        <Avatar nome={usuario.nome} avatar={avatar} tamanho={52} />
        <div className="perfil-quem">
          <h2>{nomeCurto}</h2>
          <p className="suave">{usuario.nome} · {usuario.login} · {usuario.perfil_nome}</p>
          {dados && <p className="suave perfil-meta">Conta criada em {dataCurta(dados.criado_em)}{dados.ultimo_acesso ? ` · último acesso em ${dataCurta(dados.ultimo_acesso)}` : ''}</p>}
          <p className="suave perfil-aviso">Nome, login e perfil são definidos pelo administrador. Se algo estiver errado, peça a ele para corrigir.</p>
        </div>
      </section>
      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="perfil-grade">
        <form className="perfil-coluna" onSubmit={(e) => void salvar(e)}>
          <Bloco titulo="Contato" icone="telefone" dica="Só você vê estes dados. Servem para o portal chamar você do jeito certo e para contato quando necessário.">
            <div className="perfil-campos">
              <label htmlFor="mp-apelido">Como prefere ser chamado(a)<input {...campo('apelido')} maxLength={40} placeholder="Ex.: Ju" /></label>
              <label htmlFor="mp-celular">Celular<input {...tel('celular')} autoComplete="tel" /></label>
              <label htmlFor="mp-email_alternativo">E-mail alternativo (pessoal)<input {...campo('email_alternativo')} type="email" maxLength={120} autoComplete="email" /></label>
            </div>
          </Bloco>
          <Bloco titulo="Contato de emergência" icone="info" dica="Quem avisar se acontecer algo com você no trabalho. Visível apenas para você; informe só se quiser.">
            <div className="perfil-emerg-par">
            {[1, 2].map((n) => (
              <fieldset key={n} className="perfil-emerg">
                <legend>Contato {n}{n === 2 ? ' (opcional)' : ''}</legend>
                <div className="perfil-campos">
                  <label htmlFor={`mp-emergencia${n}_nome`}>Nome<input {...campo(`emergencia${n}_nome` as 'emergencia1_nome')} maxLength={80} /></label>
                  <label htmlFor={`mp-emergencia${n}_parent`}>Parentesco<input {...campo(`emergencia${n}_parent` as 'emergencia1_parent')} maxLength={40} placeholder="Ex.: mãe, cônjuge" /></label>
                  <label htmlFor={`mp-emergencia${n}_tel`}>Telefone<input {...tel(`emergencia${n}_tel` as 'emergencia1_tel')} /></label>
                </div>
              </fieldset>
            ))}
            </div>
            <label htmlFor="mp-observacao_saude">Observação de saúde (opcional)<textarea {...campo('observacao_saude')} rows={1} maxLength={300} placeholder="Ex.: alergia a dipirona. Escreva só o que quiser que conste." /></label>
              <div className="perfil-acoes">
                <button className="btn btn-pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar dados'}</button>
                {msg && <span className="ok" role="status">{msg}</span>}
              </div>
          </Bloco>
        </form>

        <div className="perfil-coluna">
          <Bloco titulo="Avatar" icone="perfil">
            <div className="perfil-av-atual">
              <Avatar nome={usuario.nome} avatar={avatar} tamanho={44} />
              <button type="button" className="btn btn-sec btn-pequeno" aria-expanded={avAberto} onClick={() => setAvAberto(!avAberto)}>{avAberto ? 'Ocultar opções' : 'Trocar avatar'}</button>
            </div>
            {avAberto && (
              <div className="avgal">
                <button type="button" className={`avopt${avatar === null ? ' on' : ''}`} aria-label="Usar as iniciais" onClick={() => mudarAvatar(null)}><Avatar nome={usuario.nome} avatar={null} tamanho={32} /></button>
                {Array.from({ length: AVATARES_QTD }, (_, i) => (
                  <button type="button" key={i} className={`avopt${avatar === i ? ' on' : ''}`} aria-label={`Avatar ${i + 1}`} aria-pressed={avatar === i} onClick={() => mudarAvatar(i)}><Avatar nome={usuario.nome} avatar={i} tamanho={32} /></button>
                ))}
              </div>
            )}
          </Bloco>

          <Bloco titulo="Acesso e segurança" icone="escudo">
            <p className="perfil-linha"><span className="suave">E-mail do portal</span> <b>{dados?.email ?? 'não cadastrado'}</b></p>
            {email.ok && <p className="ok" role="status">{email.ok}</p>}
            {!email.aberto
              ? <button type="button" className="btn btn-sec btn-pequeno" onClick={() => setEmail({ ...email, aberto: true, ok: '' })}>Trocar e-mail</button>
              : (
                <form className="entrar-campos" onSubmit={(e) => void trocarEmail(e)}>
                  <label>Novo e-mail<input type="email" value={email.novo} onChange={(e) => setEmail({ ...email, novo: e.target.value })} autoComplete="email" required /></label>
                  <label>Sua senha atual<input type="password" value={email.senha} onChange={(e) => setEmail({ ...email, senha: e.target.value })} autoComplete="current-password" required /></label>
                  {email.erro && <p className="erro" role="alert">{email.erro}</p>}
                  <div className="perfil-acoes"><button className="btn btn-pri btn-pequeno">Salvar e-mail</button><button type="button" className="btn btn-sec btn-pequeno" onClick={() => setEmail({ ...email, aberto: false, erro: '' })}>Cancelar</button></div>
                </form>
              )}
            <hr className="perfil-sep" />
            {senhaFeita && <p className="ok" role="status">Senha alterada.</p>}
            {!senhaAberta
              ? <button type="button" className="btn btn-sec btn-pequeno" onClick={() => { setSenhaAberta(true); setSenhaFeita(false); }}>Trocar senha</button>
              : <FormTrocarSenha aoConcluir={() => { setSenhaAberta(false); setSenhaFeita(true); }} />}
          </Bloco>

          <Bloco titulo="Avisos" icone="sino" dica="Escolha como quer ser avisado(a).">
            <AvisosEmailPessoa key={dados?.email ?? 'sem'} />
            <AvisosPush />
          </Bloco>

        </div>
      </div>
    </div>
  );
}
