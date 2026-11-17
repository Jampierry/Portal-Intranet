import { useCallback, useEffect, useRef, useState } from 'react';

/** Reordenar uma lista vertical arrastando (mouse, caneta ou dedo). Cada item leva `propsItem(id)`; o container leva `refLista`.
 *  O item arrastado segue o ponteiro (flutuando) e os vizinhos se afastam abrindo o espaço onde ele vai ficar; ao soltar, a nova ordem é salva.
 *  Mouse: arrasta depois de mover alguns pixels. Toque: segure ~0,35 s e arraste (para a rolagem continuar funcionando).
 *  Teclado: Alt + seta para cima/baixo no item. Tudo durante o arrasto mexe só no DOM (transform); o React só recebe a ordem final. */
export function useOrdenar(ids: string[], aoOrdenar: (nova: string[]) => void) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const lista = useRef<HTMLElement | null>(null);
  const idsRef = useRef(ids); idsRef.current = ids;
  const cb = useRef(aoOrdenar); cb.current = aoOrdenar;
  const bloquear = useRef(false);
  const limpar = useRef<(() => void) | null>(null);
  useEffect(() => () => limpar.current?.(), []);

  const refLista = useCallback((el: HTMLElement | null) => { lista.current = el; }, []);

  const iniciar = useCallback((id: string, e: React.PointerEvent) => {
    if (e.button > 0 || !lista.current) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    limpar.current?.();
    const toque = e.pointerType === 'touch';
    const x0 = e.clientX, y0 = e.clientY;
    let arrastando = false, timer: number | undefined, para = -1, de = -1;
    let els: HTMLElement[] = [], topos: number[] = [], alturas: number[] = [], passo = 0;

    const comecar = () => {
      els = Array.from(lista.current?.querySelectorAll<HTMLElement>('[data-ordem]') ?? []);
      de = els.findIndex((el) => el.dataset.ordem === id);
      if (de < 0) { encerrar(false); return; }
      const rs = els.map((el) => el.getBoundingClientRect());
      topos = rs.map((r) => r.top); alturas = rs.map((r) => r.height);
      // espaço que o item arrastado ocupa na lista (altura + folga entre itens)
      passo = alturas[de] + (de < els.length - 1 ? topos[de + 1] - (topos[de] + alturas[de]) : de > 0 ? topos[de] - (topos[de - 1] + alturas[de - 1]) : 0);
      para = de; arrastando = true; setAtivo(id);
      els.forEach((el, i) => { if (i !== de) el.style.transition = 'transform .16s ease'; });
      els[de].style.transition = 'none'; els[de].style.zIndex = '5';
      document.body.classList.add('ordenando');
      if (toque) navigator.vibrate?.(12);
      window.addEventListener('touchmove', travar, { passive: false });
    };
    const travar = (ev: TouchEvent) => { if (ev.cancelable) ev.preventDefault(); };
    const mover = (y: number) => {
      const dy = y - y0;
      els[de].style.transform = `translateY(${dy}px) scale(1.04)`;
      const centro = topos[de] + alturas[de] / 2 + dy;
      let alvo = de;
      for (let k = 0; k < els.length; k++) {
        if (k === de) continue;
        const c = topos[k] + alturas[k] / 2;
        if (k > de && centro > c) alvo = k;
        if (k < de && centro < c && k < alvo) alvo = k;
      }
      if (alvo === para) return;
      para = alvo;
      els.forEach((el, k) => {
        if (k === de) return;
        const desloca = de < para ? (k > de && k <= para ? -passo : 0) : (k >= para && k < de ? passo : 0);
        el.style.transform = desloca ? `translateY(${desloca}px)` : '';
      });
    };
    const mexeu = (ev: PointerEvent) => {
      if (!arrastando) {
        const d = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (toque) { if (d > 10) encerrar(false); return; } // o dedo andou antes do tempo: é rolagem
        if (d > 5) comecar(); else return;
        if (!arrastando) return;
      }
      mover(ev.clientY);
    };
    const soltou = () => encerrar(true);
    const cancelou = () => encerrar(false);
    function encerrar(confirmar: boolean) {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', mexeu); window.removeEventListener('pointerup', soltou); window.removeEventListener('pointercancel', cancelou); window.removeEventListener('touchmove', travar);
      document.body.classList.remove('ordenando');
      limpar.current = null;
      if (arrastando) {
        els.forEach((el) => { el.style.transition = 'none'; el.style.transform = ''; el.style.zIndex = ''; });
        bloquear.current = true; window.setTimeout(() => { bloquear.current = false; }, 60);
        if (confirmar && para !== de) { const nova = [...idsRef.current]; nova.splice(de, 1); nova.splice(para, 0, id); cb.current(nova); }
        requestAnimationFrame(() => els.forEach((el) => { el.style.transition = ''; }));
      }
      setAtivo(null);
    }
    window.addEventListener('pointermove', mexeu); window.addEventListener('pointerup', soltou); window.addEventListener('pointercancel', cancelou);
    if (toque) timer = window.setTimeout(comecar, 350);
    limpar.current = () => encerrar(false);
  }, []);

  const propsItem = (id: string) => ({
    'data-ordem': id,
    draggable: false as const,
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onPointerDown: (e: React.PointerEvent) => iniciar(id, e),
    onClickCapture: (e: React.MouseEvent) => { if (bloquear.current) { e.preventDefault(); e.stopPropagation(); } },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const l = [...idsRef.current], i = l.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (i < 0 || j < 0 || j >= l.length) return;
      e.preventDefault(); l.splice(i, 1); l.splice(j, 0, id); cb.current(l);
    },
  });

  return { ordem: ids, ativo, refLista, propsItem };
}
