// Ticket do login em duas etapas: a senha já foi conferida e falta o segundo fator (biometria).
// Vive em memória por 5 minutos, vale para uma pessoa e para uma conclusão; erros seguidos o derrubam.
import { randomBytes } from 'node:crypto';

interface Ticket { usuarioId: number; manter: boolean; expira: number; falhas: number }
const tickets = new Map<string, Ticket>();
const VALE_MS = 5 * 60_000;
export const MAX_FALHAS_TICKET = 5;

export function criarTicket(usuarioId: number, manter: boolean): string {
  const agora = Date.now();
  for (const [k, v] of tickets) if (v.expira < agora) tickets.delete(k);
  const t = randomBytes(24).toString('base64url');
  tickets.set(t, { usuarioId, manter, expira: agora + VALE_MS, falhas: 0 });
  return t;
}
/** Consulta sem gastar. */
export function lerTicket(t: unknown): Ticket | null {
  const x = typeof t === 'string' ? tickets.get(t) : undefined;
  if (!x || x.expira < Date.now()) { if (typeof t === 'string') tickets.delete(t); return null; }
  return x;
}
export const gastarTicket = (t: string) => { tickets.delete(t); };
/** Conta um erro; ao chegar no limite o ticket morre e a pessoa recomeça pela senha. */
export function falharTicket(t: string): void {
  const x = tickets.get(t);
  if (!x) return;
  x.falhas += 1;
  if (x.falhas >= MAX_FALHAS_TICKET) tickets.delete(t);
}
