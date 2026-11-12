// Identidade do portal (reutilizável por qualquer empresa): nome, textos, ícone e feriados municipais (Configurações › Empresa)
// e a lateral da tela de entrada (Configurações › Tela de entrada). A leitura e as imagens são públicas, porque o login
// aparece antes de entrar; só quem tem a permissão cfg.empresa.editar / cfg.entrada.editar altera.
import type { FastifyInstance } from 'fastify';
import type { Banco } from '../../../servidor/src/db.ts';
import { corpoObjeto, dataIso, ErroValidacao } from '../../../servidor/src/validar.ts';
import { auditar, exigirPerm } from '../../acessos/api/guard.ts';
import { enviarImagem, enviarVideo, guardarImagem, guardarVideo, LIMITE_VIDEO, lerImagem } from '../../imagens/api/index.ts';

export interface FeriadoMunicipal { titulo: string; dia: number; mes: number }
export interface ConfigEmpresa {
  nome: string;
  nome_portal: string;
  slogan: string;
  frase_rodape: string;
  lema: string[];
  rotulo_destaque: string;
  lema_destaque: string[];
  logo: string | null;
  /** Logo da empresa (imagem larga) que substitui o nome escrito no menu e no login. */
  logo_nome: string | null;
  /** Versão da logo para o tema escuro (a anterior vale para o tema claro). */
  logo_nome_escuro: string | null;
  feriados_municipais: FeriadoMunicipal[];
  /** Data de fundação (AAAA-MM-DD, opcional): o Início mostra a contagem regressiva do aniversário da empresa. */
  fundacao: string | null;
}
export interface ConfigEntrada {
  fundo: 'cor' | 'imagem' | 'carrossel';
  /** Carrossel: várias imagens/vídeos, na ordem. */
  imagens: string[];
  /** Imagem ou vídeo fixo (no máximo 1). Lista própria: não se mistura com a do carrossel. */
  fixa: string[];
  intervalo: number;
  escurecer: number;
  linhas: string[];
  rodape: string;
  texto_extra: string;
}
/** Padrões neutros: uma instalação nova não carrega o nome de nenhuma empresa. */
export const PADRAO_EMPRESA: ConfigEmpresa = {
  nome: 'Sua Empresa', nome_portal: 'Portal Intranet', slogan: '', frase_rodape: 'Conectando pessoas, ideias e grandes movimentos.',
  lema: ['SONHAR', 'FAZ PARTE', 'DO NOSSO', 'MOVIMENTO'], rotulo_destaque: 'DESTAQUE', lema_destaque: ['PESSOAS', 'MOVIMENTO', 'RESULTADOS', 'SEMPRE'],
  logo: null, logo_nome: null, logo_nome_escuro: null, feriados_municipais: [], fundacao: null,
};
export const PADRAO_ENTRADA: ConfigEntrada = { fundo: 'cor', imagens: [], fixa: [], intervalo: 6, escurecer: 35, linhas: [], rodape: '', texto_extra: '' };

const URL_IMAGEM = /^\/api\/publico\/imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif|ico|svg)$/;
/** Fundo da tela de entrada: imagem ou vídeo curto (MP4/WebM). */
const URL_FUNDO = /^\/api\/publico\/(imagens\/[a-f0-9]{24}\.(png|jpg|webp|gif|ico|svg)|videos\/[a-f0-9]{24}\.(mp4|webm))$/;

function ler<T>(db: Banco, chave: string, padrao: T): T {
  const r = db.prepare('SELECT valor FROM portal_config WHERE chave = ?').get(chave) as { valor: string } | undefined;
  if (!r) return structuredClone(padrao);
  try { return { ...structuredClone(padrao), ...(JSON.parse(r.valor) as Partial<T>) }; } catch { return structuredClone(padrao); }
}
function gravar(db: Banco, chave: string, valor: unknown) {
  db.prepare('INSERT INTO portal_config (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em')
    .run(chave, JSON.stringify(valor), new Date().toISOString());
}
export const lerEmpresa = (db: Banco) => ler(db, 'empresa', PADRAO_EMPRESA);
/** Configurações antigas guardavam a imagem fixa dentro de `imagens`; passa para a lista própria da fixa. */
export const lerEntrada = (db: Banco): ConfigEntrada => {
  const e = ler(db, 'entrada', PADRAO_ENTRADA);
  if (!Array.isArray(e.fixa)) e.fixa = [];
  if (e.fundo === 'imagem' && e.fixa.length === 0 && e.imagens.length > 0) { e.fixa = e.imagens.slice(0, 1); e.imagens = []; }
  return e;
};
const urlsDaEntrada = (db: Banco) => { const e = lerEntrada(db); return [...e.imagens, ...e.fixa]; };

