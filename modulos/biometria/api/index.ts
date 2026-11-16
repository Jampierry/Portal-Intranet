// Biometria (digital ou rosto do aparelho) por passkeys (WebAuthn). A biometria nunca sai do aparelho: o servidor guarda só a chave PÚBLICA.
// Exige HTTPS (ou localhost) e um endereço com nome (não vale IP); a credencial fica presa ao endereço do portal.
// Em produção, se o portal tiver mais de um endereço, defina WEBAUTHN_RP_ID (ex.: intranet.empresa.com.br).
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Banco } from '../../../servidor/src/db.ts';
import { config } from '../../../servidor/src/config.ts';
import { corpoObjeto, inteiro, texto, ErroValidacao } from '../../../servidor/src/validar.ts';
import { auditar, COOKIE_SESSAO, criarSessao, horasDaSessao } from '../../acessos/api/guard.ts';
import { nomeDoPerfil, permissoesEfetivas } from '../../acessos/api/permissoes.ts';
import { registrarUso } from '../../uso/api/registro.ts';

const NOME_PORTAL = process.env.WEBAUTHN_RP_NOME ?? 'Portal Intranet';
const MAX_POR_PESSOA = 5;
const VALE_MS = 5 * 60_000;
const MAX_FALHAS_IP = 20;
const JANELA_MIN = 15;

interface Desafio { challenge: string; usuarioId?: number; expira: number }
interface LinhaPasskey { id: number; usuario_id: number; credencial_id: string; chave_publica: Uint8Array; contador: number; transportes: string | null }

