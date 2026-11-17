// Painéis flutuantes (listas e balões de ajuda) que precisam aparecer POR CIMA de tudo, inclusive de janelas pop-up (dialog).
// Um elemento com o atributo `popover="manual"` vai para a "camada superior" do navegador: não é cortado pelo rolar/overflow da janela
// e não fica preso a ela, mas continua sendo filho dela no DOM (por isso segue clicável com a janela modal aberta).

/** Mostra o painel na camada superior (sem efeito em navegador antigo, onde ele continua posicionado normalmente). */
export function abrirFlutuante(p: HTMLElement) {
  try { if (!p.matches(':popover-open')) p.showPopover(); } catch { /* navegador sem Popover API */ }
}

/** Largura e altura da janela no mesmo "espaço" das medidas dos elementos (o zoom da página muda de navegador para navegador:
 *  por isso a janela é medida com um elemento de teste que ocupa a tela toda, em vez de calcular pelo valor do zoom). */
function medirJanela() {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(t);
  const { width, height } = t.getBoundingClientRect();
  t.remove();
  return { largura: width || innerWidth, altura: height || innerHeight };
}

/** Coloca o painel colado à âncora: embaixo (ou em cima, se não couber), alinhado à esquerda ou à direita dela, sempre dentro da tela.
 *  Corrige o zoom da página medindo o painel depois de desenhado. */
export function posicionarFlutuante(p: HTMLElement, ancora: DOMRect, { alinhar = 'esq', larguraIgual = false, alturaMax = 380 }: { alinhar?: 'esq' | 'dir'; larguraIgual?: boolean; alturaMax?: number } = {}) {
  p.style.maxHeight = ''; p.style.width = larguraIgual ? `${ancora.width}px` : '';
  // Fator entre pixels de CSS e pixels medidos (1 sem zoom).
  const sonda = larguraIgual ? ancora.width : 100;
  if (!larguraIgual) p.style.width = `${sonda}px`;
  const medida = p.getBoundingClientRect().width;
  const escala = medida ? sonda / medida : 1;
  p.style.width = larguraIgual ? `${ancora.width * escala}px` : '';
  const colocar = (esq: number, topo: number) => {
    p.style.left = `${esq * escala}px`; p.style.top = `${topo * escala}px`;
    const a = p.getBoundingClientRect();
    p.style.left = `${esq * escala + (esq - a.left) * escala}px`; p.style.top = `${topo * escala + (topo - a.top) * escala}px`;
  };
  const { largura: largJanela, altura: altJanela } = medirJanela();
  colocar(ancora.left, ancora.bottom + 6);
  p.style.maxHeight = `${alturaMax * escala}px`;
  const r = p.getBoundingClientRect();
  const abaixo = altJanela - ancora.bottom - 16, acima = ancora.top - 16;
  const paraCima = r.height > abaixo && acima > abaixo;
  p.style.maxHeight = `${Math.max(140, Math.min(r.height, paraCima ? acima : abaixo)) * escala}px`;
  const { width: w, height: h } = p.getBoundingClientRect();
  let esq = alinhar === 'dir' ? ancora.right - w : ancora.left;
  esq = Math.max(8, Math.min(esq, largJanela - w - 8));
  colocar(esq, paraCima ? ancora.top - 6 - h : ancora.bottom + 6);
}
