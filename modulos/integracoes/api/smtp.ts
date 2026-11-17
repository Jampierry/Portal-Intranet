// Envio de e-mail direto do portal por SMTP (sem o serviço zimbra-mcp). Por padrão usa o MESMO servidor, usuário e senha do CalDAV
// (no Zimbra a conta é a mesma); Configurações › Integrações permite informar outro servidor/conta só para envio, ou variáveis
// SMTP_HOST / SMTP_PORTA / SMTP_USUARIO / SMTP_SENHA / SMTP_REMETENTE. A senha nunca volta para o navegador.
import nodemailer from 'nodemailer';
import type { Banco } from '../../../servidor/src/db.ts';
import { conexaoCalDav } from './caldav.ts';

export interface ConexaoSmtp { host: string; porta: number; usuario: string; senha: string; remetente: string; origem: 'proprio' | 'caldav' | 'ambiente' }

const CHAVES = { host: 'smtp.host', porta: 'smtp.porta', usuario: 'smtp.usuario', senha: 'smtp.senha', remetente: 'smtp.remetente' } as const;
const ler = (db: Banco, chave: string) => (db.prepare('SELECT valor FROM integracoes WHERE chave = ?').get(chave) as { valor: string } | undefined)?.valor ?? '';

export function gravarSmtp(db: Banco, chave: keyof typeof CHAVES, valor: string) {
  if (valor === '') db.prepare('DELETE FROM integracoes WHERE chave = ?').run(CHAVES[chave]);
  else db.prepare('INSERT INTO integracoes (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em').run(CHAVES[chave], valor, new Date().toISOString());
}
export const lerSmtpSalvo = (db: Banco) => ({ host: ler(db, CHAVES.host), porta: ler(db, CHAVES.porta), usuario: ler(db, CHAVES.usuario), senha_salva: ler(db, CHAVES.senha) !== '', remetente: ler(db, CHAVES.remetente) });

