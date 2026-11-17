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

export interface Mensagem { para: string; assunto: string; titulo: string; mensagem: string; app: string; botao_texto?: string; botao_link?: string }

/** Texto e HTML padronizados do aviso (cores neutras; sem imagens externas). */
export function montarEmail(m: Omit<Mensagem, 'para'>): { text: string; html: string } {
  const link = m.botao_link && /^https?:\/\//i.test(m.botao_link) ? m.botao_link : '';
  const text = `${m.titulo}\n\n${m.mensagem}\n${link ? `\n${m.botao_texto ?? 'Abrir'}: ${link}\n` : ''}\n— ${m.app}`;
  const botao = link ? `<p style="margin:20px 0 0"><a href="${esc(link)}" style="background:#6b2c4a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${esc(m.botao_texto ?? 'Abrir')}</a></p>` : '';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f1f3;padding:24px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;color:#2a2227"><h2 style="margin:0 0 12px;font-size:20px">${esc(m.titulo)}</h2><p style="margin:0;line-height:1.5;white-space:pre-line">${esc(m.mensagem)}</p>${botao}<p style="margin:24px 0 0;font-size:12px;color:#7a6d75">${esc(m.app)}</p></div></div>`;
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
