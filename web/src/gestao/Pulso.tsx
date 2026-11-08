import { useEffect, useState } from 'react';
import { api } from '../api';
import { Crud, JanelaForm, Selo } from './Crud';

interface Pulso { id: number; pergunta: string; status: string; criado_em: string; aberto_em: string | null; encerrado_em: string | null; respostas: number }
interface Resultado { pergunta: string; respostas: number; alvo: number; minimo: number; liberado: boolean; media?: number; distribuicao?: number[]; comentarios?: string[] }
const SIT: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { aberto: ['ok', 'Aberta'], rascunho: ['aviso', 'Rascunho'], encerrado: ['neutro', 'Encerrada'] };
const CARINHAS = ['😞', '🙁', '😐', '🙂', '😄'];

function ResultadoPulso({ p, aoFechar }: { p: Pulso; aoFechar: () => void }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api<Resultado>(`/api/gestao/pulso/${p.id}/resultado`).then(setR).catch((e: Error) => setErro(e.message)); }, [p.id]);
  const max = Math.max(1, ...(r?.distribuicao ?? [0]));
  return (
    <JanelaForm titulo="Resultado do pulso" rotuloEnviar="Fechar" aoFechar={aoFechar} aoEnviar={async () => aoFechar()}>
      <p style={{ marginTop: 0 }}><b>{p.pergunta}</b></p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!r && !erro && <p className="suave">Carregando…</p>}
      {r && !r.liberado && <p className="suave" role="status">{r.respostas} de {r.minimo} respostas. Para proteger o anonimato, o resultado só aparece a partir de {r.minimo} respostas.</p>}
      {r?.liberado && (
        <div className="pulso-res">
          <p style={{ margin: 0 }}><b>Média {String(r.media).replace('.', ',')} de 5</b> · {r.respostas} resposta{r.respostas === 1 ? '' : 's'} (de {r.alvo} pessoas ativas)</p>
          <ul className="pulso-barras" aria-label="Distribuição das notas">
            {(r.distribuicao ?? []).map((n, i) => <li key={i}><span aria-hidden="true">{CARINHAS[i]}</span><b>{i + 1}</b><span className="pulso-barra"><i style={{ width: `${(n / max) * 100}%` }} /></span><small>{n}</small></li>)}
          </ul>
          <b>Comentários (anônimos)</b>
          {(r.comentarios ?? []).length === 0 ? <p className="suave" style={{ margin: 0 }}>Ninguém deixou comentário.</p> : <ul className="pulso-coment">{r.comentarios!.map((c, i) => <li key={i}>{c}</li>)}</ul>}
        </div>
      )}
    </JanelaForm>
  );
}

/** Publicar › Pesquisa de pulso (RH): uma pergunta por vez, resposta anônima; só uma aberta por vez. */
export function PesquisaPulso() {
  const [resultado, setResultado] = useState<Pulso | null>(null);
  return (
    <>
      <Crud<Pulso> base="/api/gestao/pulso" rotuloItem="pesquisa" idDe={(r) => r.id}
        introducao="Uma pergunta curta por vez (nota de 1 a 5 e comentário opcional). A resposta é anônima e o resultado só aparece com pelo menos 5 respostas. Abrir uma pesquisa encerra a anterior; a pergunta não muda depois que alguém responde."
        campos={[
          { chave: 'pergunta', rotulo: 'Pergunta', obrigatorio: true, max: 160, dica: 'Ex.: Como você se sentiu no trabalho esta semana?' },
          { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aberto', 'Aberta (aparece no Início)'], ['encerrado', 'Encerrada']], metade: true },
        ]}
        colunas={[
          { titulo: 'Pergunta', ver: (r) => r.pergunta },
          { titulo: 'Situação', ver: (r) => { const [t, x] = SIT[r.status] ?? ['neutro', r.status]; return <Selo texto={x} tom={t} />; } },
          { titulo: 'Respostas', ver: (r) => r.respostas, ordem: (r) => r.respostas },
        ]}
        valoresNovos={{ pergunta: '', status: 'rascunho' }}
        paraForm={(r) => ({ pergunta: r.pergunta, status: r.status })}
        acoesExtra={(r) => <button className="btn btn-sec btn-pequeno" onClick={() => setResultado(r)}>Resultado</button>}
      />
      {resultado && <ResultadoPulso p={resultado} aoFechar={() => setResultado(null)} />}
    </>
  );
}
