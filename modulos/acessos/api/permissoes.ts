// Permissões do portal. Cada perfil define o que a pessoa acessa e o que pode FAZER em cada tela e em cada aba;
// cada usuário pode ter ajustes próprios. Regra: o ajuste do usuário (permitir/negar) vale por cima do perfil;
// sem ajuste, vale o perfil. O administrador sempre pode tudo.
import type { Banco } from '../../../servidor/src/db.ts';

export interface AcaoPermissao { chave: string; rotulo: string }
/** Uma tela ou aba, com as ações possíveis nela. A primeira ação ("ver") é o portão: sem ela, nenhuma outra vale. */
export interface AreaPermissao { id: string; rotulo: string; acoes: AcaoPermissao[] }
export interface GrupoPermissao { grupo: string; areas: AreaPermissao[] }

/** Cria/edita/exclui de uma aba de Publicar. */
const crud = (id: string, rotulo: string): AreaPermissao => ({
  id, rotulo, acoes: [
    { chave: `pub.${id}.ver`, rotulo: 'Ver a aba' }, { chave: `pub.${id}.criar`, rotulo: 'Criar' },
    { chave: `pub.${id}.editar`, rotulo: 'Editar' }, { chave: `pub.${id}.excluir`, rotulo: 'Excluir' },
  ],
});

export const CATALOGO: GrupoPermissao[] = [
  { grupo: 'Telas', areas: [
    { id: 'comunicados', rotulo: 'Comunicados', acoes: [{ chave: 'ver.comunicados', rotulo: 'Acessar a tela' }] },
    { id: 'documentos', rotulo: 'Documentos', acoes: [
      { chave: 'ver.documentos', rotulo: 'Acessar a tela' },
      { chave: 'documentos.abrir', rotulo: 'Abrir o link do documento' },
      { chave: 'documentos.restritos', rotulo: 'Ver documentos restritos' },
    ] },
    { id: 'calendario', rotulo: 'Calendário (menu)', acoes: [
      { chave: 'ver.calendario', rotulo: 'Ver o calendário' },
      { chave: 'calendario.criar', rotulo: 'Cadastrar datas importantes' },
      { chave: 'calendario.excluir', rotulo: 'Excluir datas importantes' },
    ] },
    { id: 'pessoas', rotulo: 'Pessoas (contatos)', acoes: [{ chave: 'ver.pessoas', rotulo: 'Acessar a tela' }] },
    { id: 'ajuda', rotulo: 'Ajuda', acoes: [{ chave: 'ver.ajuda', rotulo: 'Acessar a tela' }] },
  ] },
  { grupo: 'Publicar (abas)', areas: [
    crud('comunicados', 'Comunicados'), crud('banners', 'Banners (Novidades)'),
    { id: 'institucional', rotulo: 'Missão, Visão e Valores', acoes: [{ chave: 'pub.institucional.ver', rotulo: 'Ver a aba' }, { chave: 'pub.institucional.editar', rotulo: 'Editar' }] },
    crud('documentos', 'Documentos'), crud('destaques', 'Colaborador Destaque'), crud('contatos', 'Contatos'), crud('aplicativos', 'Aplicativos (cadastro)'),
  ] },
  { grupo: 'Configurações (abas)', areas: [
    { id: 'usuarios', rotulo: 'Usuários', acoes: [
      { chave: 'cfg.usuarios.ver', rotulo: 'Ver a aba' }, { chave: 'cfg.usuarios.criar', rotulo: 'Criar' },
      { chave: 'cfg.usuarios.editar', rotulo: 'Editar' }, { chave: 'cfg.usuarios.senha', rotulo: 'Redefinir senha' },
    ] },
    { id: 'perfis', rotulo: 'Perfis', acoes: [
      { chave: 'cfg.perfis.ver', rotulo: 'Ver a aba' }, { chave: 'cfg.perfis.criar', rotulo: 'Criar' },
      { chave: 'cfg.perfis.editar', rotulo: 'Editar' }, { chave: 'cfg.perfis.excluir', rotulo: 'Excluir' },
    ] },
    { id: 'integracoes', rotulo: 'Integrações (Zimbra)', acoes: [{ chave: 'cfg.integracoes.ver', rotulo: 'Ver a aba' }, { chave: 'cfg.integracoes.editar', rotulo: 'Editar e testar' }] },
    { id: 'auditoria', rotulo: 'Auditoria', acoes: [{ chave: 'cfg.auditoria.ver', rotulo: 'Ver a aba' }] },
  ] },
];

const AREAS = CATALOGO.flatMap((g) => g.areas);
export const TODAS: readonly string[] = AREAS.flatMap((a) => a.acoes.map((i) => i.chave));
const VALIDAS = new Set(TODAS);