/** Servidor de envio: o que foi salvo na tela; senão o ambiente; senão a conta do CalDAV (mesmo servidor, usuário e senha). */
export function conexaoSmtp(db: Banco): ConexaoSmtp | null {
  const host = ler(db, CHAVES.host), usuario = ler(db, CHAVES.usuario), senha = ler(db, CHAVES.senha), porta = Number(ler(db, CHAVES.porta)) || 0, rem = ler(db, CHAVES.remetente);
  if (host && usuario && senha) return { host, porta: porta || 465, usuario, senha, remetente: rem || usuario, origem: 'proprio' };
  const eh = process.env.SMTP_HOST?.trim(), eu = process.env.SMTP_USUARIO?.trim(), es = process.env.SMTP_SENHA;
  if (eh && eu && es) return { host: eh, porta: Number(process.env.SMTP_PORTA) || 465, usuario: eu, senha: es, remetente: process.env.SMTP_REMETENTE?.trim() || eu, origem: 'ambiente' };
  const cd = conexaoCalDav(db);
  if (cd) {
    try {
      const h = host || new URL(cd.url).hostname;
      return { host: h, porta: porta || 465, usuario: usuario || cd.usuario, senha: senha || cd.senha, remetente: rem || usuario || cd.usuario, origem: 'caldav' };
    } catch { return null; }
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tom visual do e-mail: define a cor da faixa e do botão. */
export type TomEmail = 'marca' | 'urgente' | 'neutro';
const CORES: Record<TomEmail, string> = { marca: '#6e3a58', urgente: '#cf4a39', neutro: '#4a4650' };

export interface Mensagem {
  para: string; assunto: string; titulo: string; mensagem: string; app: string; botao_texto?: string; botao_link?: string;
  /** Selo no alto do e-mail (ex.: URGENTE, NOVO COMUNICADO, TESTE). */
  etiqueta?: string; tom?: TomEmail;
  /** Assunto da publicação (ex.: a categoria do comunicado), mostrado ao lado do selo. */
  categoria?: string;
  /** Aviso em destaque dentro do e-mail (ex.: exige confirmação de leitura). */
  destaque?: string;
  /** Frase pequena no rodapé (ex.: como desligar os avisos). */
  rodape?: string;
}

/** Texto e HTML padronizados do aviso: tabelas e estilos em linha (funciona no Zimbra, Outlook e celular), sem imagens externas. */
export function montarEmail(m: Omit<Mensagem, 'para' | 'assunto'>): { text: string; html: string } {
  const link = m.botao_link && /^https?:\/\//i.test(m.botao_link) ? m.botao_link : '';
  const cor = CORES[m.tom ?? 'marca'];
  const rotulo = m.botao_texto ?? 'Abrir no portal';
  const linhas = [
    m.etiqueta ? '[' + m.etiqueta + (m.categoria ? ' · ' + m.categoria : '') + ']' : '',
    m.titulo, '', m.mensagem,
    m.destaque ? '\n' + m.destaque : '',
    link ? '\n' + rotulo + ': ' + link : '',
    '', '— ' + m.app, m.rodape ?? '',
  ];
  const text = linhas.filter((x, i) => x !== '' || i === 2 || i === 6).join('\n');
  const selo = m.etiqueta ? '<span style="display:inline-block;background:' + cor + ';color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.08em;padding:4px 10px;border-radius:99px;text-transform:uppercase">' + esc(m.etiqueta) + '</span>' : '';
  const chip = m.categoria ? '<span style="display:inline-block;margin-left:6px;background:#f1ecee;color:#4a4650;font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px">' + esc(m.categoria) + '</span>' : '';
  const caixa = m.destaque ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0"><tr><td style="background:#fbf4f2;border-left:4px solid ' + cor + ';padding:12px 14px;border-radius:6px;font-size:14px;line-height:1.5;color:#2a2227">' + esc(m.destaque) + '</td></tr></table>' : '';
  const botao = link ? '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0"><tr><td style="background:' + cor + ';border-radius:8px"><a href="' + esc(link) + '" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Segoe UI,Arial,sans-serif">' + esc(rotulo) + ' &rarr;</a></td></tr></table><p style="margin:14px 0 0;font-size:12px;color:#7a6d75;line-height:1.4">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all;color:#4a4650">' + esc(link) + '</span></p>' : '';
  const resumo = esc(m.mensagem.slice(0, 120));
  const html = '<!doctype html><html><body style="margin:0;padding:0;background:#f1ecee">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1ecee">' + resumo + '</div>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1ecee"><tr><td align="center" style="padding:24px 12px">'
    + '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;font-family:Segoe UI,Arial,sans-serif;color:#2a2227">'
    + '<tr><td style="background:#2b2a2d;padding:18px 28px;border-radius:12px 12px 0 0"><span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">' + esc(m.app) + '</span></td></tr>'
    + '<tr><td style="height:5px;line-height:5px;font-size:0;background:' + cor + '">&nbsp;</td></tr>'
    + '<tr><td style="background:#ffffff;padding:28px 28px 30px">' + selo + chip
    + '<h1 style="margin:16px 0 12px;font-size:24px;line-height:1.25;color:#1d1a24">' + esc(m.titulo) + '</h1>'
    + '<p style="margin:0;font-size:16px;line-height:1.6;color:#2a2227;white-space:pre-line">' + esc(m.mensagem) + '</p>' + caixa + botao + '</td></tr>'
    + '<tr><td style="background:#faf7f8;padding:16px 28px;border-radius:0 0 12px 12px;font-size:12px;line-height:1.5;color:#7a6d75">' + esc(m.rodape ?? 'Mensagem automática do portal.') + '</td></tr>'
    + '</table></td></tr></table></body></html>';
  return { text, html };
}

const novoTransporte = (c: ConexaoSmtp) => nodemailer.createTransport({ host: c.host, port: c.porta, secure: c.porta === 465, auth: { user: c.usuario, pass: c.senha }, pool: true, maxConnections: 2, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 });
let guardado: { chave: string; t: ReturnType<typeof novoTransporte> } | null = null;
function transporte(c: ConexaoSmtp) {
  const chave = `${c.host}|${c.porta}|${c.usuario}|${c.senha}`;
  if (guardado?.chave === chave) return guardado.t;
  guardado?.t.close();
  const t = novoTransporte(c);
  guardado = { chave, t };
  return t;
}
export const limparTransporteSmtp = () => { guardado?.t.close(); guardado = null; };

export class ErroSmtp extends Error {}
const traduzir = (e: unknown): string => {
  const x = e as { code?: string; responseCode?: number; message?: string };
  if (x.code === 'EAUTH' || x.responseCode === 535) return 'O servidor de e-mail recusou o usuário ou a senha (ou a conta não pode enviar por SMTP).';
  if (x.code === 'ECONNECTION' || x.code === 'ETIMEDOUT' || x.code === 'ESOCKET' || x.code === 'ENOTFOUND' || x.code === 'ECONNREFUSED') return 'Não foi possível conectar ao servidor de e-mail (confira o endereço e a porta, e se o servidor do portal alcança a rede da empresa).';
  return `Falha ao enviar o e-mail: ${(x.message ?? 'erro desconhecido').slice(0, 160)}`;
};

/** Verifica a conexão e o login sem enviar nada. */
export async function testarSmtp(c: ConexaoSmtp): Promise<void> {
  try { await transporte(c).verify(); } catch (e) { throw new ErroSmtp(traduzir(e)); }
}

/** Envia uma mensagem para cada destinatário (um e-mail por pessoa: ninguém vê o endereço dos outros). Devolve quantos saíram. */
export async function enviarEmails(c: ConexaoSmtp, mensagens: Mensagem[]): Promise<{ enviados: number; falhas: number; erro?: string }> {
  const t = transporte(c);
  let enviados = 0, falhas = 0, erro: string | undefined;
  for (const m of mensagens) {
    const { text, html } = montarEmail(m);
    try { await t.sendMail({ from: `"${m.app.replace(/["\r\n]/g, '')}" <${c.remetente}>`, to: m.para, subject: m.assunto.replace(/[\r\n]+/g, ' ').slice(0, 200), text, html }); enviados++; }
    catch (e) { falhas++; erro ??= traduzir(e); }
  }
  return { enviados, falhas, erro };
}
