// Calendário da empresa: datas locais (feriados, facultativos, eventos, cadastradas em Configurações › Calendário) e agendas do Zimbra
// (lidas, e com permissão criadas/excluídas, pelo serviço zimbra-mcp). O portal chama o serviço pelo SERVIDOR (o token nunca vai ao
// navegador) e só repassa o necessário (sem organizador).
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { ErroValidacao, corpoObjeto, escolha, texto } from '../../../servidor/src/validar.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { agendasExibir, chamarZimbra, conexaoZimbra, ErroZimbra, gravarAgendasExibir } from '../../integracoes/api/zimbra.ts';
import { feriadosDoAno, type TipoData } from './feriados.ts';
import { lerEmpresa } from '../../marca/api/index.ts';

export interface EventoPublico { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string; agenda: string }
export interface DataLocal { id: number; data: string; data_fim: string; titulo: string; tipo: TipoData; anual: boolean }
interface EventoZimbra extends Omit<EventoPublico, 'agenda'> { agenda?: string }
const TIPOS_DATA = ['feriado', 'municipal', 'facultativo', 'evento'] as const;

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

async function buscar(db: Banco, mes: string, agenda: string): Promise<EventoPublico[]> {
  const c = conexaoZimbra(db)!;
  const { primeiroDia, ultimoDia, diasAntes, dias } = limitesDoMes(mes);
  const q = new URLSearchParams({ dias: String(Math.min(dias, 365)), dias_antes: String(Math.min(diasAntes, 365)), agenda });
  const lista = await chamarZimbra<EventoZimbra[]>(c, 'GET', `/api/eventos?${q}`, undefined, 15_000);
  return lista
    .filter((e) => e.inicio.slice(0, 10) <= ultimoDia && (e.fim || e.inicio).slice(0, 10) >= primeiroDia)
    .map((e) => ({ id: String(e.id), titulo: String(e.titulo).slice(0, 120), inicio: e.inicio, fim: e.fim || e.inicio, dia_inteiro: !!e.dia_inteiro, local: String(e.local ?? '').slice(0, 120), agenda }));
}

