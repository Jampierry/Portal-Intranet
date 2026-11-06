import { useEffect, useState, type ReactNode } from 'react';
import { modoAbertura, urlSegura } from '../links';

/** Largura da janela, atualizada ao redimensionar (decide nova aba x mesma aba). */
export function useLargura() {
  const [w, setW] = useState(() => innerWidth);
  useEffect(() => { const f = () => setW(innerWidth); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  return w;
}

/** Link para um sistema externo: computador abre em nova aba; celular na mesma aba. */
export function LinkApp({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const modo = modoAbertura(useLargura());
  if (!urlSegura(url)) return <span className={className} aria-disabled="true">{children}</span>;
  return <a className={className} href={url} target={modo.target} rel={modo.rel}>{children}</a>;
}
