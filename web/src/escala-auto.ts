// Escala automática: em janelas menores que o "tamanho de projeto" (ex.: monitor de 19", notebook), o portal é reduzido na
// mesma proporção em vez de mudar de layout. Assim a tela fica igual à de um monitor grande, só menor.
// As consultas de mídia com largura/altura em px são reescritas para o espaço "projetado" (px reais ÷ fator), senão regras
// de tela baixa (ex.: max-height: 800px) disparariam no tamanho real e desmontariam o layout.

export const REF_LARGURA = 1600;
export const REF_ALTURA = 860;
export const FATOR_MIN = 0.6;
/** Abaixo disto (celular) não há redução: vale o layout responsivo normal. */
export const LARGURA_CELULAR = 861;

export function fatorAuto(largura: number, altura: number): number {
  if (!(largura >= LARGURA_CELULAR) || !(altura > 0)) return 1;
  const f = Math.min(1, largura / REF_LARGURA, altura / REF_ALTURA);
  return Math.round(Math.max(FATOR_MIN, f) * 100) / 100;
}

const originais = new WeakMap<CSSMediaRule, string>();

function visitar(regras: CSSRuleList, fator: number) {
  for (const r of Array.from(regras)) {
    if (r instanceof CSSMediaRule) {
      const orig = originais.get(r) ?? r.media.mediaText;
      originais.set(r, orig);
      if (/width|height/.test(orig) && /px/.test(orig)) {
        const novo = orig.replace(/(\d+(?:\.\d+)?)px/g, (_, n: string) => `${Math.round(Number(n) * fator * 10) / 10}px`);
        if (novo !== r.media.mediaText) r.media.mediaText = novo;
      }
    }
    const filhas = (r as CSSGroupingRule).cssRules;
    if (filhas) visitar(filhas, fator);
  }
}

/** Reescreve as consultas de mídia em px para o espaço projetado (fator 1 = original). */
export function ajustarConsultasDeMidia(fator: number) {
  if (typeof document === 'undefined') return;
  for (const folha of Array.from(document.styleSheets)) {
    let regras: CSSRuleList;
    try { regras = folha.cssRules; } catch { continue; } // folha de outra origem
    visitar(regras, fator);
  }
}
