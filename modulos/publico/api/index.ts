// Público por departamento (comunicados e pesquisas). Sem departamentos marcados = todos.
// Só departamento, de propósito: escolher pessoas uma a uma quebraria o anonimato das pesquisas.
import type { Banco } from '../../../servidor/src/db.ts';
import { ErroValidacao } from '../../../servidor/src/validar.ts';

export type TipoPublico = 'comunicado' | 'pulso';

/** Lê `departamentos` (lista de ids) do corpo; confere se existem. Vazio/ausente = todos. */
export function lerPublico(db: Banco, bruto: unknown): number[] {
  if (bruto === undefined || bruto === null || bruto === '') return [];
  if (!Array.isArray(bruto)) throw new ErroValidacao('Público: escolha departamentos da lista.');
  const ids = [...new Set(bruto.map((v) => Number(v)))];
  if (ids.length > 200) throw new ErroValidacao('Público: departamentos demais.');
  for (const id of ids) if (!Number.isInteger(id) || !db.prepare('SELECT 1 FROM departamentos WHERE id = ?').get(id)) throw new ErroValidacao('Público: escolha departamentos da lista.');
  return ids;
}

export function gravarPublico(db: Banco, tipo: TipoPublico, registroId: number, ids: number[]): void {
  db.prepare('DELETE FROM publico_departamentos WHERE tipo = ? AND registro_id = ?').run(tipo, registroId);
  const ins = db.prepare('INSERT INTO publico_departamentos (tipo, registro_id, departamento_id) VALUES (?, ?, ?)');
  for (const id of ids) ins.run(tipo, registroId, id);
}

export function publicoDe(db: Banco, tipo: TipoPublico, registroId: number): number[] {
  return (db.prepare('SELECT departamento_id FROM publico_departamentos WHERE tipo = ? AND registro_id = ? ORDER BY departamento_id').all(tipo, registroId) as { departamento_id: number }[]).map((r) => r.departamento_id);
}

/** Texto para a lista: "Todos" ou os nomes dos departamentos. */
export function resumoPublico(db: Banco, tipo: TipoPublico, registroId: number): string {
  const nomes = (db.prepare('SELECT d.nome FROM publico_departamentos p JOIN departamentos d ON d.id = p.departamento_id WHERE p.tipo = ? AND p.registro_id = ? ORDER BY d.nome').all(tipo, registroId) as { nome: string }[]).map((r) => r.nome);
  return nomes.length ? nomes.join(', ') : 'Todos';
}

/**
 * Trecho de SQL: a linha (`idExpr`) é para quem tem o departamento `deptExpr`?
 * Sem público marcado vale para todos. `tipo` é constante do código; as expressões também (nunca texto do usuário).
 */
export function noPublico(tipo: TipoPublico, idExpr: string, deptExpr: string): string {
  return `(NOT EXISTS (SELECT 1 FROM publico_departamentos pd WHERE pd.tipo = '${tipo}' AND pd.registro_id = ${idExpr}) OR EXISTS (SELECT 1 FROM publico_departamentos pd WHERE pd.tipo = '${tipo}' AND pd.registro_id = ${idExpr} AND pd.departamento_id = ${deptExpr}))`;
}

/** Variante para a pessoa logada (o id vem da sessão, sempre número). */
export function paraUsuario(tipo: TipoPublico, idExpr: string, usuarioId: number): string {
  return noPublico(tipo, idExpr, `(SELECT departamento_id FROM usuarios WHERE id = ${Number(usuarioId)})`);
}

/** Ids das pessoas ativas que fazem parte do público. */
export function pessoasDoPublico(db: Banco, tipo: TipoPublico, registroId: number): number[] {
  return (db.prepare(`SELECT u.id FROM usuarios u WHERE u.ativo = 1 AND ${noPublico(tipo, String(Number(registroId)), 'u.departamento_id')}`).all() as { id: number }[]).map((r) => r.id);
}
