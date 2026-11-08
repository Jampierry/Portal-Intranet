// Conexão do portal com o serviço zimbra-mcp (MCP/zimbra-mcp). Endereço e token ficam no banco (tela Configurações › Integrações),
// com as variáveis ZIMBRA_API_URL / ZIMBRA_API_TOKEN / ZIMBRA_AGENDA como alternativa. O token nunca volta para o navegador.
import type { Banco } from '../../../servidor/src/db.ts';

export interface ConexaoZimbra { url: string; token: string; agenda: string; origem: 'banco' | 'ambiente' }

const CHAVES = { url: 'zimbra.url', token: 'zimbra.token', agenda: 'zimbra.agenda' } as const;

const ler = (db: Banco, chave: string) => (db.prepare('SELECT valor FROM integracoes WHERE chave = ?').get(chave) as { valor: string } | undefined)?.valor ?? '';

export function gravarIntegracao(db: Banco, chave: keyof typeof CHAVES, valor: string) {
  const agora = new Date().toISOString();
  if (valor === '') db.prepare('DELETE FROM integracoes WHERE chave = ?').run(CHAVES[chave]);
  else db.prepare('INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em').run(CHAVES[chave], valor, agora);
}

/** Dados salvos na tela têm prioridade; sem eles vale o ambiente. Sem endereço e token = não conectado. */
export function conexaoZimbra(db: Banco): ConexaoZimbra | null {
  const url = ler(db, CHAVES.url), token = ler(db, CHAVES.token);
  if (url && token) return { url: url.replace(/\/$/, ''), token, agenda: ler(db, CHAVES.agenda), origem: 'banco' };
  const eu = process.env.ZIMBRA_API_URL?.trim(), et = process.env.ZIMBRA_API_TOKEN?.trim();
  if (eu && et) return { url: eu.replace(/\/$/, ''), token: et, agenda: process.env.ZIMBRA_AGENDA?.trim() ?? ler(db, CHAVES.agenda), origem: 'ambiente' };
  return null;
}

/** Agendas do Zimbra que o calendário exibe (lista guardada em Configurações › Calendário). Sem lista: só a agenda da empresa. */
export function agendasExibir(db: Banco): string[] {
  try {
    const v = JSON.parse(ler(db, 'zimbra.agendas_exibir') || 'null');
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 80)).slice(0, 12);
  } catch { /* lista inválida: usa o padrão */ }
  const unica = conexaoZimbra(db)?.agenda; // agenda da empresa (banco ou ZIMBRA_AGENDA)
  return unica ? [unica] : [];
}
export function gravarAgendasExibir(db: Banco, lista: string[]) {
  db.prepare('INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em')
    .run('zimbra.agendas_exibir', JSON.stringify(lista), new Date().toISOString());
}
export const agendaSalva = (db: Banco) => ler(db, CHAVES.agenda);
export const urlSalva = (db: Banco) => ler(db, CHAVES.url);
export const temTokenSalvo = (db: Banco) => ler(db, CHAVES.token) !== '';

export class ErroZimbra extends Error {
  status: number;
  constructor(mensagem: string, status: number) { super(mensagem); this.status = status; }
}

/** Chama o serviço. Erros do serviço viram ErroZimbra com a mensagem em português que ele devolve. */
export async function chamarZimbra<T>(c: ConexaoZimbra, metodo: string, caminho: string, corpo?: unknown, timeoutMs = 20_000): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${c.url}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${c.token}`, ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ErroZimbra('Não foi possível falar com o serviço Zimbra. Confira se ele está ligado e se o endereço está certo.', 502);
  }
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroZimbra(e.erro ?? `O serviço Zimbra respondeu ${r.status}.`, r.status === 401 ? 401 : r.status >= 500 ? 502 : 400);
  }
  return (await r.json()) as T;
}