const curto = (v: unknown, rotulo: string, max: number, obrigatorio = false) => {
  const s = String(v ?? '').trim();
  if (obrigatorio && !s) throw new ErroValidacao(`${rotulo}: preencha.`);
  if (s.length > max) throw new ErroValidacao(`${rotulo}: no máximo ${max} caracteres.`);
  return s;
};
const listaDeLinhas = (v: unknown, rotulo: string) => {
  const linhas = (Array.isArray(v) ? v : []).map((l) => String(l).trim()).filter(Boolean);
  if (linhas.length > 5 || linhas.some((l) => l.length > 40)) throw new ErroValidacao(`${rotulo}: até 5 linhas de 40 caracteres.`);
  return linhas;
};
const imagemPropria = (v: unknown, rotulo: string) => {
  if (!v) return null;
  const s = String(v);
  if (!URL_IMAGEM.test(s)) throw new ErroValidacao(`${rotulo}: use só uma imagem enviada por esta tela.`);
  return s;
};

function validarEmpresa(c: Record<string, unknown>): ConfigEmpresa {
  const feriados = (Array.isArray(c.feriados_municipais) ? c.feriados_municipais : []).map((f) => {
    const o = (f ?? {}) as Record<string, unknown>, dia = Number(o.dia), mes = Number(o.mes);
    const ok = Number.isInteger(dia) && Number.isInteger(mes) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(2024, mes, 0).getDate();
    if (!ok) throw new ErroValidacao('Feriado municipal: informe um dia e um mês válidos.');
    return { titulo: curto(o.titulo, 'Feriado municipal', 80, true), dia, mes };
  });
  if (feriados.length > 10) throw new ErroValidacao('Feriados municipais: no máximo 10.');
  return {
    nome: curto(c.nome, 'Nome da empresa', 40, true), nome_portal: curto(c.nome_portal, 'Nome do portal', 40, true),
    slogan: curto(c.slogan, 'Slogan', 60), frase_rodape: curto(c.frase_rodape, 'Frase do rodapé', 120),
    lema: listaDeLinhas(c.lema, 'Frase dos painéis'), rotulo_destaque: curto(c.rotulo_destaque, 'Rótulo do destaque', 20), lema_destaque: listaDeLinhas(c.lema_destaque, 'Frase do destaque'), logo: imagemPropria(c.logo, 'Ícone'), logo_nome: imagemPropria(c.logo_nome, 'Logo do tema claro'), logo_nome_escuro: imagemPropria(c.logo_nome_escuro, 'Logo do tema escuro'), feriados_municipais: feriados, fundacao: dataIso(c, 'fundacao', 'Data de fundação'),
  };
}
function validarEntrada(c: Record<string, unknown>): ConfigEntrada {
  const fundo = String(c.fundo ?? 'cor');
  if (!['cor', 'imagem', 'carrossel'].includes(fundo)) throw new ErroValidacao('Fundo: escolha cor, imagem ou carrossel.');
  const imagens = Array.isArray(c.imagens) ? c.imagens.map(String) : [];
  const fixa = Array.isArray(c.fixa) ? c.fixa.map(String) : [];
  if (imagens.length > 8) throw new ErroValidacao('Carrossel: no máximo 8 imagens ou vídeos.');
  if (fixa.length > 1) throw new ErroValidacao('Imagem fixa: apenas uma imagem ou vídeo.');
  if ([...imagens, ...fixa].some((u) => !URL_FUNDO.test(u))) throw new ErroValidacao('Imagens: use só imagens ou vídeos enviados por esta tela.');
  if (fundo === 'imagem' && fixa.length === 0) throw new ErroValidacao('Envie a imagem ou o vídeo fixo, ou escolha outro tipo de fundo.');
  if (fundo === 'carrossel' && imagens.length === 0) throw new ErroValidacao('Envie ao menos uma imagem ou vídeo para o carrossel, ou escolha outro tipo de fundo.');
  const intervalo = Number(c.intervalo ?? 6), escurecer = Number(c.escurecer ?? 35);
  if (!Number.isInteger(intervalo) || intervalo < 3 || intervalo > 30) throw new ErroValidacao('Tempo de troca: entre 3 e 30 segundos.');
  if (!Number.isInteger(escurecer) || escurecer < 0 || escurecer > 80) throw new ErroValidacao('Escurecer a imagem: entre 0 e 80.');
  return { fundo: fundo as ConfigEntrada['fundo'], imagens, fixa, intervalo, escurecer, linhas: listaDeLinhas(c.linhas, 'Frase'), rodape: curto(c.rodape, 'Texto pequeno', 60), texto_extra: curto(c.texto_extra, 'Texto extra', 200) };
}

