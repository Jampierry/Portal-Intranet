import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Botão "!" que abre uma explicação curta (no lugar de parágrafos que ocupavam a tela). */
export function Dica({ children, lado = 'esq' }: { children: ReactNode; lado?: 'esq' | 'dir' }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  return (
    <span className="dica-ajuda" ref={raiz}>
      <button type="button" className="dica-ajuda-btn" aria-label="Ajuda desta parte" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.8" /><path d="M8 4.4v4.2" /><circle cx="8" cy="11.3" r=".5" fill="currentColor" /></svg>
      </button>
      {aberto && <span className={`dica-ajuda-painel ${lado}`} role="note">{children}</span>}
    </span>
  );
}

export const SLOT_DICA = 'slot-dica-aba';

/** A explicação de uma aba: aparece como "!" no canto direito da barra de abas (ou ali mesmo, se a tela não tiver abas). */
export function DicaAba({ children }: { children: ReactNode }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => { setAlvo(document.getElementById(SLOT_DICA)); }, []);
  return alvo ? createPortal(<Dica lado="dir">{children}</Dica>, alvo) : <Dica>{children}</Dica>;
}
