import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { formatoPorNome } from './formatoDocumento.ts';

type Valores = Record<string, string | boolean>;

interface Pasta { sub: string; itens: { nome: string; pasta: boolean }[] }

/** Navegador da pasta de documentos do portal: entra nas subpastas e escolhe o arquivo com um clique. */
function EscolherNaPasta({ valor, escolher }: { valor: string; escolher: (caminho: string) => void }) {
  // Parte da pasta do arquivo já escolhido; ignora valores de outra origem (link http, caminho de rede).
  const [sub, setSub] = useState(() => (/^[a-z][a-z0-9+.-]*:|\\/i.test(valor) || !valor.includes('/')) ? '' : valor.slice(0, valor.lastIndexOf('/')));
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    setErro('');
    api<Pasta>(`/api/gestao/documentos/pasta?sub=${encodeURIComponent(sub)}`).then(setPasta).catch((e: Error) => { setPasta(null); setErro(e.message); });
  }, [sub]);
  const partes = sub ? sub.split('/') : [];
  return (
    <div className="doc-pasta">
      <div className="doc-pasta-topo" aria-label="Pasta atual">
        <Icone nome="documentos" tamanho={14} />
        <button type="button" className="link-bt" onClick={() => setSub('')}>Documentos do portal</button>
        {partes.map((p, i) => <span key={i}> / <button type="button" className="link-bt" onClick={() => setSub(partes.slice(0, i + 1).join('/'))}>{p}</button></span>)}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {pasta && (
        <ul className="doc-pasta-lista">
          {sub && <li><button type="button" onClick={() => setSub(partes.slice(0, -1).join('/'))}>↰ Voltar</button></li>}
          {pasta.itens.length === 0 && <li className="suave vazio-pasta">Esta pasta está vazia.</li>}
          {pasta.itens.map((i) => {
            const caminho = sub ? `${sub}/${i.nome}` : i.nome;
            return (
              <li key={i.nome}>
                <button type="button" className={!i.pasta && caminho === valor ? 'ativo' : undefined} onClick={() => (i.pasta ? setSub(caminho) : escolher(caminho))}>
                  {i.pasta ? '📁' : '📄'} {i.nome}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Une o nome do arquivo escolhido (o navegador não informa a pasta) ao caminho já digitado. */
function juntarNome(atual: string, nome: string): string {
  const a = atual.trim();
  if (!a) return nome;
  const sep = a.includes('\\') ? '\\' : '/';
  if (/[\\/]$/.test(a)) return a + nome;
  const ultimo = a.slice(Math.max(a.lastIndexOf('\\'), a.lastIndexOf('/')) + 1);
  if (ultimo.includes('.')) return a.slice(0, a.length - ultimo.length) + nome;
  return a + sep + nome;
}

/** Endereço do documento: muda conforme "Onde está o documento" (link, pasta do portal ou caminho de rede). */
export function CampoDocumento({ rotulo, todos, mudarVarios }: { rotulo: string; todos: Valores; mudarVarios: (p: Valores) => void }) {
  const origem = String(todos.origem ?? 'link');
  const valor = String(todos.link_oficial ?? '');
  const arquivo = useRef<HTMLInputElement>(null);
  const anterior = useRef(origem);
  useEffect(() => { if (anterior.current !== origem) { anterior.current = origem; mudarVarios({ link_oficial: '' }); } }, [origem]); // eslint-disable-line react-hooks/exhaustive-deps
  const definir = (endereco: string, nome = endereco) => {
    const f = formatoPorNome(nome);
    mudarVarios(f ? { link_oficial: endereco, formato: f } : { link_oficial: endereco });
  };
  return (
    <div className="campo-doc">
      <span className="rotulo-doc">{rotulo}</span>
      {origem === 'link' && (
        <input type="text" maxLength={500} value={valor} placeholder="https://…" aria-label={rotulo} onChange={(e) => definir(e.target.value)} />
      )}
      {origem === 'rede' && (
        <>
          <div className="linha-doc">
            <input type="text" maxLength={500} value={valor} placeholder="\\servidor\pasta\arquivo.pdf" aria-label={rotulo} onChange={(e) => definir(e.target.value)} />
            <button type="button" className="btn btn-sec" onClick={() => arquivo.current?.click()}>Escolher arquivo…</button>
            <input ref={arquivo} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) definir(juntarNome(valor, f.name), f.name); e.target.value = ''; }} />
          </div>
          <small className="suave">O navegador só informa o <strong>nome</strong> do arquivo, nunca a pasta. Digite ou cole a pasta do servidor (ex.: \\servidor\rh\) e depois use "Escolher arquivo…" para completar o nome e o formato.</small>
        </>
      )}
      {origem === 'pasta' && (
        <>
          <input type="text" readOnly value={valor} placeholder="Nenhum arquivo escolhido — clique em um arquivo abaixo" aria-label={rotulo} />
          <EscolherNaPasta valor={valor} escolher={(c) => definir(c, c)} />
        </>
      )}
    </div>
  );
}
