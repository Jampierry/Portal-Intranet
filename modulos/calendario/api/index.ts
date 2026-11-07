// Calendário de datas importantes: lê (e, com permissão, cria/exclui) eventos da agenda da empresa no Zimbra pelo serviço zimbra-mcp.
// O portal chama o serviço pelo SERVIDOR (o token nunca vai ao navegador) e só repassa o necessário (sem organizador).
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { ErroValidacao, corpoObjeto, texto } from '../../../servidor/src/validar.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { chamarZimbra, conexaoZimbra, ErroZimbra } from '../../integracoes/api/zimbra.ts';

export interface EventoPublico { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string }
interface EventoZimbra extends EventoPublico { agenda?: string }

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { em: number; eventos: EventoPublico[] }>();
const DIA = 86_400_000;

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

async function buscar(db: Banco, mes: string): Promise<EventoPublico[]> {
  const c = conexaoZimbra(db)!;
  const { primeiroDia, ultimoDia, diasAntes, dias } = limitesDoMes(mes);
  const q = new URLSearchParams({ dias: String(Math.min(dias, 365)), dias_antes: String(Math.min(diasAntes, 365)), agenda: c.agenda });
  const lista = await chamarZimbra<EventoZimbra[]>(c, 'GET', `/api/eventos?${q}`, undefined, 15_000);
  return lista
    .filter((e) => e.inicio.slice(0, 10) <= ultimoDia && (e.fim || e.inicio).slice(0, 10) >= primeiroDia)
    .map((e) => ({ id: String(e.id), titulo: String(e.titulo).slice(0, 120), inicio: e.inicio, fim: e.fim || e.inicio, dia_inteiro: !!e.dia_inteiro, local: String(e.local ?? '').slice(0, 120) }));
}

const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const dataValida = (s: string) => DATA.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);

export async function rotasCalendario(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get<{ Querystring: { mes?: string } }>('/api/calendario', { preHandler: exigirPerm('ver.calendario') }, async (req) => {
    const hoje = new Date();
    const mes = req.query.mes ?? `${hoje.getFullYear()}-${doisDig(hoje.getMonth() + 1)}`;
    limitesDoMes(mes); // valida (400 se inválido)
    const conexao = conexaoZimbra(db);
    if (!conexao) return { conectado: false, eventos: [] };
    // Privacidade: só se lê uma agenda escolhida de propósito (a conta pode ter agendas pessoais e de salas que não são para todos).
    if (!conexao.agenda) return { conectado: true, sem_agenda: true, eventos: [] };
    const guardado = cache.get(mes);
    if (guardado && Date.now() - guardado.em < CACHE_MS) return { conectado: true, eventos: guardado.eventos };
    try {
      const eventos = await buscar(db, mes);
      cache.set(mes, { em: Date.now(), eventos });
      return { conectado: true, eventos };
    } catch (e) {
      app.log.warn({ erro: (e as Error).message }, 'calendario: Zimbra indisponível');
      // Se der erro, mostra o último resultado conhecido (mesmo velho) em vez de esvaziar o calendário.
      return { conectado: true, erro: 'A agenda da empresa está indisponível no momento.', eventos: guardado?.eventos ?? [] };
    }
  });

  // Cadastrar data importante: vira um evento na agenda da empresa (dia inteiro por padrão).
  app.post('/api/calendario', { preHandler: exigirPerm('calendario.criar') }, async (req, resp) => {
    const c = corpoObjeto(req.body);
    const titulo = String(texto(c, 'titulo', 'Título', { min: 2, max: 100 }));
    const local = texto(c, 'local', 'Local', { max: 100, opcional: true }) ?? '';
    const inicioDia = String(c.data ?? '');
    const fimDia = String(c.data_fim ?? inicioDia);
    if (!dataValida(inicioDia) || !dataValida(fimDia)) throw new ErroValidacao('Data: informe uma data válida.');
    if (fimDia < inicioDia) throw new ErroValidacao('A data final não pode ser anterior à inicial.');
    const diaInteiro = c.dia_inteiro !== false;
    const hi = String(c.hora_inicio ?? '09:00'), hf = String(c.hora_fim ?? '10:00');
    if (!diaInteiro && (!HORA.test(hi) || !HORA.test(hf) || (inicioDia === fimDia && hf <= hi))) throw new ErroValidacao('Horário: informe início e fim válidos (fim depois do início).');
    const conexao = conexaoZimbra(db);
    if (!conexao) return resp.code(400).send({ erro: 'A agenda ainda não está conectada ao Zimbra (Configurações › Integrações).' });
    if (!conexao.agenda) return resp.code(400).send({ erro: 'Escolha a agenda da empresa em Configurações › Integrações antes de cadastrar datas.' });
    try {
      const r = await chamarZimbra<{ id: string }>(conexao, 'POST', '/api/eventos', {
        titulo, local, agenda: conexao.agenda, dia_inteiro: diaInteiro,
        inicio: diaInteiro ? inicioDia : `${inicioDia} ${hi}`, fim: diaInteiro ? fimDia : `${fimDia} ${hf}`,
      }, 30_000);
      cache.clear();
      auditar(db, req.usuario!.id, 'data_importante_criada', { titulo, data: inicioDia });
      return resp.code(201).send({ id: String(r.id) });
    } catch (e) {
      if (e instanceof ErroZimbra) return resp.code(e.status).send({ erro: e.message });
      throw e;
    }
  });

  app.delete<{ Params: { id: string } }>('/api/calendario/:id', { preHandler: exigirPerm('calendario.excluir') }, async (req, resp) => {
    if (!/^[\w.:-]{1,60}$/.test(req.params.id)) throw new ErroValidacao('Identificador inválido.');
    const conexao = conexaoZimbra(db);
    if (!conexao) return resp.code(400).send({ erro: 'A agenda ainda não está conectada ao Zimbra.' });
    try {
      await chamarZimbra(conexao, 'DELETE', `/api/eventos/${encodeURIComponent(req.params.id)}`, undefined, 30_000);
      cache.clear();
      auditar(db, req.usuario!.id, 'data_importante_excluida', { id: req.params.id });
      return { ok: true };
    } catch (e) {
      if (e instanceof ErroZimbra) return resp.code(e.status).send({ erro: e.message });
      throw e;
    }
  });
}

/** Só para os testes. */
export const limparCacheCalendario = () => cache.clear();
