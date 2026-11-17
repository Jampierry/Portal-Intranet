import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { abrirFlutuante, posicionarFlutuante } from './flutuante';
import { createPortal } from 'react-dom';

/** Botão "!" que abre uma explicação curta (no lugar de parágrafos que ocupavam a tela). */
export function Dica({ children, lado = 'esq' }: { children: ReactNode; lado?: 'esq' | 'dir' }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLSpanElement>(null);
  // O balão vai para a camada superior do navegador: não é cortado pela janela pop-up e passa por cima dela.
  useLayoutEffect(() => {
    const p = painel.current, b = botao.current;
    if (!aberto || !p || !b) return;
    abrirFlutuante(p);
    const colocar = () => posicionarFlutuante(p, b.getBoundingClientRect(), { alinhar: lado === 'dir' ? 'dir' : 'esq', alturaMax: 420 });
    colocar();
    addEventListener('resize', colocar); addEventListener('scroll', colocar, true);
    return () => { removeEventListener('resize', colocar); removeEventListener('scroll', colocar, true); };
  }, [aberto, lado]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  return (
    <span className="dica-ajuda" ref={raiz}>
      <button ref={botao} type="button" className="dica-ajuda-btn" aria-label="Ajuda desta parte" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.8" /><path d="M8 4.4v4.2" /><circle cx="8" cy="11.3" r=".5" fill="currentColor" /></svg>
      </button>
      {aberto && <span ref={painel} popover="manual" className={`dica-ajuda-painel ${lado}`} role="note">{children}</span>}
    </span>
  );
}

/** Rótulo de campo de formulário com a explicação num "!" redondo pequeno ao lado (no lugar do texto miúdo embaixo do campo). */
export function RotuloDica({ texto, dica }: { texto: string; dica?: string }) {
  return <span className="rot-dica">{texto}{dica && <Dica>{dica}</Dica>}</span>;
}

export const SLOT_DICA = 'slot-dica-aba';

/** A explicação de uma aba: aparece como "!" no canto direito da barra de abas (ou ali mesmo, se a tela não tiver abas). */
export function DicaAba({ children }: { children: ReactNode }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => { setAlvo(document.getElementById(SLOT_DICA)); }, []);
  return alvo ? createPortal(<Dica lado="dir">{children}</Dica>, alvo) : <Dica>{children}</Dica>;
}
