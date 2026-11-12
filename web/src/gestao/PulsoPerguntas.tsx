import { useId, useState } from 'react';

export interface OpcaoForm { texto: string; imagem: string | null }
export type TipoPergunta = 'nota' | 'unica' | 'multipla' | 'texto';
export interface PerguntaForm { texto: string; tipo: TipoPergunta; obrigatoria: boolean; imagem: string | null; opcoes: OpcaoForm[]; comentario: boolean }

export const TIPOS: [TipoPergunta, string][] = [
  ['nota', 'Nota de 1 a 5 (carinhas)'], ['unica', 'Escolha única (uma opção)'], ['multipla', 'Múltipla escolha (várias opções)'], ['texto', 'Resposta em texto'],
];
export const perguntaNova = (tipo: TipoPergunta = 'nota'): PerguntaForm => ({
  texto: '', tipo, obrigatoria: true, imagem: null, comentario: false,
  opcoes: tipo === 'unica' || tipo === 'multipla' ? [{ texto: '', imagem: null }, { texto: '', imagem: null }] : [],
});

/** Envia a imagem ao portal e devolve o endereço dela. */
async function enviarImagem(arq: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(arq.type)) throw new Error('Use uma imagem PNG, JPG, WebP ou GIF.');
  if (arq.size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB. Escolha uma menor.');
  const r = await fetch('/api/gestao/imagens', { method: 'POST', headers: { 'Content-Type': arq.type }, body: arq, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
  if (!r.ok || !j.url) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j.url;
}

function BotaoImagem({ valor, mudar, rotulo, cartao }: { valor: string | null; mudar: (v: string | null) => void; rotulo: string; /** Prévia grande (foto da opção). */ cartao?: boolean }) {
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  return (
    <span className={`pq-imagem${cartao ? ' pq-imagem-cartao' : ''}`}>
      {cartao && (valor ? <img src={valor} alt="" /> : <span className="pq-sem-foto" aria-hidden="true">Sem foto</span>)}
      {!cartao && valor && <img src={valor} alt="" />}
      <label className="btn btn-sec btn-pequeno" htmlFor={id} style={{ margin: 0 }}>{ocupado ? 'Enviando…' : valor ? 'Trocar foto' : rotulo}</label>
      <input id={id} type="file" className="so-leitor" accept="image/png,image/jpeg,image/webp,image/gif" disabled={ocupado} aria-label={rotulo}
        onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; if (!a) return; setErro(''); setOcupado(true); enviarImagem(a).then(mudar).catch((x: Error) => setErro(x.message)).finally(() => setOcupado(false)); }} />
      {valor && <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mudar(null)}>Remover</button>}
      {erro && <small className="erro" role="alert">{erro}</small>}
    </span>
  );
}

