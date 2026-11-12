import type { Dispatch, SetStateAction } from 'react';

export interface ResPergunta {
  id: number; texto: string; tipo: string; imagem: string | null; respondentes?: number; exibir_resultado?: boolean; exibir_textos?: boolean; exibir_vencedora?: boolean; so_vencedora?: boolean; aceita_comentario?: boolean;
  quem?: { nome: string; resposta: string }[]; media?: number | null; distribuicao?: number[]; comentarios?: string[]; textos?: string[]; opcoes?: { texto: string; imagem: string | null; total: number; nomes?: string[] }[];
}
export interface Resultado { titulo: string; anonima?: boolean; respostas: number; alvo: number; minimo: number; liberado: boolean; resultado_liberado?: boolean; rodada?: number; rodadas?: { rodada: number; abre_em: string | null; fecha_em: string | null; respostas: number }[]; perguntas?: ResPergunta[] }
/** O que o RH escolheu mostrar aos colaboradores, por pergunta. */
export type Publicacao = Record<number, { resultado: boolean; textos: boolean; vencedora: boolean }>;
export interface Edicao { liberado: boolean; setLiberado: (v: boolean) => void; pub: Publicacao; setPub: Dispatch<SetStateAction<Publicacao>> }

const CARINHAS = ['😞', '🙁', '😐', '🙂', '😄'];

