import type { ReactNode } from 'react';

/** O nome da tela fica na barra superior universal (App.tsx, TITULOS). Aqui só entram as ações da tela;
 *  `interno` mantém o título grande no corpo para páginas de detalhe ou erro (ex.: "Comunicado não encontrado"). */
export function Cabecalho({ titulo, sub, interno, children }: { titulo: string; sub?: string; interno?: boolean; children?: ReactNode }) {
  if (!interno && !children) return null;
  return (
    <div className={interno ? 'cabeca' : 'cabeca cabeca-acoes'}>
      {interno && <div><h1>{titulo}</h1>{sub && <p>{sub}</p>}</div>}
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