/** Editor das perguntas de uma pesquisa: tipo livre por pergunta, imagem na pergunta e nas opções, ordem e obrigatoriedade. */
export function EditorPerguntas({ valor, mudar, bloqueado }: { valor: PerguntaForm[]; mudar: (p: PerguntaForm[]) => void; bloqueado?: boolean }) {
  const troca = (i: number, p: Partial<PerguntaForm>) => mudar(valor.map((q, k) => (k === i ? { ...q, ...p } : q)));
  /** Perguntas minimizadas (por posição; acompanha a troca de ordem e a remoção). */
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  const alternar = (i: number) => setFechadas((a) => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const mover = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= valor.length) return;
    const c = [...valor]; [c[i], c[j]] = [c[j], c[i]]; mudar(c);
    setFechadas((a) => { const n = new Set(a); const x = a.has(i), y = a.has(j); n.delete(i); n.delete(j); if (x) n.add(j); if (y) n.add(i); return n; });
  };
  const remover = (i: number) => {
    mudar(valor.filter((_, k) => k !== i));
    setFechadas((a) => new Set([...a].filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))));
  };
  return (
    <div className="pq-editor" role="group" aria-label="Perguntas da pesquisa">
      <b className="pq-titulo">Perguntas da pesquisa ({valor.length})</b>
      <fieldset className="pq-sem-caixa" disabled={bloqueado}>
      {bloqueado && <p className="suave" role="status">Esta pesquisa já tem respostas: as perguntas não podem mais mudar. Crie uma nova pesquisa se precisar de outras perguntas.</p>}
      {valor.length < 30 && <button type="button" className="btn btn-sec btn-pequeno pq-add" onClick={() => mudar([...valor, perguntaNova('unica')])}>+ Adicionar pergunta</button>}
      <div className="pq-lista">
      {valor.map((q, i) => {
        const comOpcoes = q.tipo === 'unica' || q.tipo === 'multipla';
        const opc = (k: number, o: Partial<OpcaoForm>) => troca(i, { opcoes: q.opcoes.map((x, n) => (n === k ? { ...x, ...o } : x)) });
        return (
          <div className={`pq-cartao${fechadas.has(i) ? ' pq-fechado' : ''}`} key={i}>
            <div className="pq-topo">
              <button type="button" className="pq-num" onClick={() => alternar(i)} aria-expanded={!fechadas.has(i)} aria-label={`${fechadas.has(i) ? 'Expandir' : 'Minimizar'} a pergunta ${i + 1}`} title={fechadas.has(i) ? 'Expandir' : 'Minimizar'}>{i + 1}</button>
              <input type="text" required maxLength={300} value={q.texto} aria-label={`Texto da pergunta ${i + 1}`} onChange={(e) => troca(i, { texto: e.target.value })} placeholder="Texto da pergunta. Ex.: Qual cardápio você gostaria de ter na festa de confraternização 2026?" />
              <span className="pq-topo-acoes">
                <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir a pergunta ${i + 1}`}>↑</button>
                <button type="button" className="btn btn-sec btn-pequeno" onClick={() => mover(i, 1)} disabled={i === valor.length - 1} aria-label={`Descer a pergunta ${i + 1}`}>↓</button>
                <button type="button" className="btn btn-vermelho btn-pequeno" onClick={() => remover(i)} disabled={valor.length === 1} aria-label={`Remover a pergunta ${i + 1}`}>Remover</button>
              </span>
            </div>
            {!fechadas.has(i) && <div className="pq-linha">
              <select value={q.tipo} aria-label={`Tipo de resposta da pergunta ${i + 1}`} onChange={(e) => { const tipo = e.target.value as TipoPergunta; troca(i, { tipo, opcoes: tipo === 'unica' || tipo === 'multipla' ? (q.opcoes.length ? q.opcoes : perguntaNova(tipo).opcoes) : [] }); }}>
                {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
              <label className="linha"><input type="checkbox" checked={q.obrigatoria} onChange={(e) => troca(i, { obrigatoria: e.target.checked })} /> Obrigatória</label>
              {q.tipo === 'nota' && <label className="linha"><input type="checkbox" checked={q.comentario} onChange={(e) => troca(i, { comentario: e.target.checked })} /> Permitir comentário</label>}
              <BotaoImagem valor={q.imagem} mudar={(v) => troca(i, { imagem: v })} rotulo="Imagem da pergunta" />
            </div>}
            {comOpcoes && !fechadas.has(i) && (
              <div className="pq-opcoes">
                                <div className="pq-opcoes-grade">
                  {q.opcoes.map((o, k) => (
                    <div className="pq-opcao" key={k}>
                      <div className="pq-opcao-topo"><b>Opção {k + 1}</b>
                        <button type="button" className="btn btn-sec btn-pequeno" disabled={q.opcoes.length <= 2} onClick={() => troca(i, { opcoes: q.opcoes.filter((_, n) => n !== k) })} aria-label={`Remover a opção ${k + 1}`}>Remover</button>
                      </div>
                      <BotaoImagem valor={o.imagem} mudar={(v) => opc(k, { imagem: v })} rotulo="Escolher foto" cartao />
                      <textarea rows={2} required maxLength={200} value={o.texto} aria-label={`Texto da opção ${k + 1} da pergunta ${i + 1}`} placeholder="Ex.: Churrasco, arroz e salada" onChange={(e) => opc(k, { texto: e.target.value.replace(/\n/g, ' ') })} />
                    </div>
                  ))}
                  {q.opcoes.length < 20 && <button type="button" className="pq-opcao-nova" onClick={() => troca(i, { opcoes: [...q.opcoes, { texto: '', imagem: null }] })}>+ Adicionar opção</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
      </fieldset>
    </div>
  );
}
