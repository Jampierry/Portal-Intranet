// Meu perfil: cada pessoa cuida dos próprios dados de contato, contato de emergência, e-mail e preferências.
// Os dados ficam visíveis só para a própria pessoa (nenhuma rota entrega o perfil de outra). Alterações são auditadas sem o conteúdo.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { auditar } from '../../acessos/api/guard.ts';
import { confereSenha } from '../../acessos/api/senha.ts';
import { corpoObjeto, ErroValidacao, texto } from '../../../servidor/src/validar.ts';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAMPOS = ['apelido', 'celular', 'email_alternativo', 'emergencia1_nome', 'emergencia1_parent', 'emergencia1_tel', 'emergencia2_nome', 'emergencia2_parent', 'emergencia2_tel', 'observacao_saude'] as const;
type Campo = (typeof CAMPOS)[number];
type Perfil = Record<Campo, string | null>;

/** Telefone: aceita só dígitos com DDD (10 ou 11), devolve formatado; vazio = sem telefone. */
function telefone(v: string | null, rotulo: string): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (d.length !== 10 && d.length !== 11) throw new ErroValidacao(`${rotulo}: informe o telefone com DDD (ex.: (62) 99999-0000).`);
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

function validar(c: Record<string, unknown>): Perfil {
  const t = (campo: Campo, rotulo: string, max: number) => texto(c, campo, rotulo, { opcional: true, max });
  const alt = t('email_alternativo', 'E-mail alternativo', 120)?.toLowerCase() ?? null;
  if (alt && !EMAIL_OK.test(alt)) throw new ErroValidacao('E-mail alternativo: informe um endereço válido.');
  const p: Perfil = {
    apelido: t('apelido', 'Como prefere ser chamado(a)', 40),
    celular: telefone(t('celular', 'Celular', 30), 'Celular'),
    email_alternativo: alt,
    emergencia1_nome: t('emergencia1_nome', 'Contato de emergência 1 (nome)', 80),
    emergencia1_parent: t('emergencia1_parent', 'Contato de emergência 1 (parentesco)', 40),
    emergencia1_tel: telefone(t('emergencia1_tel', 'Contato de emergência 1 (telefone)', 30), 'Contato de emergência 1'),
    emergencia2_nome: t('emergencia2_nome', 'Contato de emergência 2 (nome)', 80),
    emergencia2_parent: t('emergencia2_parent', 'Contato de emergência 2 (parentesco)', 40),
    emergencia2_tel: telefone(t('emergencia2_tel', 'Contato de emergência 2 (telefone)', 30), 'Contato de emergência 2'),
    observacao_saude: t('observacao_saude', 'Observação de saúde', 300),
  };
  for (const n of ['1', '2'] as const) {
    if ((p[`emergencia${n}_nome`] || p[`emergencia${n}_parent`]) && !p[`emergencia${n}_tel`]) throw new ErroValidacao(`Contato de emergência ${n}: informe o telefone.`);
    if (p[`emergencia${n}_tel`] && !p[`emergencia${n}_nome`]) throw new ErroValidacao(`Contato de emergência ${n}: informe o nome.`);
  }
  return p;
}

const vazio = (): Perfil => Object.fromEntries(CAMPOS.map((k) => [k, null])) as Perfil;
const ler = (db: Banco, id: number): Perfil => ({ ...vazio(), ...((db.prepare(`SELECT ${CAMPOS.join(', ')} FROM usuarios_perfil WHERE usuario_id = ?`).get(id) as Perfil | undefined) ?? {}) });

export async function rotasPerfil(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/eu/perfil', async (req) => {
    const u = db.prepare('SELECT email, criado_em, ultimo_acesso FROM usuarios WHERE id = ?').get(req.usuario!.id) as { email: string | null; criado_em: string; ultimo_acesso: string | null };
    return { ...ler(db, req.usuario!.id), email: u.email, criado_em: u.criado_em, ultimo_acesso: u.ultimo_acesso };
  });

  app.put('/api/eu/perfil', async (req) => {
    const p = validar(corpoObjeto(req.body));
    db.prepare(`INSERT INTO usuarios_perfil (usuario_id, ${CAMPOS.join(', ')}, atualizado_em) VALUES (?, ${CAMPOS.map(() => '?').join(', ')}, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET ${CAMPOS.map((k) => `${k} = excluded.${k}`).join(', ')}, atualizado_em = excluded.atualizado_em`)
      .run(req.usuario!.id, ...CAMPOS.map((k) => p[k]), new Date().toISOString());
    auditar(db, req.usuario!.id, 'perfil_atualizado', { campos: CAMPOS.filter((k) => p[k]).length }); // sem o conteúdo
    return ler(db, req.usuario!.id);
  });

  // Trocar o e-mail do portal (usado nos avisos): pede a senha atual para evitar troca por alguém numa sessão esquecida aberta.
  app.put('/api/eu/email', async (req, resp) => {
    const c = corpoObjeto(req.body);
    const senha = String(texto(c, 'senha', 'Senha atual', { max: 128 }));
    const email = String(texto(c, 'email', 'E-mail', { max: 120 })).toLowerCase();
    if (!EMAIL_OK.test(email)) throw new ErroValidacao('E-mail: informe um endereço válido (ex.: nome@empresa.com.br).');
    const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(req.usuario!.id) as { senha_hash: string };
    if (!confereSenha(senha, u.senha_hash)) return resp.code(400).send({ erro: 'Senha atual incorreta.' });
    db.prepare('UPDATE usuarios SET email = ? WHERE id = ?').run(email, req.usuario!.id);
    auditar(db, req.usuario!.id, 'email_trocado', {});
    return { email };
  });
}
