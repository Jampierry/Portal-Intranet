import { confirmar } from '../Confirmar.tsx';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { DicaAba } from '../Dica';
import { JanelaForm, Selo } from './Crud';

interface Navegacao { caminho: string; pai: string | null; pastas: { nome: string; caminho: string }[] }
interface Origem { id: number; nome: string; caminho: string; acessivel?: boolean }
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Edicao = { id: number | null; nome: string; caminho: string };

/** Janela de cadastro: nome, pasta (digitada ou escolhida pelo seletor de pastas do servidor). */
function JanelaOrigem({ inicial, aoFechar, aoSalvar }: { inicial: Edicao; aoFechar: () => void; aoSalvar: () => void }) {
  const [v, setV] = useState(inicial);
  const [nav, setNav] = useState<Navegacao | null>(null);
  const [erroNav, setErroNav] = useState('');
  const [filtro, setFiltro] = useState('');
  const procurar = async (caminho: string) => {
    setErroNav(''); setFiltro('');
    try { setNav(await api<Navegacao>(`/api/gestao/documentos/origens/navegar?caminho=${encodeURIComponent(caminho)}`)); }
    catch (e) { setErroNav((e as Error).message); }
  };
  const enviar = async () => {
    const corpo = { nome: v.nome, caminho: v.caminho };
    if (v.id === null) await api('/api/gestao/documentos/origens', corpo); else await api(`/api/gestao/documentos/origens/${v.id}`, corpo, 'PUT');
    aoSalvar();
  };
  const alvo = semAcento(filtro.trim());
  const pastas = (nav?.pastas ?? []).filter((p) => !alvo || semAcento(p.nome).includes(alvo));
  return (
    <JanelaForm titulo={v.id === null ? 'Nova origem de documentos' : 'Editar origem de documentos'} aoFechar={aoFechar} aoEnviar={enviar}>
      <div className="form-origem">
        <label htmlFor="orig-nome">Nome (aparece ao publicar) *
          <input id="orig-nome" type="text" maxLength={40} required value={v.nome} placeholder="RH" onChange={(e) => setV({ ...v, nome: e.target.value })} />
        </label>
        <div className="campo-doc">
          <label htmlFor="orig-caminho" className="rotulo-doc">Pasta no servidor *</label>
          <div className="linha-doc">
            <input id="orig-caminho" type="text" maxLength={500} required value={v.caminho} placeholder="\\servidor\rh\Documentos" onChange={(e) => setV({ ...v, caminho: e.target.value })} />
            <button type="button" className="btn btn-sec" onClick={() => procurar(v.caminho)}>Procurar…</button>
          </div>
          <small className="suave">Digite o caminho ou use "Procurar…" para navegar pelas pastas que o servidor do portal enxerga.</small>
        </div>
        {erroNav && <p className="erro" role="alert">{erroNav}</p>}
        <div className="doc-pasta">
          {!nav && <p className="doc-pasta-vazio suave">As pastas do servidor aparecem aqui ao clicar em “Procurar…”.</p>}
          {nav && (<>
            <div className="doc-pasta-topo" title={nav.caminho}>{nav.caminho || 'Unidades do servidor'}</div>
            <div className="doc-pasta-busca"><input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Pesquisar pasta…" aria-label="Pesquisar pasta" /></div>
            <ul className="doc-pasta-lista">
              {nav.pai !== null && <li><button type="button" onClick={() => procurar(nav.pai ?? '')}>↰ Voltar</button></li>}
              {nav.pastas.length === 0 && <li className="suave vazio-pasta">Sem subpastas.</li>}
              {nav.pastas.length > 0 && pastas.length === 0 && <li className="suave vazio-pasta">Nada encontrado para “{filtro}”.</li>}
              {pastas.map((p) => <li key={p.caminho}><button type="button" onClick={() => procurar(p.caminho)}>📁 {p.nome}</button></li>)}
            </ul>
            <div className="doc-pasta-acoes">
              <button type="button" className="btn" disabled={!nav.caminho} onClick={() => { setV({ ...v, caminho: nav.caminho }); setNav(null); }}>Usar esta pasta</button>
              <button type="button" className="btn btn-sec" onClick={() => setNav(null)}>Fechar</button>
            </div>
          </>)}
        </div>
      </div>
    </JanelaForm>
  );
}

/** Configurações › Pastas de documentos (só administrador): pastas do servidor/rede de onde os documentos são escolhidos. */
export function OrigensDocumentos() {
  const [lista, setLista] = useState<Origem[] | null>(null);
  const [edit, setEdit] = useState<Edicao | null>(null);
  const [erro, setErro] = useState('');
  const carregar = () => api<Origem[]>('/api/gestao/documentos/origens').then(setLista).catch((e: Error) => setErro(e.message));
  useEffect(() => { void carregar(); }, []);

  const apagar = async (o: Origem) => {
    if (!(await confirmar({ titulo: 'Apagar origem', mensagem: `Apagar a origem "${o.nome}"? Os arquivos no servidor não são tocados.`, confirmar: 'Apagar', perigo: true }))) return;
    setErro('');
    try { await api(`/api/gestao/documentos/origens/${o.id}`, undefined, 'DELETE'); await carregar(); } catch (e) { setErro((e as Error).message); }
  };

  return (
    <section className="crud">
      <DicaAba>Cadastre aqui as pastas do servidor de onde os documentos são escolhidos (ex.: RH = \\servidor\rh\Documentos). Quem publica escolhe a origem e clica no arquivo, sem digitar caminho. O portal só lê; os arquivos continuam onde estão. O servidor do portal precisa de permissão de leitura na pasta (fale com a TI).</DicaAba>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="barra"><button type="button" className="btn" onClick={() => setEdit({ id: null, nome: '', caminho: '' })}>Nova origem</button></div>
      {lista && lista.length === 0 && <p className="vazio">Nenhuma origem cadastrada.</p>}
      {lista && lista.length > 0 && (
        <table className="tabela">
          <thead><tr><th>Nome</th><th>Pasta no servidor</th><th>Acesso do portal</th><th /></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td>{o.nome}</td>
                <td>{o.caminho}</td>
                <td><Selo texto={o.acessivel ? 'Lendo' : 'Sem acesso'} tom={o.acessivel ? 'ok' : 'aviso'} /></td>
                <td className="acoes-linha">
                  <button type="button" className="btn btn-sec" onClick={() => setEdit({ id: o.id, nome: o.nome, caminho: o.caminho })}>Editar</button>
                  <button type="button" className="btn btn-sec" onClick={() => apagar(o)}>Apagar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && <JanelaOrigem inicial={edit} aoFechar={() => setEdit(null)} aoSalvar={() => { setEdit(null); void carregar(); }} />}
    </section>
  );
}