function Barras({ itens }: { itens: { rotulo: string; imagem?: string | null; marca?: string; n: number }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  const soma = itens.reduce((a, i) => a + i.n, 0);
  return (
    <ul className="pulso-barras" style={{ listStyle: 'none' }}>
      {itens.map((o, i) => (
        <li key={i} className={`pulso-barra-linha${o.marca ? ' curta' : ''}`}>
          <span className="pulso-barra-rotulo" title={o.rotulo}>{o.imagem && <img src={o.imagem} alt="" className="pq-mini" />}{o.marca && <span aria-hidden="true">{o.marca}</span>}{o.rotulo}</span>
          <span className="pulso-barra"><i style={{ width: `${(o.n / max) * 100}%` }} /></span>
          <small>{o.n}{soma ? ` (${Math.round((o.n / soma) * 100)}%)` : ''}</small>
        </li>
      ))}
    </ul>
  );
}

/** Resultado de uma pesquisa (resumo + um cartão por pergunta). Com `edicao`, o RH escolhe o que os colaboradores veem. */
export function ResultadoCorpo({ r, edicao }: { r: Resultado; edicao?: Edicao }) {
  const publico = !edicao;
  const perguntas = r.perguntas ?? [];
  return (
    <div className="pulso-res">
      {edicao && (
        <div className="pr-liberar">
          <label className="linha pr-liberar-chave"><input type="checkbox" checked={edicao.liberado} onChange={(e) => edicao.setLiberado(e.target.checked)} /> <b>Liberar este resultado para os colaboradores</b></label>
          <small className="suave pr-liberar-nota">A divulgação é sempre anônima (sem nomes) e só aparece com {r.minimo} respostas ou mais{r.anonima === false ? '; os nomes e o detalhe completo desta pesquisa identificada ficam só com o RH' : ''}. Em cada pergunta, abaixo, marque o que os colaboradores podem ver e clique em Salvar.</small>
        </div>
      )}
      <ul className="pr-resumo" aria-label="Resumo">
        <li><b>{r.respostas}</b><span>resposta{r.respostas === 1 ? '' : 's'}</span></li>
        <li><b>{r.alvo}</b><span>pessoas ativas</span></li>
        <li><b>{r.alvo ? Math.min(100, Math.round((r.respostas / r.alvo) * 100)) : 0}%</b><span>participação</span></li>
        <li><b>{r.anonima === false && !publico ? 'Identificada' : 'Anônima'}</b><span>{r.anonima === false && !publico ? 'nomes aparecem abaixo' : 'sem nomes'}</span></li>
      </ul>
      <div className="pr-grade">
        {perguntas.map((q, n) => {
          const p = edicao?.pub[q.id] ?? { resultado: true, textos: false, vencedora: false };
          const escolha = q.tipo === 'unica' || q.tipo === 'multipla';
          return (
            <section key={q.id} className={`pq-res${edicao && !p.resultado ? ' pq-res-oculta' : ''}`}>
              <h3>{n + 1}. {q.texto}</h3>
              {edicao && (
                <div className="pr-rh" role="group" aria-label={`O que os colaboradores veem da pergunta ${n + 1}`}>
                  <span>Mostrar aos colaboradores:</span>
                  {q.tipo === 'texto' ? (
                    <label className="linha"><input type="checkbox" checked={p.textos} onChange={(e) => edicao.setPub((a) => ({ ...a, [q.id]: { ...p, resultado: e.target.checked, textos: e.target.checked } }))} /> Respostas em texto</label>
                  ) : (<>
                    <label className="linha"><input type="checkbox" checked={p.resultado} onChange={(e) => edicao.setPub((a) => ({ ...a, [q.id]: { ...p, resultado: e.target.checked, textos: e.target.checked ? p.textos : false, vencedora: e.target.checked ? p.vencedora : false } }))} /> Resultado</label>
                    {q.tipo === 'nota' && q.aceita_comentario && (q.comentarios ?? []).length > 0 && <label className="linha"><input type="checkbox" checked={p.textos} disabled={!p.resultado} onChange={(e) => edicao.setPub((a) => ({ ...a, [q.id]: { ...p, textos: e.target.checked } }))} /> Comentários ({(q.comentarios ?? []).length})</label>}
                    {escolha && <label className="linha"><input type="checkbox" checked={p.vencedora} disabled={!p.resultado} onChange={(e) => edicao.setPub((a) => ({ ...a, [q.id]: { ...p, vencedora: e.target.checked } }))} /> Só a opção mais votada (sem o gráfico)</label>}
                  </>)}
                </div>
              )}
              {q.imagem && <img src={q.imagem} alt="" className="pq-res-img" />}
              {q.tipo === 'nota' && (<>
                <p style={{ margin: 0 }}><b>Média {q.media === null || q.media === undefined ? '—' : String(q.media).replace('.', ',')} de 5</b> · {q.respondentes} resposta{q.respondentes === 1 ? '' : 's'}</p>
                <Barras itens={(q.distribuicao ?? []).map((v, i) => ({ rotulo: String(i + 1), marca: CARINHAS[i], n: v }))} />
                {(q.comentarios ?? []).length > 0 && <><b>Comentários ({q.comentarios!.length})</b><ul className="pulso-coment">{q.comentarios!.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
              </>)}
              {(q.tipo === 'unica' || q.tipo === 'multipla') && (q.so_vencedora
                ? ((q.opcoes ?? []).length === 0 ? <p className="suave" style={{ margin: 0 }}>Ainda sem votos.</p> : <div className="pr-vencedora"><small>{(q.opcoes ?? []).length > 1 ? 'Opções mais votadas (empate)' : 'Opção mais votada'}</small>{q.opcoes!.map((o) => <p key={o.texto}>{o.imagem && <img src={o.imagem} alt="" className="pq-mini" />}<b>{o.texto}</b><span>{o.total} voto{o.total === 1 ? '' : 's'}</span></p>)}</div>)
                : <Barras itens={(q.opcoes ?? []).map((o) => ({ rotulo: o.texto, imagem: o.imagem, n: o.total }))} />)}
              {(q.tipo === 'unica' || q.tipo === 'multipla') && q.opcoes?.some((o) => o.nomes) && (
                <ul className="pulso-coment">{q.opcoes.map((o) => <li key={o.texto}><b>{o.texto}:</b> {o.nomes && o.nomes.length ? o.nomes.join(', ') : '—'}</li>)}</ul>
              )}
              {(q.tipo === 'nota' || q.tipo === 'texto') && q.quem && <><b>Quem respondeu ({q.quem.length})</b><ul className="pulso-coment">{q.quem.map((x, i) => <li key={i}><b>{x.nome}:</b> {x.resposta}</li>)}</ul></>}
              {q.tipo === 'texto' && ((q.textos ?? []).length === 0 ? <p className="suave" style={{ margin: 0 }}>Ninguém respondeu.</p> : <><b>Respostas ({q.textos!.length})</b><ul className="pulso-coment">{q.textos!.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
