import { useEffect, useState } from 'react';
import { api } from '../api';
import { Crud, JanelaForm, Selo } from './Crud';
import { EditorPerguntas, perguntaNova, type PerguntaForm } from './PulsoPerguntas';

interface Pulso { id: number; pergunta: string; descricao: string | null; status: string; criado_em: string; aberto_em: string | null; encerrado_em: string | null; respostas: number; anonima: boolean; n_perguntas: number; perguntas: PerguntaForm[] }
interface ResPergunta {
  id: number; texto: string; tipo: string; imagem: string | null; respondentes?: number;
  quem?: { nome: string; resposta: string }[]; media?: number | null; distribuicao?: number[]; comentarios?: string[]; textos?: string[]; opcoes?: { texto: string; imagem: string | null; total: number; nomes?: string[] }[];
}
interface Resultado { titulo: string; anonima?: boolean; respostas: number; alvo: number; minimo: number; liberado: boolean; perguntas?: ResPergunta[] }
const SIT: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { aberto: ['ok', 'Aberta'], rascunho: ['aviso', 'Rascunho'], encerrado: ['neutro', 'Encerrada'] };
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

/** Dados inventados só para o RH ver como o resultado fica (nada disso vem do banco). */
const EXEMPLO: Resultado = {
  titulo: 'Prévia', anonima: true, respostas: 42, alvo: 60, minimo: 5, liberado: true,
  perguntas: [
    { id: 1, texto: 'O que você acha da empresa?', tipo: 'nota', imagem: null, respondentes: 42, media: 4.2, distribuicao: [1, 2, 6, 15, 18], comentarios: ['Ótimo ambiente de trabalho.', 'Gostaria de mais momentos de integração.', 'Equipe unida e prestativa.'] },
    { id: 2, texto: 'Qual cardápio você quer para a festa de final de ano?', tipo: 'unica', imagem: null, respondentes: 40, opcoes: [{ texto: 'Churrasco, arroz, feijão tropeiro e salada', imagem: null, total: 22 }, { texto: 'Massas e saladas', imagem: null, total: 11 }, { texto: 'Feijoada completa', imagem: null, total: 7 }] },
    { id: 3, texto: 'Quais atrações você gostaria de ter?', tipo: 'multipla', imagem: null, respondentes: 38, opcoes: [{ texto: 'Banda ao vivo', imagem: null, total: 29 }, { texto: 'DJ', imagem: null, total: 17 }, { texto: 'Sorteio de brindes', imagem: null, total: 33 }, { texto: 'Karaokê', imagem: null, total: 12 }] },
    { id: 4, texto: 'Deixe uma sugestão para a festa', tipo: 'texto', imagem: null, respondentes: 9, textos: ['Mais opções para vegetarianos.', 'Local com estacionamento.', 'Horário um pouco mais cedo.'] },
  ],
};

