// Regra de abertura de aplicações externas (docs/requisitos.md, RF-04b):
// computador = nova aba (o portal continua aberto); celular = mesma aba (Voltar do navegador retorna).
export const LARGURA_DESKTOP = 861;

export interface ModoAbertura { target: '_blank' | '_self'; rel?: string }

export function modoAbertura(larguraJanela: number): ModoAbertura {
  return larguraJanela >= LARGURA_DESKTOP ? { target: '_blank', rel: 'noopener noreferrer' } : { target: '_self' };
}

/** Aceita só endereços http(s): evita `javascript:` vindo de dados. */
export function urlSegura(url: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}
