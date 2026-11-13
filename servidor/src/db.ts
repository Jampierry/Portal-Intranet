import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Banco = DatabaseSync;

export function abrirBanco(caminho: string): Banco {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  return db;
}

/** Aplica, em ordem, os arquivos infra/migracoes/NNN-nome.sql ainda não aplicados. */
export function migrar(db: Banco, pasta: string): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS _migracoes (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL)');
  const feitas = new Set(
    (db.prepare('SELECT nome FROM _migracoes').all() as { nome: string }[]).map((r) => r.nome),
  );
  const novas: string[] = [];
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
  for (const arq of arquivos) {
    if (feitas.has(arq)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(pasta, arq), 'utf8'));
      db.prepare('INSERT INTO _migracoes (nome, aplicada_em) VALUES (?, ?)').run(arq, new Date().toISOString());
      db.exec('COMMIT');
      novas.push(arq);
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Falha na migração ${arq}: ${(e as Error).message}`);
    }
  }
  return novas;
}
