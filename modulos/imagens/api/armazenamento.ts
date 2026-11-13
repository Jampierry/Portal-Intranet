// Arquivos de mídia (imagens e vídeos) no DISCO, fora do SQLite. O banco guarda só o nome, o tipo e a data
// (a coluna `dados` fica vazia = "o conteúdo está no disco"); linhas antigas com `dados` preenchido continuam
// funcionando e são movidas para o disco na subida do servidor (`moverMidiaDoBanco`).
//
// Pasta: PASTA_MIDIA, ou `midia/` ao lado do arquivo do banco (padrão dados-privados/midia). Banco em memória
// (testes) usa uma pasta temporária descartável. Estrutura: <pasta>/imagens/<nome> e <pasta>/videos/<nome>.
import { closeSync, cpSync, existsSync, fstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Banco } from '../../../servidor/src/db.ts';

export type TipoMidia = 'imagens' | 'videos' | 'anexos';
const TABELA = { imagens: 'imagens_arquivo', videos: 'videos_arquivo' } as const;
const VAZIO = new Uint8Array(0);

const temporarias = new WeakMap<Banco, string>(); // banco em memória (testes): uma pasta temporária por banco, para um teste não apagar o arquivo do outro

/** Pasta raiz da mídia para este banco. */
export function pastaMidia(db: Banco): string {
  if (process.env.PASTA_MIDIA) return resolve(process.env.PASTA_MIDIA);
  const arquivo = (db.prepare('PRAGMA database_list').get() as { file?: string } | undefined)?.file;
  if (arquivo) return join(dirname(arquivo), 'midia');
  let pasta = temporarias.get(db);
  if (!pasta) { pasta = mkdtempSync(join(tmpdir(), 'portal-midia-')); temporarias.set(db, pasta); }
  return pasta;
}

const caminho = (db: Banco, tipo: TipoMidia, nome: string) => {
  if (!/^[A-Za-z0-9._-]+$/.test(nome) || nome.startsWith('.')) throw new Error('Nome de arquivo inválido.');
  return join(pastaMidia(db), tipo, nome);
};

/** Grava o arquivo (escreve num temporário e renomeia, para nunca ficar pela metade). */
export function gravarArquivo(db: Banco, tipo: TipoMidia, nome: string, dados: Buffer) {
  const destino = caminho(db, tipo, nome);
  mkdirSync(dirname(destino), { recursive: true });
  const parcial = `${destino}.parcial`;
  writeFileSync(parcial, dados);
  renameSync(parcial, destino);
}

/** Linha do banco: o conteúdo está no disco quando `dados` é vazio. */
type Linha = { dados: Uint8Array | null };
export const estaNoDisco = (l: Linha) => !l.dados || l.dados.length === 0;

export function lerArquivo(db: Banco, tipo: TipoMidia, nome: string): Buffer | null {
  const c = caminho(db, tipo, nome);
  return existsSync(c) ? readFileSync(c) : null;
}

export function tamanhoArquivo(db: Banco, tipo: TipoMidia, nome: string): number | null {
  const c = caminho(db, tipo, nome);
  return existsSync(c) ? statSync(c).size : null;
}

/** Lê só o trecho [ini, fim] (inclusive), sem carregar o arquivo inteiro. */
export function lerTrecho(db: Banco, tipo: TipoMidia, nome: string, ini: number, fim: number): Buffer {
  const fd = openSync(caminho(db, tipo, nome), 'r');
  try {
    const n = Math.min(fim, fstatSync(fd).size - 1) - ini + 1;
    const buf = Buffer.alloc(Math.max(0, n));
    readSync(fd, buf, 0, buf.length, ini);
    return buf;
  } finally { closeSync(fd); }
}

export function apagarArquivo(db: Banco, tipo: TipoMidia, nome: string) {
  try { rmSync(caminho(db, tipo, nome), { force: true }); } catch { /* nome inválido ou já sem arquivo */ }
}

