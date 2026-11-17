import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const itens = (p: string) => { try { return readdirSync(p).filter((n) => !n.startsWith('.')); } catch { return []; } };
const contar = (p: string): number => { let n = 0; for (const e of readdirSync(p, { withFileTypes: true })) n += e.isDirectory() ? contar(resolve(p, e.name)) : 1; return n; };

/** Copia a pasta antiga para a nova quando a nova ainda está vazia (migração para o volume nomeado). Não apaga nada da antiga e
 *  não faz nada se já houver arquivos no destino. Devolve quantos arquivos foram copiados. */
export function copiarPastaLegada(legada: string | undefined, destino: string): number {
  if (!legada || resolve(legada) === resolve(destino) || !existsSync(legada) || itens(legada).length === 0 || itens(destino).length > 0) return 0;
  mkdirSync(destino, { recursive: true });
  cpSync(legada, destino, { recursive: true, force: false, errorOnExist: false });
  return contar(destino);
}
