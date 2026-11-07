import { isValidElement, useMemo, useState, type ReactNode } from 'react';

export type Valor = string | number | null | undefined;
type Sentido = 'asc' | 'desc';

const colador = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Valor para ordenar: texto/número direto; selo (<Selo texto=…>) pelo texto; o resto não ordena. */
export function valorOrdenavel(v: ReactNode): Valor {
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (isValidElement(v)) {
    const t = (v.props as { texto?: unknown; children?: unknown }).texto;
    if (typeof t === 'string') return t;
    const f = (v.props as { children?: unknown }).children;
    if (typeof f === 'string' || typeof f === 'number') return f;
  }
  return null;
}

/** Ordenação por clique no cabeçalho: 1º clique A→Z, 2º Z→A, 3º volta à ordem original. Vazios ficam sempre no fim. */
export function useOrdenacao<T>(linhas: T[] | null, valores: Record<string, (r: T) => Valor>) {
  const [ord, setOrd] = useState<{ chave: string; sentido: Sentido } | null>(null);
  const ordenadas = useMemo(() => {
    if (!linhas || !ord || !valores[ord.chave]) return linhas;
    const f = valores[ord.chave];
    const dir = ord.sentido === 'asc' ? 1 : -1;
    return [...linhas].sort((a, b) => {
      const x = f(a), y = f(b);
      const vx = x === null || x === undefined || x === '', vy = y === null || y === undefined || y === '';
      if (vx || vy) return vx && vy ? 0 : vx ? 1 : -1; // vazio sempre depois
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return colador.compare(String(x), String(y)) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, ord]);

  const alternar = (chave: string) => setOrd((o) => (!o || o.chave !== chave ? { chave, sentido: 'asc' } : o.sentido === 'asc' ? { chave, sentido: 'desc' } : null));
  /** Cabeçalho clicável (ou comum, se a coluna não ordena). */
  const cab = (chave: string, titulo: string, className?: string) => {
    if (!valores[chave]) return <th key={chave} className={className}>{titulo}</th>;
    const ativo = ord?.chave === chave ? ord.sentido : null;
    return (
      <th key={chave} className={className} aria-sort={ativo === 'asc' ? 'ascending' : ativo === 'desc' ? 'descending' : 'none'}>
        <button type="button" className={`ord${ativo ? ` ${ativo}` : ''}`} onClick={() => alternar(chave)} title={`Ordenar por ${titulo}`}>{titulo}</button>
      </th>
    );
  };
  return { linhas: ordenadas, cab };
}