/** Datas locais (feriados, facultativos, eventos) que tocam o mês; as anuais valem em qualquer ano. */
export function datasDoMes(db: Banco, mes: string): DataLocal[] {
  const { primeiroDia, ultimoDia } = limitesDoMes(mes);
  const ano = Number(mes.slice(0, 4));
  const linhas = db.prepare('SELECT id, data, data_fim, titulo, tipo, anual FROM calendario_datas ORDER BY data').all() as { id: number; data: string; data_fim: string | null; titulo: string; tipo: TipoData; anual: number }[];
  const out: DataLocal[] = [];
  for (const l of linhas) {
    let ini = l.data, fim = l.data_fim || l.data;
    if (l.anual) {
      const dur = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${ini}T12:00:00Z`)) / DIA);
      ini = `${ano}${l.data.slice(4)}`;
      if (Number.isNaN(Date.parse(`${ini}T12:00:00Z`)) || !new Date(`${ini}T12:00:00Z`).toISOString().startsWith(ini)) continue; // 29/02 em ano comum
      fim = new Date(Date.parse(`${ini}T12:00:00Z`) + dur * DIA).toISOString().slice(0, 10);
    }
    if (ini <= ultimoDia && fim >= primeiroDia) out.push({ id: l.id, data: ini, data_fim: fim, titulo: l.titulo, tipo: l.tipo, anual: !!l.anual });
  }
  return out;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const dataValida = (s: string) => DATA.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);

export async function rotasCalendario(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get<{ Querystring: { mes?: string } }>('/api/calendario', { preHandler: exigirPerm('ver.calendario') }, async (req) => {
    const hoje = new Date();
    const mes = req.query.mes ?? `${hoje.getFullYear()}-${doisDig(hoje.getMonth() + 1)}`;
    limitesDoMes(mes); // valida (400 se inválido)
    const datas = datasDoMes(db, mes); // locais: valem mesmo sem Zimbra
    const conexao = conexaoZimbra(db);
    if (!conexao) return { conectado: false, eventos: [], datas };
    // Privacidade: só se leem as agendas escolhidas de propósito (a conta pode ter agendas pessoais e de salas que não são para todos).
    const agendas = agendasExibir(db);
    if (!agendas.length) return { conectado: true, sem_agenda: true, eventos: [], datas };
    const eventos: EventoPublico[] = [];
    let falhou = false;
    await Promise.all(agendas.map(async (ag) => {
      const chave = `${mes}|${ag}`, guardado = cache.get(chave);
      if (guardado && Date.now() - guardado.em < CACHE_MS) { eventos.push(...guardado.eventos); return; }
      try { const lista = await buscar(db, mes, ag); cache.set(chave, { em: Date.now(), eventos: lista }); eventos.push(...lista); }
      catch (e) {
        app.log.warn({ erro: (e as Error).message, agenda: ag }, 'calendario: Zimbra indisponível');
        falhou = true; // mostra o último resultado conhecido (mesmo velho) em vez de esvaziar o calendário
        if (guardado) eventos.push(...guardado.eventos);
      }
    }));
    eventos.sort((x, y) => x.inicio.localeCompare(y.inicio));
    if (!falhou) return { conectado: true, eventos, datas };
    return { conectado: true, erro: agendas.length === 1 ? 'A agenda da empresa está indisponível no momento.' : 'Parte das agendas da empresa está indisponível no momento.', eventos, datas };
  });

  // ----- Configurações › Calendário: datas locais e agendas do Zimbra exibidas -----
  const ver = { preHandler: exigirPerm('calendario.criar', 'calendario.excluir', 'calendario.agendas') };
  const editar = { preHandler: exigirPerm('calendario.criar') }, excluir = { preHandler: exigirPerm('calendario.excluir') }, agendasPerm = { preHandler: exigirPerm('calendario.agendas') };
  const lerData = (c: Record<string, unknown>) => {
    const titulo = String(texto(c, 'titulo', 'Título', { min: 2, max: 100 }));
    const data = String(c.data ?? ''), fim = c.data_fim ? String(c.data_fim) : '';
    if (!dataValida(data) || (fim && !dataValida(fim))) throw new ErroValidacao('Data: informe uma data válida.');
    if (fim && fim < data) throw new ErroValidacao('A data final não pode ser anterior à inicial.');
    return { titulo, data, data_fim: fim || null, tipo: escolha(c, 'tipo', 'Tipo', TIPOS_DATA), anual: c.anual ? 1 : 0 };
  };
  const linha = (id: number | bigint) => db.prepare('SELECT id, data, data_fim, titulo, tipo, anual FROM calendario_datas WHERE id = ?').get(Number(id));

  app.get('/api/gestao/calendario/datas', ver, async () => db.prepare('SELECT id, data, data_fim, titulo, tipo, anual FROM calendario_datas ORDER BY data').all());
  app.post('/api/gestao/calendario/datas', editar, async (req, resp) => {
    const d = lerData(corpoObjeto(req.body));
    const r = db.prepare('INSERT INTO calendario_datas (data, data_fim, titulo, tipo, anual, criado_em) VALUES (?, ?, ?, ?, ?, ?)').run(d.data, d.data_fim, d.titulo, d.tipo, d.anual, new Date().toISOString());
    auditar(db, req.usuario!.id, 'calendario_data_criada', { titulo: d.titulo, data: d.data, tipo: d.tipo });
    return resp.code(201).send(linha(r.lastInsertRowid));
  });
  app.put<{ Params: { id: string } }>('/api/gestao/calendario/datas/:id', editar, async (req, resp) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !linha(id)) return resp.code(404).send({ erro: 'Data não encontrada.' });
    const d = lerData(corpoObjeto(req.body));
    db.prepare('UPDATE calendario_datas SET data = ?, data_fim = ?, titulo = ?, tipo = ?, anual = ? WHERE id = ?').run(d.data, d.data_fim, d.titulo, d.tipo, d.anual, id);
    auditar(db, req.usuario!.id, 'calendario_data_alterada', { id, titulo: d.titulo, data: d.data });
    return linha(id);
  });
  app.delete<{ Params: { id: string } }>('/api/gestao/calendario/datas/:id', excluir, async (req, resp) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !linha(id)) return resp.code(404).send({ erro: 'Data não encontrada.' });
    db.prepare('DELETE FROM calendario_datas WHERE id = ?').run(id);
    auditar(db, req.usuario!.id, 'calendario_data_apagada', { id });
    return { ok: true };
  });
  // Gera os feriados do ano (sem duplicar o que já existe na mesma data com o mesmo título).
  app.post('/api/gestao/calendario/feriados', editar, async (req) => {
    const ano = Number(corpoObjeto(req.body).ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new ErroValidacao('Ano: informe um ano entre 2000 e 2100.');
    const existe = db.prepare('SELECT 1 FROM calendario_datas WHERE titulo = ? AND (data = ? OR (anual = 1 AND substr(data, 6) = substr(?, 6)))');
    const ins = db.prepare('INSERT INTO calendario_datas (data, data_fim, titulo, tipo, anual, criado_em) VALUES (?, NULL, ?, ?, ?, ?)');
    let novos = 0;
    for (const f of feriadosDoAno(ano, lerEmpresa(db).feriados_municipais)) if (!existe.get(f.titulo, f.data, f.data)) { ins.run(f.data, f.titulo, f.tipo, f.anual ? 1 : 0, new Date().toISOString()); novos++; }
    auditar(db, req.usuario!.id, 'calendario_feriados_gerados', { ano, novos });
    return { novos };
  });
  // Agendas do Zimbra: o que existe na conta e o que o calendário exibe.
  app.get('/api/gestao/calendario/agendas', ver, async () => {
    const c = conexaoZimbra(db), exibir = agendasExibir(db);
    if (!c) return { conectado: false, exibir, disponiveis: [] as string[] };
    try {
      const lista = await chamarZimbra<Record<string, unknown>[]>(c, 'GET', '/api/agendas', undefined, 20_000);
      const nomes = lista.map((a) => String(a.nome ?? a.name ?? a.id ?? '')).filter(Boolean);
      return { conectado: true, exibir, disponiveis: [...new Set([...nomes, ...exibir])] };
    } catch (e) { return { conectado: true, exibir, disponiveis: [...exibir], erro: e instanceof ErroZimbra ? e.message : 'Não foi possível listar as agendas.' }; }
  });
  app.put('/api/gestao/calendario/agendas', agendasPerm, async (req) => {
    const lista = corpoObjeto(req.body).exibir;
    if (!Array.isArray(lista) || lista.length > 12 || lista.some((x) => typeof x !== 'string' || !x.trim() || x.length > 80)) throw new ErroValidacao('Agendas: envie uma lista de até 12 nomes.');
    gravarAgendasExibir(db, [...new Set((lista as string[]).map((x) => x.trim()))]);
    cache.clear();
    auditar(db, req.usuario!.id, 'calendario_agendas_alteradas', { agendas: lista.length });
    return { ok: true };
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
    if (!/^[\w.:~@=+-]{1,400}$/.test(req.params.id)) throw new ErroValidacao('Identificador inválido.');
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