export async function rotasMarca(app: FastifyInstance, { db }: { db: Banco; producao: boolean }) {
  app.get('/api/empresa', async (_req, resp) => resp.header('Cache-Control', 'no-cache').send(lerEmpresa(db)));
  app.get('/api/entrada', async (_req, resp) => resp.header('Cache-Control', 'no-cache').send(lerEntrada(db)));

  // Só entrega imagens que alguma configuração usa (o resto da pasta de imagens continua exigindo login).
  app.get<{ Params: { nome: string } }>('/api/publico/imagens/:nome', async (req, resp) => {
    const m = /^[a-f0-9]{24}\.(png|jpg|webp|gif|ico|svg)$/.exec(req.params.nome);
    const url = `/api/publico/imagens/${req.params.nome}`;
    const emp = lerEmpresa(db), usada = urlsDaEntrada(db).includes(url) || emp.logo === url || emp.logo_nome === url || emp.logo_nome_escuro === url;
    const img = m && usada ? lerImagem(db, req.params.nome) : null;
    if (!img) return resp.code(404).send({ erro: 'Imagem não encontrada.' });
    return enviarImagem(resp, img, true);
  });

  // Vídeo de fundo da entrada: só entrega o que a configuração usa (o login aparece antes de entrar).
  app.get<{ Params: { nome: string } }>('/api/publico/videos/:nome', async (req, resp) => {
    const usado = urlsDaEntrada(db).includes(`/api/publico/videos/${req.params.nome}`);
    if (!usado || !enviarVideo(db, req, resp, req.params.nome, true)) return resp.code(404).send({ erro: 'Vídeo não encontrado.' });
    return resp;
  });
  app.post('/api/gestao/entrada/videos', { preHandler: exigirPerm('cfg.entrada.editar'), bodyLimit: LIMITE_VIDEO }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha um vídeo MP4 ou WebM.' });
    const salvo = guardarVideo(db, corpo);
    if (!salvo) return resp.code(400).send({ erro: 'Arquivo não reconhecido como vídeo MP4 ou WebM (até 40 MB).' });
    auditar(db, req.usuario!.id, 'entrada_video_enviado', { nome: salvo.nome, bytes: corpo.length });
    return resp.code(201).send({ url: `/api/publico/videos/${salvo.nome}` });
  });

  app.addContentTypeParser('image/svg+xml', { parseAs: 'buffer', bodyLimit: 1024 * 1024 }, (_req, corpo, feito) => feito(null, corpo));
  const envio = (perm: string, acao: string) => app.post('/api/gestao/' + acao + '/imagens', { preHandler: exigirPerm(perm), bodyLimit: 5 * 1024 * 1024 }, async (req, resp) => {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) return resp.code(400).send({ erro: 'Escolha uma imagem PNG, JPG, WebP ou GIF.' });
    const salvo = guardarImagem(db, corpo, { aceitarSvg: acao === 'empresa' });
    if (!salvo) return resp.code(400).send({ erro: acao === 'empresa' ? 'Arquivo não reconhecido como imagem PNG, JPG, WebP, GIF ou SVG (sem scripts).' : 'Arquivo não reconhecido como imagem PNG, JPG, WebP ou GIF.' });
    auditar(db, req.usuario!.id, `${acao}_imagem_enviada`, { nome: salvo.nome, bytes: corpo.length });
    return resp.code(201).send({ url: `/api/publico/imagens/${salvo.nome}` });
  });
  envio('cfg.empresa.editar', 'empresa');
  envio('cfg.entrada.editar', 'entrada');

  app.put('/api/gestao/empresa', { preHandler: exigirPerm('cfg.empresa.editar') }, async (req) => {
    const nova = validarEmpresa(corpoObjeto(req.body));
    gravar(db, 'empresa', nova);
    auditar(db, req.usuario!.id, 'empresa_alterada', { nome: nova.nome });
    return nova;
  });
  app.put('/api/gestao/entrada', { preHandler: exigirPerm('cfg.entrada.editar') }, async (req) => {
    const nova = validarEntrada(corpoObjeto(req.body));
    gravar(db, 'entrada', nova);
    auditar(db, req.usuario!.id, 'entrada_alterada', { fundo: nova.fundo, imagens: nova.imagens.length, fixa: nova.fixa.length });
    return nova;
  });
}
