// Validação de entrada da API (sem dependências). Qualquer falha vira HTTP 400 com a mensagem em português.
export class ErroValidacao extends Error {}

type Corpo = Record<string, unknown>;

export function corpoObjeto(corpo: unknown): Corpo {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) throw new ErroValidacao('Corpo da requisição inválido.');
  return corpo as Corpo;
}

/** Texto obrigatório (padrão) ou opcional (devolve null se vier vazio/ausente). */
export function texto(c: Corpo, campo: string, rotulo: string, o: { min?: number; max?: number; opcional?: boolean } = {}): string | null {
  const bruto = c[campo];
  if (bruto === undefined || bruto === null || (typeof bruto === 'string' && bruto.trim() === '')) {
    if (o.opcional) return null;
    throw new ErroValidacao(`${rotulo}: campo obrigatório.`);
  }
  if (typeof bruto !== 'string') throw new ErroValidacao(`${rotulo}: texto inválido.`);
  const v = bruto.trim();
  const min = o.min ?? 1, max = o.max ?? 200;
  if (v.length < min) throw new ErroValidacao(`${rotulo}: mínimo de ${min} caracteres.`);
  if (v.length > max) throw new ErroValidacao(`${rotulo}: máximo de ${max} caracteres.`);
  return v;
}

export function escolha<T extends string>(c: Corpo, campo: string, rotulo: string, opcoes: readonly T[], padrao?: T): T {
  const v = c[campo];
  if (v === undefined || v === null || v === '') {
    if (padrao !== undefined) return padrao;
    throw new ErroValidacao(`${rotulo}: campo obrigatório.`);
  }
  if (typeof v !== 'string' || !opcoes.includes(v as T)) throw new ErroValidacao(`${rotulo}: valor inválido.`);
  return v as T;
}

/** Só http e https (evita javascript: e afins). */
export function urlHttp(c: Corpo, campo: string, rotulo: string, opcional = true): string | null {
  const v = texto(c, campo, rotulo, { max: 500, opcional });
  if (v === null) return null;
  try {
    if (!['http:', 'https:'].includes(new URL(v).protocol)) throw new Error();
  } catch {
    throw new ErroValidacao(`${rotulo}: informe um endereço http ou https válido.`);
  }
  return v;
}

export function dataIso(c: Corpo, campo: string, rotulo: string): string | null {
  const v = texto(c, campo, rotulo, { max: 10, opcional: true });
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw new ErroValidacao(`${rotulo}: use a data no formato AAAA-MM-DD.`);
  return v;
}

export function inteiro(v: unknown, rotulo: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ErroValidacao(`${rotulo}: identificador inválido.`);
  return n;
}

/** "Título Ótimo!" -> "titulo-otimo" */
export function slugificar(titulo: string): string {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

/** Slug único na tabela (acrescenta -2, -3... se já existir). */
export function slugUnico(existe: (slug: string) => boolean, titulo: string): string {
  const base = slugificar(titulo);
  let s = base, n = 2;
  while (existe(s)) s = `${base}-${n++}`;
  return s;
}