function ResultadoPulso({ p, aoFechar }: { p: Pulso; aoFechar: () => void }) {
  const [real, setR] = useState<Resultado | null>(null);
  const [previa, setPrevia] = useState(false);
  const r = previa ? EXEMPLO : real;
  const [erro, setErro] = useState('');
  useEffect(() => { api<Resultado>(`/api/gestao/pulso/${p.id}/resultado`).then(setR).catch((e: Error) => setErro(e.message)); }, [p.id]);
  return (
    <JanelaForm extra titulo="Resultado da pesquisa" rotuloEnviar="Fechar" aoFechar={aoFechar} aoEnviar={async () => aoFechar()}>
      <p style={{ marginTop: 0 }}><b>{p.pergunta}</b></p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!r && !erro && <p className="suave">Carregando…</p>}
      {r && !r.liberado && <>
        <p className="suave" role="status">{r.respostas} de {r.minimo} respostas. Para proteger o anonimato, o resultado só aparece a partir de {r.minimo} respostas.</p>
        <button type="button" className="btn btn-sec btn-pequeno" onClick={() => setPrevia(true)}>Ver prévia com dados de exemplo</button>
      </>}
      {previa && <p className="aviso-previa" role="status"><b>Prévia:</b> números inventados, só para mostrar como o resultado vai ficar. <button type="button" className="btn btn-sec btn-pequeno" onClick={() => setPrevia(false)}>Sair da prévia</button></p>}
      {r?.liberado && (
        <div className="pulso-res">
          <ul className="pr-resumo" aria-label="Resumo">
            <li><b>{r.respostas}</b><span>resposta{r.respostas === 1 ? '' : 's'}</span></li>
            <li><b>{r.alvo}</b><span>pessoas ativas</span></li>
            <li><b>{r.alvo ? Math.min(100, Math.round((r.respostas / r.alvo) * 100)) : 0}%</b><span>participação</span></li>
            <li><b>{r.anonima === false ? 'Identificada' : 'Anônima'}</b><span>{r.anonima === false ? 'nomes aparecem abaixo' : 'sem nomes'}</span></li>
          </ul>
          <div className="pr-grade">
          {(r.perguntas ?? []).map((q, n) => (
            <section key={q.id} className="pq-res">
              <h3>{n + 1}. {q.texto}</h3>
              {q.imagem && <img src={q.imagem} alt="" className="pq-res-img" />}
              {q.tipo === 'nota' && (<>
                <p style={{ margin: 0 }}><b>Média {q.media === null ? '—' : String(q.media).replace('.', ',')} de 5</b> · {q.respondentes} resposta{q.respondentes === 1 ? '' : 's'}</p>
                <Barras itens={(q.distribuicao ?? []).map((v, i) => ({ rotulo: String(i + 1), marca: CARINHAS[i], n: v }))} />
                {(q.comentarios ?? []).length > 0 && <><b>Comentários ({q.comentarios!.length})</b><ul className="pulso-coment">{q.comentarios!.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
              </>)}
              {(q.tipo === 'unica' || q.tipo === 'multipla') && <Barras itens={(q.opcoes ?? []).map((o) => ({ rotulo: o.texto, imagem: o.imagem, n: o.total }))} />}
              {(q.tipo === 'unica' || q.tipo === 'multipla') && q.opcoes?.some((o) => o.nomes) && (
                <ul className="pulso-coment">{q.opcoes.map((o) => <li key={o.texto}><b>{o.texto}:</b> {o.nomes && o.nomes.length ? o.nomes.join(', ') : '—'}</li>)}</ul>
              )}
              {(q.tipo === 'nota' || q.tipo === 'texto') && q.quem && <><b>Quem respondeu ({q.quem.length})</b><ul className="pulso-coment">{q.quem.map((x, i) => <li key={i}><b>{x.nome}:</b> {x.resposta}</li>)}</ul></>}
              {q.tipo === 'texto' && ((q.textos ?? []).length === 0 ? <p className="suave" style={{ margin: 0 }}>Ninguém respondeu.</p> : <><b>Respostas ({q.textos!.length})</b><ul className="pulso-coment">{q.textos!.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            </section>
          ))}
          </div>
        </div>
      )}
    </JanelaForm>
  );
}

/** Publicar › Pesquisas (RH): várias perguntas por pesquisa, tipos livres (nota, escolha única, múltipla, texto), imagens; resposta anônima. */
export function PesquisaPulso() {
  const [resultado, setResultado] = useState<Pulso | null>(null);
  return (
    <>
      <Crud<Pulso> base="/api/gestao/pulso" rotuloItem="pesquisa" feminino larga gradeClasse="grade-pesq" idDe={(r) => r.id}
        introducao="Monte pesquisas do jeito que precisar (cardápio da festa, atrações, clima…): várias perguntas, cada uma com o tipo de resposta que escolher e, se quiser, imagem. Ao criar, escolha se é anônima (padrão; o resultado só aparece com pelo menos 5 respostas) ou identificada (o RH vê quem respondeu). Pode haver várias pesquisas abertas; cada pessoa responde uma vez. As perguntas não mudam depois que alguém responde."
        campos={[
          { chave: 'pergunta', rotulo: 'Título da pesquisa', obrigatorio: true, max: 160, metade: true, classe: 'gp-2', dica: 'Ex.: Festa de final de ano — cardápio e atrações' },
          { chave: 'descricao', rotulo: 'Explicação (opcional)', tipo: 'area', linhas: 4, max: 500, metade: true, classe: 'gp-alto', dica: 'Aparece antes das perguntas.' },
          { chave: 'anonima', rotulo: 'Tipo de pesquisa', tipo: 'select', opcoes: [['1', 'Anônima (ninguém sabe quem respondeu)'], ['0', 'Identificada (o RH vê quem respondeu o quê)']], metade: true, classe: 'gp-1', dica: 'Não dá para trocar depois que alguém responde. Em pesquisa identificada, quem responde é avisado.' },
          { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aberto', 'Aberta (aparece para as pessoas responderem)'], ['encerrado', 'Encerrada']], metade: true, classe: 'gp-1' },
          { chave: 'perguntas', rotulo: 'Perguntas', tipo: 'custom', render: (v, m, todos) => <EditorPerguntas valor={v as PerguntaForm[]} mudar={m} bloqueado={todos.bloqueado === true} /> },
        ]}
        colunas={[
          { titulo: 'Pesquisa', ver: (r) => r.pergunta },
          { titulo: 'Perguntas', ver: (r) => r.n_perguntas, ordem: (r) => r.n_perguntas },
          { titulo: 'Tipo', ver: (r) => (r.anonima ? 'Anônima' : 'Identificada') },
          { titulo: 'Situação', ver: (r) => { const [t, x] = SIT[r.status] ?? ['neutro', r.status]; return <Selo texto={x} tom={t} />; } },
          { titulo: 'Respostas', ver: (r) => r.respostas, ordem: (r) => r.respostas },
        ]}
        valoresNovos={{ pergunta: '', descricao: '', status: 'rascunho', anonima: '1', perguntas: [perguntaNova('nota')], bloqueado: false }}
        paraForm={(r) => ({ pergunta: r.pergunta, descricao: r.descricao ?? '', status: r.status, anonima: r.anonima ? '1' : '0', perguntas: r.perguntas.map((q) => ({ ...q })), bloqueado: r.respostas > 0 })}
        acoesExtra={(r) => <button className="btn btn-sec btn-pequeno" onClick={() => setResultado(r)}>Resultado</button>}
      />
      {resultado && <ResultadoPulso p={resultado} aoFechar={() => setResultado(null)} />}
    </>
  );
}