/** Mantém só o que faz sentido: sem o "ver" da tela/aba, nenhuma outra ação dela vale. */
export function normalizar(chaves: Iterable<string>): string[] {
  const s = new Set(chaves);
  for (const a of AREAS) if (!s.has(a.acoes[0].chave)) for (const ac of a.acoes) s.delete(ac.chave);
  return TODAS.filter((c) => s.has(c));
}

/** Perfis do sistema (não podem ser apagados; o Administrador não tem permissões editáveis: sempre tudo). */
export interface PerfilInfo { codigo: string; nome: string; sistema: boolean; fixo: boolean; permissoes: string[]; usuarios: number }

export const PADRAO_PERFIL: Record<string, string[]> = {
  editor: normalizar(TODAS.filter((c) => !c.startsWith('cfg.') && !c.startsWith('pub.aplicativos'))),
  consulta: normalizar(['ver.comunicados', 'ver.documentos', 'documentos.abrir', 'ver.calendario', 'ver.pessoas', 'ver.ajuda']),
};

export type Ajustes = Record<string, boolean>;

export function permissoesDoPerfil(db: Banco, perfil: string): string[] {
  if (perfil === 'admin') return [...TODAS];
  const r = db.prepare('SELECT permissoes FROM perfis_permissoes WHERE perfil = ?').get(perfil) as { permissoes: string } | undefined;
  if (!r) return PADRAO_PERFIL[perfil] ?? [];
  try { return normalizar((JSON.parse(r.permissoes) as string[]).filter((c) => VALIDAS.has(c))); } catch { return []; }
}

export function listarPerfis(db: Banco): PerfilInfo[] {
  const linhas = db.prepare(
    `SELECT p.perfil AS codigo, COALESCE(p.nome, p.perfil) AS nome, p.sistema,
            (SELECT COUNT(*) FROM usuarios u WHERE u.perfil = p.perfil) AS usuarios
       FROM perfis_permissoes p
      ORDER BY CASE p.perfil WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 WHEN 'consulta' THEN 2 ELSE 3 END, p.nome COLLATE NOCASE`,
  ).all() as { codigo: string; nome: string; sistema: number; usuarios: number }[];
  return linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, sistema: l.sistema === 1, fixo: l.codigo === 'admin', usuarios: l.usuarios, permissoes: permissoesDoPerfil(db, l.codigo) }));
}
export const perfilExiste = (db: Banco, codigo: string) => !!db.prepare('SELECT 1 FROM perfis_permissoes WHERE perfil = ?').get(codigo);
export const nomeDoPerfil = (db: Banco, codigo: string) =>
  (db.prepare('SELECT nome FROM perfis_permissoes WHERE perfil = ?').get(codigo) as { nome: string | null } | undefined)?.nome ?? codigo;

/** Código do perfil novo a partir do nome (sem acento, minúsculo, prefixo p-), único. */
export function codigoDoPerfil(db: Banco, nome: string): string {
  const base = 'p-' + (nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'perfil').slice(0, 30);
  let codigo = base, n = 2;
  while (perfilExiste(db, codigo)) codigo = `${base}-${n++}`;
  return codigo;
}

export function lerAjustes(json: string | null | undefined): Ajustes {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => VALIDAS.has(k) && typeof v === 'boolean')) as Ajustes;
  } catch { return {}; }
}

/** Permissões que valem de fato: perfil + ajustes do usuário por cima (e o "ver" como portão). */
export function permissoesEfetivas(db: Banco, perfil: string, ajustesJson: string | null | undefined): string[] {
  if (perfil === 'admin') return [...TODAS];
  const ativas = new Set(permissoesDoPerfil(db, perfil));
  for (const [k, v] of Object.entries(lerAjustes(ajustesJson))) { if (v) ativas.add(k); else ativas.delete(k); }
  return normalizar(ativas);
}

/** Valida o que veio do formulário: só chaves do catálogo, valores true/false; qualquer outra coisa é recusada. */
export function validarAjustes(v: unknown): Ajustes {
  if (v === undefined || v === null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('Permissões do usuário: formato inválido.');
  const out: Ajustes = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!VALIDAS.has(k)) throw new Error(`Permissão desconhecida: ${k}`);
    if (typeof val !== 'boolean') throw new Error(`Permissão ${k}: use permitir ou negar.`);
    out[k] = val;
  }
  return out;
}

export function validarLista(v: unknown): string[] {
  if (!Array.isArray(v)) throw new Error('Permissões do perfil: envie uma lista.');
  const unicas = new Set<string>();
  for (const k of v) {
    if (typeof k !== 'string' || !VALIDAS.has(k)) throw new Error(`Permissão desconhecida: ${String(k)}`);
    unicas.add(k);
  }
  return normalizar(unicas);
}
