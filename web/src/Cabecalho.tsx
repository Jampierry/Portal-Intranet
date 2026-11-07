import type { ReactNode } from 'react';

/** Título grande + subtítulo, como nas telas de referência (ex.: "Comunicados — Fique por dentro do que acontece na Di Paula."). */
export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="cabeca">
      <div><h1>{titulo}</h1>{sub && <p>{sub}</p>}</div>
      {children}
    </div>
  );
}

/** Contagem + estado vazio/erro/carregando usados nas listas. */
export function Estado({ dados, erro, vazio, limpar }: { dados: unknown[] | null; erro: string; vazio: boolean; limpar: () => void }) {
  return (
    <>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados === null && !erro && <p className="vazio">Carregando…</p>}
      {dados && vazio && <p className="vazio">Nada encontrado. <button className="btn btn-sec btn-pequeno" onClick={limpar}>Limpar busca e filtros</button></p>}
    </>
  );
}
