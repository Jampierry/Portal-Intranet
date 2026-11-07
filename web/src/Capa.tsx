import type { ReactNode } from 'react';
import { Icone } from './icones';

// Ainda não há fotos no projeto: "capas" em cor do tema, com um desenho de fundo e um ícone.
// Quando houver imagem, basta passar `foto` (URL) e ela cobre o desenho.
const TONS = [12, 34, 20, 48, 6];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Capa({ semente, icone, foto, classe = '', children }: { semente: string; icone: string; foto?: string | null; classe?: string; children?: ReactNode }) {
  const h = hash(semente);
  const forte = TONS[h % TONS.length];
  return (
    <div className={`capa ${classe}`} style={{ ['--capa-forte' as string]: `${forte + 22}%`, ['--capa-giro' as string]: `${(h % 7) * 24}deg` }} aria-hidden="true">
      {foto ? <img src={foto} alt="" /> : <><i className="capa-forma" /><i className="capa-forma f2" /><span className="capa-icone"><Icone nome={icone} tamanho={34} /></span></>}
      {children}
    </div>
  );
}

/** Texto em letras espaçadas das imagens de referência ("MODA QUE ACOMPANHA A SUA HISTÓRIA"). */
export function Lema({ linhas, classe = '' }: { linhas: string[]; classe?: string }) {
  return <p className={`lema ${classe}`}>{linhas.map((l) => <span key={l}>{l}</span>)}<i className="traco" /></p>;
}