/** Soma dos bytes dos arquivos de mídia no disco. */
export function bytesNoDisco(db: Banco): number {
  let total = 0;
  for (const tipo of ['imagens', 'videos', 'anexos'] as const) {
    const pasta = join(pastaMidia(db), tipo);
    if (!existsSync(pasta)) continue;
    for (const f of readdirSync(pasta)) { try { total += statSync(join(pasta, f)).size; } catch { /* sumiu no meio */ } }
  }
  return total;
}

/** Uma vez só (idempotente): conteúdo que ainda está dentro do banco vai para o disco e a coluna é esvaziada. Devolve quantos moveu. */
export function moverMidiaDoBanco(db: Banco): number {
  let movidos = 0;
  for (const tipo of ['imagens', 'videos'] as const) {
    const nomes = db.prepare(`SELECT nome FROM ${TABELA[tipo]} WHERE length(dados) > 0`).all() as { nome: string }[];
    for (const { nome } of nomes) {
      const r = db.prepare(`SELECT dados FROM ${TABELA[tipo]} WHERE nome = ?`).get(nome) as { dados: Uint8Array };
      const buf = Buffer.from(r.dados);
      gravarArquivo(db, tipo, nome, buf);
      if (statSync(caminho(db, tipo, nome)).size !== buf.length) throw new Error(`Falha ao copiar ${nome} para o disco.`);
      db.prepare(`UPDATE ${TABELA[tipo]} SET dados = ? WHERE nome = ?`).run(VAZIO, nome);
      movidos++;
    }
  }
  // Anexos das publicações para redes sociais: o arquivo se chama <id>.<extensão>.
  const anexos = db.prepare('SELECT id, tipo FROM publicacoes_anexos WHERE length(dados) > 0').all() as { id: number; tipo: string }[];
  for (const { id, tipo } of anexos) {
    const nome = nomeAnexo(id, tipo);
    const buf = Buffer.from((db.prepare('SELECT dados FROM publicacoes_anexos WHERE id = ?').get(id) as { dados: Uint8Array }).dados);
    gravarArquivo(db, 'anexos', nome, buf);
    if (statSync(caminho(db, 'anexos', nome)).size !== buf.length) throw new Error(`Falha ao copiar o anexo ${id} para o disco.`);
    db.prepare('UPDATE publicacoes_anexos SET dados = ? WHERE id = ?').run(VAZIO, id);
    movidos++;
  }
  // Devolve ao sistema o espaço que os arquivos ocupavam dentro do banco (só quando houve mudança).
  if (movidos > 0) { try { db.exec('VACUUM'); } catch { /* outro processo usando o banco: o backup (VACUUM INTO) já sai compacto */ } }
  return movidos;
}

/** Nome do arquivo de um anexo de publicação: id + extensão (a extensão já foi validada no envio). */
export const nomeAnexo = (id: number, ext: string) => `${id}.${ext}`;

/** Apaga os arquivos de anexos que não têm mais linha no banco (linha apagada, publicação excluída em cascata). */
export function limparAnexosOrfaos(db: Banco): number {
  const pasta = join(pastaMidia(db), 'anexos');
  if (!existsSync(pasta)) return 0;
  const vivos = new Set((db.prepare('SELECT id, tipo FROM publicacoes_anexos').all() as { id: number; tipo: string }[]).map((r) => nomeAnexo(r.id, r.tipo)));
  let n = 0;
  for (const f of readdirSync(pasta)) if (!vivos.has(f)) { try { rmSync(join(pasta, f), { force: true }); n++; } catch { /* em uso: fica para a próxima */ } }
  return n;
}

/** Copia a mídia para a pasta de backup (só o que ainda não está lá; arquivos nunca mudam depois de criados). */
export function copiarParaBackup(db: Banco, destino: string) {
  const origem = pastaMidia(db);
  if (existsSync(origem)) cpSync(origem, destino, { recursive: true, force: false, errorOnExist: false });
}

export { VAZIO as DADOS_VAZIOS };