export async function rotasBiometria(app: FastifyInstance, { db, producao }: { db: Banco; producao: boolean }) {
  // Desafios em memória (vivem 5 minutos e valem uma vez só).
  const desafios = new Map<string, Desafio>();
  const guardar = (d: Omit<Desafio, 'expira'>) => {
    const agora = Date.now();
    for (const [k, v] of desafios) if (v.expira < agora) desafios.delete(k);
    const id = randomBytes(18).toString('base64url');
    desafios.set(id, { ...d, expira: agora + VALE_MS });
    return id;
  };
  const retirar = (id: unknown, usuarioId?: number): Desafio => {
    const d = typeof id === 'string' ? desafios.get(id) : undefined;
    if (typeof id === 'string') desafios.delete(id);
    if (!d || d.expira < Date.now() || (usuarioId !== undefined && d.usuarioId !== usuarioId)) throw new ErroValidacao('O pedido de biometria expirou. Tente de novo.');
    return d;
  };

  /** Endereço de onde o navegador fala e o identificador (rpID) que a credencial usa. */
  function origemDe(req: FastifyRequest): { origem: string; rpID: string } {
    const origem = req.headers.origin;
    if (!origem) throw new ErroValidacao('Não foi possível confirmar o endereço do portal.');
    let url: URL;
    try { url = new URL(origem); } catch { throw new ErroValidacao('Endereço do portal inválido.'); }
    if (url.host !== req.headers.host && !config.origensPermitidas.includes(origem)) throw new ErroValidacao('Endereço do portal não permitido.');
    if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new ErroValidacao('A biometria precisa do endereço com nome (https://…), não do número IP.');
    const fixo = process.env.WEBAUTHN_RP_ID;
    if (fixo && url.hostname !== fixo && !url.hostname.endsWith(`.${fixo}`)) throw new ErroValidacao('Endereço diferente do configurado para a biometria.');
    if (producao && url.protocol !== 'https:') throw new ErroValidacao('A biometria só funciona em HTTPS.');
    return { origem, rpID: fixo ?? url.hostname };
  }
  const transportesDe = (s: string | null): AuthenticatorTransportFuture[] | undefined => { try { return s ? JSON.parse(s) as AuthenticatorTransportFuture[] : undefined; } catch { return undefined; } };

  // ----- Minhas biometrias -----
  app.get('/api/biometria', async (req) =>
    db.prepare('SELECT id, nome, criado_em, ultimo_uso FROM passkeys WHERE usuario_id = ? ORDER BY id').all(req.usuario!.id));

  app.delete<{ Params: { id: string } }>('/api/biometria/:id', async (req, resp) => {
    const id = inteiro(req.params.id, 'Biometria');
    const r = db.prepare('DELETE FROM passkeys WHERE id = ? AND usuario_id = ?').run(id, req.usuario!.id);
    if (Number(r.changes) === 0) return resp.code(404).send({ erro: 'Biometria não encontrada.' });
    auditar(db, req.usuario!.id, 'biometria_removida', { id });
    return { ok: true };
  });

  // ----- Cadastrar a biometria deste aparelho (logado) -----
  app.post('/api/biometria/registro/opcoes', async (req) => {
    const { rpID } = origemDe(req);
    const u = req.usuario!;
    const minhas = db.prepare('SELECT credencial_id, transportes FROM passkeys WHERE usuario_id = ?').all(u.id) as { credencial_id: string; transportes: string | null }[];
    if (minhas.length >= MAX_POR_PESSOA) throw new ErroValidacao(`Você já tem ${MAX_POR_PESSOA} biometrias cadastradas. Remova uma para adicionar outra.`);
    const opcoes = await generateRegistrationOptions({
      rpName: NOME_PORTAL, rpID, userName: u.login, userDisplayName: u.nome, userID: new TextEncoder().encode(`portal-${u.id}`),
      attestationType: 'none', timeout: 60_000,
      excludeCredentials: minhas.map((m) => ({ id: m.credencial_id, transports: transportesDe(m.transportes) })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
    });
    return { opcoes, desafio_id: guardar({ challenge: opcoes.challenge, usuarioId: u.id }) };
  });

  app.post('/api/biometria/registro', { bodyLimit: 32768 }, async (req, resp) => {
    const { origem, rpID } = origemDe(req);
    const u = req.usuario!;
    const c = corpoObjeto(req.body);
    const d = retirar(c.desafio_id, u.id);
    const nome = String(texto(c, 'nome', 'Nome do aparelho', { max: 40, opcional: true }) ?? '').trim() || 'Este aparelho';
    let v;
    try {
      v = await verifyRegistrationResponse({ response: c.resposta as RegistrationResponseJSON, expectedChallenge: d.challenge, expectedOrigin: origem, expectedRPID: rpID, requireUserVerification: true });
    } catch { throw new ErroValidacao('Não foi possível confirmar a biometria deste aparelho.'); }
    if (!v.verified || !v.registrationInfo) throw new ErroValidacao('Não foi possível confirmar a biometria deste aparelho.');
    const cred = v.registrationInfo.credential;
    if (db.prepare('SELECT 1 FROM passkeys WHERE credencial_id = ?').get(cred.id)) return resp.code(409).send({ erro: 'Esta biometria já está cadastrada.' });
    const id = Number(db.prepare('INSERT INTO passkeys (usuario_id, credencial_id, chave_publica, contador, transportes, nome, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, cred.id, Buffer.from(cred.publicKey), cred.counter, cred.transports ? JSON.stringify(cred.transports) : null, nome, new Date().toISOString()).lastInsertRowid);
    auditar(db, u.id, 'biometria_cadastrada', { id, nome });
    return resp.code(201).send({ id, nome });
  });

  // ----- Entrar com a biometria (antes do login) -----
  app.post('/api/biometria/entrar/opcoes', { bodyLimit: 1024 }, async (req) => {
    const { rpID } = origemDe(req);
    const opcoes = await generateAuthenticationOptions({ rpID, userVerification: 'required', timeout: 60_000 });
    return { opcoes, desafio_id: guardar({ challenge: opcoes.challenge }) };
  });

  app.post('/api/biometria/entrar', { bodyLimit: 32768 }, async (req, resp) => {
    const { origem, rpID } = origemDe(req);
    const c = corpoObjeto(req.body);
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const chave = `bio:${req.ip}`;
    const { n } = db.prepare('SELECT COUNT(*) n FROM tentativas_login WHERE chave = ? AND quando > ?').get(chave, desde) as { n: number };
    if (n >= MAX_FALHAS_IP) return resp.code(429).send({ erro: `Muitas tentativas. Aguarde ${JANELA_MIN} minutos e tente de novo.` });
    const recusar = (): never => {
      db.prepare('INSERT INTO tentativas_login (chave, quando) VALUES (?, ?)').run(chave, new Date().toISOString());
      throw Object.assign(new ErroValidacao('Não foi possível entrar com a biometria. Use o login e a senha.'), { recusa: true });
    };
    const d = retirar(c.desafio_id);
    const resposta = c.resposta as AuthenticationResponseJSON | undefined;
    if (!resposta || typeof resposta !== 'object' || typeof resposta.id !== 'string') return recusar();
    const linha = db.prepare('SELECT id, usuario_id, credencial_id, chave_publica, contador, transportes FROM passkeys WHERE credencial_id = ?').get(resposta.id) as LinhaPasskey | undefined;
    if (!linha) return recusar();
    const u = db.prepare('SELECT id, login, nome, perfil, trocar_senha, ativo, permissoes FROM usuarios WHERE id = ?').get(linha.usuario_id) as
      | { id: number; login: string; nome: string; perfil: string; trocar_senha: number; ativo: number; permissoes: string | null } | undefined;
    if (!u || u.ativo !== 1) return recusar();
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response: resposta, expectedChallenge: d.challenge, expectedOrigin: origem, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: linha.credencial_id, publicKey: new Uint8Array(linha.chave_publica), counter: linha.contador, transports: transportesDe(linha.transportes) },
      });
    } catch { return recusar(); }
    if (!v.verified) return recusar();
    const agora = new Date().toISOString();
    db.prepare('UPDATE passkeys SET contador = ?, ultimo_uso = ? WHERE id = ?').run(v.authenticationInfo.newCounter, agora, linha.id);
    db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(agora, u.id);
    const manter = c.manter === true;
    resp.setCookie(COOKIE_SESSAO, criarSessao(db, u.id, manter), { httpOnly: true, sameSite: 'lax', secure: producao, path: '/', maxAge: horasDaSessao(manter) * 3600 });
    auditar(db, u.id, 'login_biometria', manter ? { manter: true } : undefined);
    registrarUso(db, u.id, 'login', req.headers['user-agent']);
    return { id: u.id, login: u.login, nome: u.nome, perfil: u.perfil, perfil_nome: nomeDoPerfil(db, u.perfil), trocar_senha: u.trocar_senha, permissoes: permissoesEfetivas(db, u.perfil, u.permissoes) };
  });
}
