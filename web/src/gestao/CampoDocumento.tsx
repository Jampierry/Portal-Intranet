import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { formatoPorNome } from './formatoDocumento.ts';

type Valores = Record<string, string | boolean | object>;

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Pasta { sub: string; itens: { nome: string; pasta: boolean }[] }

/** Navegador da pasta de documentos do portal: entra nas subpastas e escolhe o arquivo com um clique. */
function EscolherNaPasta({ origem, valor, escolher }: { origem: string; valor: string; escolher: (caminho: string) => void }) {
  // Parte da pasta do arquivo já escolhido; ignora valores de outra origem (link http, caminho de rede).
  const [sub, setSub] = useState(() => (/^[a-z][a-z0-9+.-]*:|\\/i.test(valor) || !valor.includes('/')) ? '' : valor.slice(0, valor.lastIndexOf('/')));
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  useEffect(() => {
    setErro(''); setFiltro('');
    api<Pasta>(`/api/gestao/documentos/pasta?sub=${encodeURIComponent(sub)}${/^s\d+$/.test(origem) ? `&origem=${origem.slice(1)}` : ''}`).then(setPasta).catch((e: Error) => { setPasta(null); setErro(e.message); });
  }, [sub, origem]);
  const alvo = semAcento(filtro.trim());
  const visiveis = (pasta?.itens ?? []).filter((i) => !i.nome.startsWith('~$') && (!alvo || semAcento(i.nome).includes(alvo)));
  const partes = sub ? sub.split('/') : [];
  return (
    <div className="doc-pasta">
      <div className="doc-pasta-topo" aria-label="Pasta atual">
        <Icone nome="documentos" tamanho={14} />
        <button type="button" className="link-bt" onClick={() => setSub('')}>{origem === 'pasta' ? 'Documentos do portal' : 'Início da pasta'}</button>
        {partes.map((p, i) => <span key={i}> / <button type="button" className="link-bt" onClick={() => setSub(partes.slice(0, i + 1).join('/'))}>{p}</button></span>)}
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {pasta && (
        <div className="doc-pasta-busca"><input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Pesquisar nesta pasta…" aria-label="Pesquisar nesta pasta" /></div>
      )}
      {pasta && (
        <ul className="doc-pasta-lista">
          {sub && <li><button type="button" onClick={() => setSub(partes.slice(0, -1).join('/'))}>↰ Voltar</button></li>}
          {pasta.itens.length === 0 && <li className="suave vazio-pasta">Esta pasta está vazia.</li>}
          {pasta.itens.length > 0 && visiveis.length === 0 && <li className="suave vazio-pasta">Nada encontrado para “{filtro}”.</li>}
          {visiveis.map((i) => {
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

const LIMITE_MB = 50;
/** Escolhe um arquivo do computador de quem publica e o envia para a pasta de documentos do portal; devolve o caminho dentro da pasta. */
function EnviarDoComputador({ aoEnviar, rotulo }: { aoEnviar: (caminho: string, nome: string) => void; rotulo: string }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const escolher = async (arq: File | undefined) => {
    if (!arq) return;
    setErro('');
    if (arq.size > LIMITE_MB * 1024 * 1024) return setErro(`O arquivo passa de ${LIMITE_MB} MB. Escolha um menor.`);
    setEnviando(true);
    try {
      const r = await fetch(`/api/gestao/documentos/arquivo?nome=${encodeURIComponent(arq.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-documento' }, body: arq, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({})) as { caminho?: string; nome?: string; erro?: string };
      if (!r.ok || !j.caminho) throw new Error(j.erro ?? `Erro ${r.status}`);
      aoEnviar(j.caminho, j.nome ?? arq.name);
    } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  };
  return (
    <div className="doc-envio">
      <label className="btn btn-sec btn-pequeno" style={{ margin: 0 }}>
        {enviando ? 'Enviando…' : rotulo}
        <input type="file" className="so-leitor" disabled={enviando} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp" aria-label="Escolher arquivo do computador"
          onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  );
}

/** Endereço do documento: muda conforme "Onde está o documento" (link, pasta do portal ou caminho de rede). */
export function CampoDocumento({ rotulo, todos, mudarVarios }: { rotulo: string; todos: Valores; mudarVarios: (p: Valores) => void }) {
  const origem = String(todos.origem ?? 'link');
  const valor = String(todos.link_oficial ?? '');
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
      {origem === 'envio' && (
        <>
          <input type="text" readOnly value={valor} placeholder="Nenhum arquivo escolhido" aria-label={rotulo} />
          <EnviarDoComputador rotulo={valor ? 'Trocar arquivo…' : 'Escolher arquivo do computador…'} aoEnviar={(c, n) => definir(c, n)} />
          <small className="suave">O arquivo é enviado para a pasta de documentos do portal assim que você o escolhe. PDF, Word, Excel, PowerPoint, imagem, TXT ou CSV, até {LIMITE_MB} MB.</small>
        </>
      )}
      {origem !== 'link' && origem !== 'envio' && (
        <>
          <input type="text" readOnly value={valor} placeholder="Nenhum arquivo escolhido — clique em um arquivo abaixo" aria-label={rotulo} />
          {origem === 'pasta' && <EnviarDoComputador rotulo="Enviar arquivo do computador…" aoEnviar={(c, n) => definir(c, n)} />}
          <EscolherNaPasta origem={origem} valor={valor} escolher={(c) => definir(c, c)} />
        </>
      )}
    </div>
  );
}
