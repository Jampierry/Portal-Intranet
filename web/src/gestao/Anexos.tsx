import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface Anexo { id: number; nome: string; tipo: string; tamanho: number }

const ACEITA = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.csv';
const LIMITE = 15 * 1024 * 1024;
const MAXIMO = 10;
const tamanho = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const EH_IMAGEM = /^(png|jpe?g|gif|webp|svg)$/;
const url = (a: Anexo) => `/api/redes/anexos/${a.id}`;

/** Miniatura da imagem ou, nos demais tipos, a etiqueta com a extensão. */
function Miniatura({ a }: { a: Anexo }) {
  return EH_IMAGEM.test(a.tipo)
    ? <img className="anexo-mini" src={url(a)} alt="" loading="lazy" />
    : <span className="anexo-mini anexo-mini-tipo" aria-hidden="true">{a.tipo.toUpperCase()}</span>;
}

/** Pop-up do anexo: prévia maior (imagens), dados do arquivo, setas para os outros anexos e as ações (abrir em outra aba, remover). */
function JanelaAnexo({ lista, indice, aoIr, aoFechar, aoRemover }: { lista: Anexo[]; indice: number; aoIr: (i: number) => void; aoFechar: () => void; aoRemover?: (a: Anexo) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const a = lista[indice];
  useEffect(() => { ref.current?.showModal(); }, []);
  const fechar = () => { ref.current?.close(); aoFechar(); };
  const ir = (passo: number) => aoIr((indice + passo + lista.length) % lista.length);
  const varios = lista.length > 1;
  // Portal no <body>: não herda o fechamento por clique fora da janela do formulário por trás (os eventos do React sobem pela árvore).
  return createPortal(
    <dialog ref={ref} className="janela janela-anexo" aria-label={`Anexo ${a.nome}`} onCancel={(e) => { e.preventDefault(); e.stopPropagation(); fechar(); }}
      onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) fechar(); }}
      onKeyDown={(e) => { e.stopPropagation(); if (varios && e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); } else if (varios && e.key === 'ArrowRight') { e.preventDefault(); ir(1); } }}>
      <div className="janela-form">
        <header><h2 className="anexo-titulo" title={a.nome}>{a.nome}</h2></header>
        <div className="anexo-palco">
          {varios && <button type="button" className="anexo-seta" onClick={() => ir(-1)} aria-label="Arquivo anterior">‹</button>}
          <div className="janela-corpo anexo-corpo">
            {EH_IMAGEM.test(a.tipo) ? <img key={a.id} className="anexo-grande" src={url(a)} alt={`Prévia de ${a.nome}`} /> : <span className="anexo-mini anexo-mini-tipo anexo-grande-tipo" aria-hidden="true">{a.tipo.toUpperCase()}</span>}
            <p className="suave anexo-dados">{a.tipo.toUpperCase()} · {tamanho(a.tamanho)}{varios ? ` · ${indice + 1} de ${lista.length}` : ''}</p>
          </div>
          {varios && <button type="button" className="anexo-seta" onClick={() => ir(1)} aria-label="Próximo arquivo">›</button>}
        </div>
        <footer>
          {aoRemover && <button type="button" className="btn btn-vermelho" onClick={() => aoRemover(a)}>Remover</button>}
          <a className="btn" href={url(a)} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a>
          <button type="button" className="btn btn-sec" onClick={fechar} autoFocus>Fechar</button>
        </footer>
      </div>
    </dialog>, document.body);
}

/** Grade de cartões; clicar num cartão abre o pop-up, onde as setas (ou ← →) passam para os outros anexos. */
function Grade({ anexos, classe, compacta, aoRemover }: { anexos: Anexo[]; classe: string; compacta?: boolean; aoRemover?: (a: Anexo) => void }) {
  const [aberto, setAberto] = useState<number | null>(null);
  // Se o anexo aberto some (remoção), fecha ou vai para o vizinho.
  const indice = aberto === null || anexos.length === 0 ? null : Math.min(aberto, anexos.length - 1);
  return (
    <>
      <ul className={classe} aria-label="Arquivos anexados">
        {anexos.map((a, i) => (
          <li key={a.id} className="anexo-cartao">
            <button type="button" className="anexo-abrir" onClick={() => setAberto(i)} title={`${a.nome} · ${a.tipo.toUpperCase()} · ${tamanho(a.tamanho)}`} aria-label={`Ver ${a.nome}`}>
              <Miniatura a={a} />
              <span className="anexo-nome">{a.nome}</span>
            </button>
            {!compacta && <small className="suave">{a.tipo.toUpperCase()} · {tamanho(a.tamanho)}</small>}
          </li>
        ))}
      </ul>
      {indice !== null && <JanelaAnexo lista={anexos} indice={indice} aoIr={setAberto} aoFechar={() => setAberto(null)} aoRemover={aoRemover} />}
    </>
  );
}

/** Lista de anexos de uma publicação (clicar abre o pop-up com as ações). */
export function ListaAnexos({ anexos, compacta = false }: { anexos: Anexo[]; /** Miniaturas pequenas, 3 por linha (para a tabela). */ compacta?: boolean }) {
  if (!anexos.length) return null;
  return <Grade anexos={anexos} compacta={compacta} classe={compacta ? 'anexos-grade anexos-compacta' : 'anexos-grade'} />;
}

/** Campo do formulário: anexar arquivos (PDF, Word, Excel, PowerPoint, imagens, SVG, TXT, CSV) para o RH conferir antes de aprovar. */
export function CampoAnexos({ valor, mudar }: { valor: Anexo[]; mudar: (v: Anexo[]) => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const escolher = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setErro(''); setEnviando(true);
    let lista = [...valor];
    try {
      for (const arq of Array.from(arquivos)) {
        if (lista.length >= MAXIMO) throw new Error(`No máximo ${MAXIMO} arquivos por publicação.`);
        if (arq.size > LIMITE) throw new Error(`«${arq.name}» passa de 15 MB.`);
        const r = await fetch(`/api/gestao/redes/anexos?nome=${encodeURIComponent(arq.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: arq, credentials: 'same-origin' });
        const j = await r.json().catch(() => ({})) as Anexo & { erro?: string };
        if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
        lista = [...lista, { id: j.id, nome: j.nome, tipo: j.tipo, tamanho: j.tamanho }];
        mudar(lista);
      }
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  };
  return (
    <div className="campo-anexos">
      <span className="rotulo-campo">Arquivos para o RH conferir (opcional)</span>
      {valor.length > 0 && <Grade anexos={valor} classe="anexos-grade anexos-rolagem" aoRemover={(a) => mudar(valor.filter((x) => x.id !== a.id))} />}
      <label className="btn btn-sec btn-pequeno" style={{ margin: 0, width: 'fit-content' }}>
        {enviando ? 'Enviando…' : 'Anexar arquivos…'}
        <input type="file" multiple accept={ACEITA} className="so-leitor" disabled={enviando || valor.length >= MAXIMO} onChange={(e) => { void escolher(e.target.files); e.target.value = ''; }} />
      </label>
      <small className="suave">PDF, Word, Excel, PowerPoint, imagens, SVG, TXT ou CSV. Até 15 MB cada, no máximo {MAXIMO} arquivos. O RH abre e confere antes de aprovar.</small>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  );
}
