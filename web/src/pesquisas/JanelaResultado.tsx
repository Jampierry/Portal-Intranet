import { useEffect, useState } from 'react';
import { api } from '../api';
import { JanelaForm } from '../gestao/Crud';
import { ResultadoCorpo, type Resultado } from '../gestao/ResultadoPesquisa';

/** Resultado divulgado pelo RH (já filtrado pelo servidor: só o que o RH liberou, sem nomes). */
export interface ItemResultado { id: number; titulo: string; liberado_em: string | null; respostas: number; rodada: number; visto: boolean }

/** Janela com o resultado de uma pesquisa divulgada. Serve ao pop-up de novidade e à tela Pesquisas. Fechar (de qualquer jeito) chama `aoFechar`. */
export function JanelaResultado({ item, aoFechar, titulo = 'Resultado da pesquisa' }: { item: ItemResultado; aoFechar: () => void; titulo?: string }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api<Resultado>(`/api/pulso/resultados/${item.id}`).then(setR).catch((e: Error) => setErro(e.message)); }, [item.id]);
  return (
    <JanelaForm extra titulo={titulo} rotuloEnviar="Fechar" aoFechar={aoFechar} aoEnviar={async () => aoFechar()}>
      <p style={{ marginTop: 0 }}><b>{item.titulo}</b></p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!r && !erro && <p className="suave">Carregando…</p>}
      {r && <ResultadoCorpo r={r} />}
    </JanelaForm>
  );
}

/** Avisa o servidor que a pessoa já viu esta divulgação (ela some do pop-up e continua na tela Pesquisas). */
export const marcarVisto = (id: number) => api(`/api/pulso/resultados/${id}/visto`, {}).catch(() => undefined);
