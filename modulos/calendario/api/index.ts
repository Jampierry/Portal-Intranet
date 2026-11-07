// Calendário de datas importantes: lê a agenda da empresa no Zimbra pelo serviço zimbra-mcp (MCP/zimbra-mcp).
// O portal chama o serviço pelo SERVIDOR (o token nunca vai ao navegador) e só repassa o necessário (sem organizador).
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { ErroValidacao } from '../../../servidor/src/validar.ts';

export interface EventoPublico { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string }
interface EventoZimbra extends EventoPublico { agenda?: string }

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { em: number; eventos: EventoPublico[] }>();
const DIA = 86_400_000;

/** Endereço e token do serviço zimbra-mcp (lidos a cada chamada, para poder configurar sem reiniciar). */
function conexao() {
  const url = process.env.ZIMBRA_API_URL?.trim(), token = process.env.ZIMBRA_API_TOKEN?.trim();
  return url && token ? { url: url.replace(/\/$/, ''), token, agenda: process.env.ZIMBRA_AGENDA?.trim() ?? '' } : null;
}

const doisDig = (n: number) => String(n).padStart(2, '0');
const hojeLocal = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };

export function limitesDoMes(mes: string) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
  if (!m) throw new ErroValidacao('Mês: use o formato AAAA-MM.');
  const ano = Number(m[1]), mm = Number(m[2]);
  const primeiro = Date.UTC(ano, mm - 1, 1), ultimo = Date.UTC(ano, mm, 0);
  const hoje = hojeLocal();
  if (primeiro < hoje - 360 * DIA || primeiro > hoje + 360 * DIA) throw new ErroValidacao('Mês fora do período disponível (até 12 meses para trás ou para frente).');
  const iso = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${doisDig(d.getUTCMonth() + 1)}-${doisDig(d.getUTCDate())}`; };
  return {
    primeiroDia: iso(primeiro), ultimoDia: iso(ultimo),
    diasAntes: Math.max(0, Math.round((hoje - primeiro) / DIA)),
    dias: Math.max(1, Math.round((ultimo - hoje) / DIA)),
  };
}

async function buscar(mes: string): Promise<EventoPublico[]> {
  const c = conexao()!;
  const { primeiroDia, ultimoDia, diasAntes, dias } = limitesDoMes(mes);
  const q = new URLSearchParams({ dias: String(Math.min(dias, 365)), dias_antes: String(Math.min(diasAntes, 365)), agenda: c.agenda });
  const r = await fetch(`${c.url}/api/eventos?${q}`, { headers: { Authorization: `Bearer ${c.token}` }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Zimbra ${r.status}`);
  const lista = (await r.json()) as EventoZimbra[];
  return lista
    .filter((e) => e.inicio.slice(0, 10) <= ultimoDia && (e.fim || e.inicio).slice(0, 10) >= primeiroDia)
    .map((e) => ({ id: String(e.id), titulo: String(e.titulo).slice(0, 120), inicio: e.inicio, fim: e.fim || e.inicio, dia_inteiro: !!e.dia_inteiro, local: String(e.local ?? '').slice(0, 120) }));
}

export async function rotasCalendario(app: FastifyInstance, _: { db: Banco; producao: boolean }) {
  app.get<{ Querystring: { mes?: string } }>('/api/calendario', async (req) => {
    const hoje = new Date();
    const mes = req.query.mes ?? `${hoje.getFullYear()}-${doisDig(hoje.getMonth() + 1)}`;
    limitesDoMes(mes); // valida (400 se inválido)
    if (!conexao()) return { conectado: false, eventos: [] };
    const guardado = cache.get(mes);
    if (guardado && Date.now() - guardado.em < CACHE_MS) return { conectado: true, eventos: guardado.eventos };
    try {
      const eventos = await buscar(mes);
      cache.set(mes, { em: Date.now(), eventos });
      return { conectado: true, eventos };
    } catch (e) {
      app.log.warn({ erro: (e as Error).message }, 'calendario: Zimbra indisponível');
      // Se der erro, mostra o último resultado conhecido (mesmo velho) em vez de esvaziar o calendário.
      return { conectado: true, erro: 'A agenda da empresa está indisponível no momento.', eventos: guardado?.eventos ?? [] };
    }
  });
}

/** Só para os testes. */
export const limparCacheCalendario = () => cache.clear();
