import { useEffect, useState } from 'react';
import { api } from '../api';
import { Crud, JanelaForm, Selo, usePermissoes } from './Crud';
import { avisar } from '../Confirmar';
import { EditorPerguntas, perguntaNova, type PerguntaForm } from './PulsoPerguntas';
import { ResultadoCorpo, type Publicacao, type Resultado } from './ResultadoPesquisa';

interface Pulso { id: number; pergunta: string; descricao: string | null; status: string; criado_em: string; aberto_em: string | null; encerrado_em: string | null; respostas: number; anonima: boolean; n_perguntas: number; perguntas: PerguntaForm[]; abre_em: string | null; fecha_em: string | null; situacao: string; rodada: number; total_respostas: number; pendentes: number }
const SIT: Record<string, ['ok' | 'aviso' | 'neutro', string]> = { aberto: ['ok', 'Aberta'], rascunho: ['aviso', 'Rascunho'], encerrado: ['neutro', 'Encerrada'], agendada: ['aviso', 'Agendada'], prazo: ['neutro', 'Encerrada (prazo)'] };
const dataHora = (v: string | null) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)} ${v.slice(11, 16)}` : '');
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
  const [liberado, setLiberado] = useState(false);
  const [pub, setPub] = useState<Publicacao>({});
  const [rodada, setRodada] = useState<number | null>(null);
  const r = previa ? EXEMPLO : real;
  const [erro, setErro] = useState('');
  useEffect(() => {
    api<Resultado>(`/api/gestao/pulso/${p.id}/resultado${rodada ? `?rodada=${rodada}` : ''}`).then((x) => {
      setR(x);
      if (rodada === null) { // só na primeira carga: trocar de rodada não desfaz o que o RH marcou
        setLiberado(!!x.resultado_liberado);
        setPub(Object.fromEntries((x.perguntas ?? []).map((q) => [q.id, { resultado: q.exibir_resultado !== false, textos: !!q.exibir_textos, vencedora: !!q.exibir_vencedora }])));
      }
    }).catch((e: Error) => setErro(e.message));
  }, [p.id, rodada]);
  const salvar = async () => {
    if (!real?.liberado || previa) return aoFechar();
    await api(`/api/gestao/pulso/${p.id}/publicacao`, { liberado, perguntas: (real.perguntas ?? []).map((q) => ({ id: q.id, resultado: pub[q.id]?.resultado !== false, textos: !!pub[q.id]?.textos, vencedora: !!pub[q.id]?.vencedora })) }, 'PUT');
    aoFechar();
  };
  return (
    <JanelaForm extra titulo="Resultado da pesquisa" rotuloEnviar={real?.liberado && !previa ? 'Salvar' : 'Fechar'} aoFechar={aoFechar} aoEnviar={salvar}>
      <p style={{ marginTop: 0 }}><b>{p.pergunta}</b></p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!r && !erro && <p className="suave">Carregando…</p>}
      {!previa && real && (real.rodadas ?? []).length > 1 && (
        <label className="pr-rodada">Rodada
          <select value={real.rodada} onChange={(e) => setRodada(Number(e.target.value))}>
            {real.rodadas!.map((x) => <option key={x.rodada} value={x.rodada}>Rodada {x.rodada}{x.abre_em ? ` · ${dataHora(x.abre_em)}` : ''} · {x.respostas} resposta{x.respostas === 1 ? '' : 's'}</option>)}
          </select>
        </label>
      )}
      {!previa && real?.liberado && <p><a className="btn btn-sec btn-pequeno" href={`/api/gestao/pulso/${p.id}/exportar${rodada ? `?rodada=${rodada}` : real.rodada ? `?rodada=${real.rodada}` : ''}`} download>Exportar CSV (Excel)</a></p>}
      {r && !r.liberado && <>
        <p className="suave" role="status">{r.respostas} de {r.minimo} respostas. Para proteger o anonimato, o resultado só aparece a partir de {r.minimo} respostas.</p>
        <button type="button" className="btn btn-sec btn-pequeno" onClick={() => setPrevia(true)}>Ver prévia com dados de exemplo</button>
      </>}
      {previa && <p className="aviso-previa" role="status"><b>Prévia:</b> números inventados, só para mostrar como o resultado vai ficar. <button type="button" className="btn btn-sec btn-pequeno" onClick={() => setPrevia(false)}>Sair da prévia</button></p>}
      {r?.liberado && <ResultadoCorpo r={r} edicao={previa ? undefined : { liberado, setLiberado, pub, setPub }} />}
    </JanelaForm>
  );
}

/** Enviar a mesma pesquisa de novo: novo período e público (todos = nova rodada; só pendentes = continua a rodada). */
function ReenviarPesquisa({ p, aoFechar, aoConcluir }: { p: Pulso; aoFechar: () => void; aoConcluir: () => void }) {
  const [abre, setAbre] = useState('');
  const [fecha, setFecha] = useState('');
  const [publico, setPublico] = useState<'todos' | 'pendentes'>(p.respostas > 0 && p.pendentes > 0 ? 'pendentes' : 'todos');
  return (
    <JanelaForm titulo="Enviar a pesquisa de novo" rotuloEnviar="Enviar de novo" aoFechar={aoFechar}
      aoEnviar={async () => {
        await api(`/api/gestao/pulso/${p.id}/reenviar`, { abre_em: abre, fecha_em: fecha, publico });
        await avisar({ titulo: 'Pesquisa enviada de novo', mensagem: publico === 'todos' ? 'Abriu uma nova rodada para todos. As pessoas recebem o aviso (push) e o pop-up ao entrar.' : `A pesquisa voltou ao ar para quem ainda não respondeu (${p.pendentes} pessoa${p.pendentes === 1 ? '' : 's'}).` });
        aoConcluir();
      }}>
      <p style={{ marginTop: 0 }}><b>{p.pergunta}</b><br /><small className="suave">Rodada {p.rodada}: {p.respostas} resposta{p.respostas === 1 ? '' : 's'} · {p.pendentes} pessoa{p.pendentes === 1 ? '' : 's'} ainda não respondeu</small></p>
      <div className="pr-reenvio-datas">
        <label>Abre em (opcional)<input type="datetime-local" value={abre} onChange={(e) => setAbre(e.target.value)} /></label>
        <label>Encerra em (opcional)<input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      <small className="suave">Em branco, abre agora e fica no ar até você encerrar.</small>
      <fieldset className="pr-publico">
        <legend>Enviar para</legend>
        <label className="linha"><input type="radio" name="publico" checked={publico === 'pendentes'} onChange={() => setPublico('pendentes')} /> <span><b>Só quem ainda não respondeu</b> ({p.pendentes}). Continua a mesma rodada e avisa só essas pessoas.</span></label>
        <label className="linha"><input type="radio" name="publico" checked={publico === 'todos'} onChange={() => setPublico('todos')} /> <span><b>Todos</b>. Abre uma nova rodada: todos respondem de novo e o resultado fica separado do anterior.</span></label>
      </fieldset>
    </JanelaForm>
  );
}

/** Publicar › Pesquisas (RH): várias perguntas por pesquisa, tipos livres (nota, escolha única, múltipla, texto), imagens; resposta anônima. */
export function PesquisaPulso() {
  const [resultado, setResultado] = useState<Pulso | null>(null);
  const perms = usePermissoes();
  const podeEditar = perms === null || perms.includes('pub.pulso.editar');
  const [reenvio, setReenvio] = useState<{ p: Pulso; recarregar: () => void } | null>(null);
  const veResultado = perms === null || perms.includes('pub.pulso.resultado'); // só administrador e perfil RH
  return (
    <>
      <Crud<Pulso> base="/api/gestao/pulso" rotuloItem="pesquisa" feminino larga gradeClasse="grade-pesq" idDe={(r) => r.id}
        introducao="Monte pesquisas do jeito que precisar (cardápio da festa, atrações, clima…): várias perguntas, cada uma com o tipo de resposta que escolher e, se quiser, imagem. Ao criar, escolha se é anônima (padrão; o resultado só aparece com pelo menos 5 respostas) ou identificada (o RH vê quem respondeu). Pode haver várias pesquisas abertas; cada pessoa responde uma vez. As perguntas não mudam depois que alguém responde."
        campos={[
          { chave: 'pergunta', rotulo: 'Título da pesquisa', obrigatorio: true, max: 160, metade: true, classe: 'gp-2', dica: 'Ex.: Festa de final de ano — cardápio e atrações' },
          { chave: 'descricao', rotulo: 'Explicação (opcional)', tipo: 'area', linhas: 4, max: 500, metade: true, classe: 'gp-alto', dica: 'Aparece antes das perguntas.' },
          { chave: 'anonima', rotulo: 'Tipo de pesquisa', tipo: 'select', opcoes: [['1', 'Anônima (ninguém sabe quem respondeu)'], ['0', 'Identificada (o RH vê quem respondeu o quê)']], metade: true, classe: 'gp-1', dica: 'Não dá para trocar depois que alguém responde. Em pesquisa identificada, quem responde é avisado.' },
          { chave: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['rascunho', 'Rascunho'], ['aberto', 'Aberta (aparece para as pessoas responderem)'], ['encerrado', 'Encerrada']], metade: true, classe: 'gp-1' },
          { chave: 'abre_em', rotulo: 'Abre em (opcional)', tipo: 'datahora', metade: true, classe: 'gp-1', dica: 'Vale para pesquisa "Aberta".' },
          { chave: 'fecha_em', rotulo: 'Encerra em (opcional)', tipo: 'datahora', metade: true, classe: 'gp-1', dica: 'Sai do ar sozinha.' },
          { chave: 'perguntas', rotulo: 'Perguntas', tipo: 'custom', render: (v, m, todos) => <EditorPerguntas valor={v as PerguntaForm[]} mudar={m} bloqueado={todos.bloqueado === true} /> },
        ]}
        colunas={[
          { titulo: 'Pesquisa', ver: (r) => r.pergunta },
          { titulo: 'Perguntas', ver: (r) => r.n_perguntas, ordem: (r) => r.n_perguntas },
          { titulo: 'Tipo', ver: (r) => (r.anonima ? 'Anônima' : 'Identificada') },
          { titulo: 'Situação', ver: (r) => { const [t, x] = SIT[r.situacao ?? r.status] ?? ['neutro', r.status]; return <Selo texto={x} tom={t} />; } },
          { titulo: 'No ar', ver: (r) => (r.abre_em || r.fecha_em ? `${r.abre_em ? dataHora(r.abre_em) : 'já'} → ${r.fecha_em ? dataHora(r.fecha_em) : 'sem prazo'}` : '—') },
          { titulo: 'Respostas', ver: (r) => `${r.respostas}${r.rodada > 1 ? ` (rodada ${r.rodada})` : ''}`, ordem: (r) => r.respostas },
        ]}
        valoresNovos={{ pergunta: '', descricao: '', abre_em: '', fecha_em: '', status: 'rascunho', anonima: '1', perguntas: [perguntaNova('nota')], bloqueado: false }}
        paraForm={(r) => ({ pergunta: r.pergunta, descricao: r.descricao ?? '', abre_em: r.abre_em ?? '', fecha_em: r.fecha_em ?? '', status: r.status, anonima: r.anonima ? '1' : '0', perguntas: r.perguntas.map((q) => ({ ...q })), bloqueado: r.total_respostas > 0 })}
        acoesExtra={(r, _salvar, recarregar) => (<>
          {veResultado && <button className="btn btn-sec btn-pequeno" onClick={() => setResultado(r)}>Resultado</button>}
          {podeEditar && <button className="btn btn-sec btn-pequeno" title="Abre a mesma pesquisa de novo, com um novo período" onClick={() => setReenvio({ p: r, recarregar })}>Enviar de novo</button>}
        </>)}
      />
      {resultado && <ResultadoPulso p={resultado} aoFechar={() => setResultado(null)} />}
      {reenvio && <ReenviarPesquisa p={reenvio.p} aoFechar={() => setReenvio(null)} aoConcluir={() => { reenvio.recarregar(); setReenvio(null); }} />}
    </>
  );
}
