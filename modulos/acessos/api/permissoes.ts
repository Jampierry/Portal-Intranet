// Permissões do portal: o que cada perfil pode fazer e quais telas acessa; cada usuário pode ter ajustes próprios.
// Regra: o ajuste do usuário (permitir/negar) vale por cima do perfil; sem ajuste, vale o perfil. O administrador sempre pode tudo.
import type { Banco } from '../../../servidor/src/db.ts';

export interface ItemPermissao { chave: string; rotulo: string }
export interface GrupoPermissao { grupo: string; itens: ItemPermissao[] }

export const CATALOGO: GrupoPermissao[] = [
  { grupo: 'Telas que pode acessar', itens: [
    { chave: 'ver.comunicados', rotulo: 'Comunicados' },
    { chave: 'ver.documentos', rotulo: 'Documentos' },
    { chave: 'ver.pessoas', rotulo: 'Pessoas (contatos)' },
    { chave: 'ver.ajuda', rotulo: 'Ajuda' },
  ] },
  { grupo: 'O que pode publicar', itens: [
    { chave: 'pub.comunicados', rotulo: 'Comunicados' },
    { chave: 'pub.banners', rotulo: 'Banners (Novidades)' },
    { chave: 'pub.institucional', rotulo: 'Missão, Visão e Valores' },
    { chave: 'pub.documentos', rotulo: 'Documentos' },
    { chave: 'pub.destaques', rotulo: 'Colaborador Destaque' },
    { chave: 'pub.contatos', rotulo: 'Contatos' },
    { chave: 'pub.aplicativos', rotulo: 'Aplicativos (cadastro)' },
  ] },
];

export const TODAS: readonly string[] = CATALOGO.flatMap((g) => g.itens.map((i) => i.chave));
const VALIDAS = new Set(TODAS);

/** Perfis cujas permissões o administrador pode editar (administrador é fixo: tem tudo). */
export const PERFIS_EDITAVEIS = ['editor', 'consulta'] as const;
export const NOME_PERFIL: Record<string, string> = { admin: 'Administrador', editor: 'Editor', consulta: 'Consulta' };

export const PADRAO_PERFIL: Record<string, string[]> = {
  editor: TODAS.filter((c) => c !== 'pub.aplicativos'),
  consulta: TODAS.filter((c) => c.startsWith('ver.')),
};

export type Ajustes = Record<string, boolean>;

export function permissoesDoPerfil(db: Banco, perfil: string): string[] {
  if (perfil === 'admin') return [...TODAS];
  const r = db.prepare('SELECT permissoes FROM perfis_permissoes WHERE perfil = ?').get(perfil) as { permissoes: string } | undefined;
  if (!r) return PADRAO_PERFIL[perfil] ?? [];
  try { return (JSON.parse(r.permissoes) as string[]).filter((c) => VALIDAS.has(c)); } catch { return []; }
}

export function lerAjustes(json: string | null | undefined): Ajustes {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => VALIDAS.has(k) && typeof v === 'boolean')) as Ajustes;
  } catch { return {}; }
}

/** Permissões que valem de fato: perfil + ajustes do usuário por cima. */
export function permissoesEfetivas(db: Banco, perfil: string, ajustesJson: string | null | undefined): string[] {
  if (perfil === 'admin') return [...TODAS];
  const ativas = new Set(permissoesDoPerfil(db, perfil));
  for (const [k, v] of Object.entries(lerAjustes(ajustesJson))) { if (v) ativas.add(k); else ativas.delete(k); }
  return TODAS.filter((c) => ativas.has(c));
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
  return TODAS.filter((c) => unicas.has(c));
}
