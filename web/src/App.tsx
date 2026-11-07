import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PainelTema, useTema } from './tema';
import { Menu, type Tela } from './Menu';
import { Icone } from './icones';
import { Avatar, usePerfil } from './perfil';
import { JanelaConta } from './Conta';
import { Login, TrocaObrigatoria } from './Login';
import { podeGerir, useSessao, type Usuario } from './sessao';
import { Gestao } from './gestao/Gestao';
import { dataCurta, useLista, type Aplicacao, type Comunicado } from './dados';
import { Inicio } from './inicio/Inicio';
import { Comunicados } from './comunicados/Comunicados';
import { Aplicacoes } from './aplicacoes/Aplicacoes';
import { Documentos } from './documentos/Documentos';
import { Lancador } from './aplicacoes/Lancador';

interface Saude { ok: boolean; versao: string; modulos: string[] }

const ABAS: [Tela | 'menu', string, string][] = [['inicio', 'Início', 'inicio'], ['comunicados', 'Comunicados', 'comunicados'], ['aplicacoes', 'Aplicações', 'aplicacoes'], ['menu', 'Menu', 'menu']];

// Avisos de cada tela, mostrados na barra superior (barra universal) em vez de dentro da página.
const AVISOS: Record<Tela, string> = {
  inicio: 'No computador, as aplicações web abrem em nova aba; no celular, use Voltar do navegador.',
  comunicados: 'Avisos publicados pelas áreas responsáveis.',
  aplicacoes: 'No computador, as aplicações abrem em nova aba; no celular, use Voltar. Seus favoritos ficam salvos na sua conta.',
  documentos: 'Os arquivos ficam nos sistemas de origem: abra pelo link oficial de cada documento.',
  gestao: 'Todas as alterações feitas aqui ficam registradas na auditoria.',
};
const TELAS: Tela[] = ['inicio', 'comunicados', 'aplicacoes', 'documentos', 'gestao'];
interface Rota { tela: Tela; slug?: string }
/** Endereço: #comunicados, #comunicados/<slug>, #aplicacoes... (vazio = início). */
const rotaDoEndereco = (): Rota => {
  const [t, slug] = location.hash.slice(1).split('/');
  return TELAS.includes(t as Tela) ? { tela: t as Tela, slug: slug ? decodeURIComponent(slug) : undefined } : { tela: 'inicio' };
};
/** Sino da barra superior: lista os comunicados urgentes (vem do PREMIA: sino com contador e lista de pendências). */
function Sino({ itens, ir }: { itens: Comunicado[]; ir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  return (
    <div className="tema-raiz" ref={raiz}>
      <button className="icone-btn sino" aria-label={`Avisos${itens.length ? `: ${itens.length} urgente(s)` : ''}`} aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(!aberto)}>
        <Icone nome="sino" />{itens.length > 0 && <i className="ponto-aviso" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="tema-painel painel-avisos" role="dialog" aria-label="Avisos">
          <h3>Avisos</h3>
          {itens.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhum aviso urgente no momento.</p> : itens.map((c) => (
            <button key={c.slug} className="aviso" onClick={() => { setAberto(false); ir(); }}><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)}</small></button>
          ))}
        </div>
      )}
    </div>
  );
}

function Portal({ usuario, sair }: { usuario: Usuario; sair: () => Promise<void> }) {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [rota, setRota] = useState<Rota>(rotaDoEndereco);
  const tela = rota.tela;
  const [gaveta, setGaveta] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [lancador, setLancador] = useState(false);
  const [busca, setBusca] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [avisoFav, setAvisoFav] = useState('');
  const { config, mudar } = useTema();
  const { perfil, mudarAvatar } = usePerfil(usuario.login, usuario.nome);
  const gere = podeGerir(usuario);
  const { dados: apps } = useLista<Aplicacao>('/api/aplicacoes');
  const { dados: comunicados } = useLista<Comunicado>('/api/comunicados');
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente');
  const favs = (apps ?? []).filter((a) => favoritos.includes(a.slug));

  useEffect(() => { api<Saude>('/api/saude').then(setSaude).catch(() => setSaude(null)); }, []);
  useEffect(() => {
    if (!lancador) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setLancador(false); };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [lancador]);
  useEffect(() => { const f = () => setRota(rotaDoEndereco()); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  useEffect(() => { api<string[]>('/api/favoritos').then(setFavoritos).catch(() => setFavoritos([])); }, []);

  // Favoritos ficam na conta do usuário (servidor). Atualiza na hora e desfaz se o servidor recusar.
  const alternarFavorito = (slug: string) => {
    const ja = favoritos.includes(slug);
    setFavoritos((f) => (ja ? f.filter((x) => x !== slug) : [...f, slug])); setAvisoFav('');
    api(`/api/favoritos/${encodeURIComponent(slug)}`, ja ? undefined : {}, ja ? 'DELETE' : 'PUT').catch(() => {
      setFavoritos((f) => (ja ? [...f, slug] : f.filter((x) => x !== slug))); setAvisoFav('Não foi possível salvar o favorito. Tente de novo.');
    });
  };
  const irPara = (t: Tela, slug?: string) => { setRota({ tela: t, slug }); setGaveta(false); try { history.pushState(null, '', t === 'inicio' ? location.pathname : `#${t}${slug ? `/${encodeURIComponent(slug)}` : ''}`); } catch { /* sem histórico */ } document.getElementById('conteudo-principal')?.scrollTo?.(0, 0); };
  const buscar = (v: string) => { setBusca(v); if (v && tela === 'inicio') irPara('comunicados'); };

  return (
    <div className="app">
      <a className="pular" href="#conteudo-principal">Pular para o conteúdo</a>
      <Menu tela={tela} irPara={irPara} recolhido={config.menuRecolhido} gavetaAberta={gaveta} fecharGaveta={() => setGaveta(false)}
        alternar={() => (innerWidth <= 860 ? setGaveta(!gaveta) : mudar({ menuRecolhido: !config.menuRecolhido }))}
        apps={favs} mostrarGestao={gere} />
      {gaveta && <div className="cortina" onClick={() => setGaveta(false)} />}

      <div className="corpo">
        <header className="topo">
          <span className="bemvindo">Bem-vindo(a), <b>{perfil.nome}</b></span>
          <p className="aviso-universal" role="status"><Icone nome="info" tamanho={14} /><span>{AVISOS[tela]}</span></p>
          <span className="versao" title="Estado da API"><i aria-hidden="true" />v{saude?.versao ?? '…'}</span>
          <div className="busca-topo">
            <Icone nome="busca" tamanho={14} />
            <input type="search" placeholder="Buscar no portal" aria-label="Buscar no portal" value={busca} onChange={(e) => buscar(e.target.value)} />
          </div>
          <PainelTema config={config} mudar={mudar} />
          <button className="icone-btn lancador-mob" aria-label="Aplicativos" aria-expanded={lancador} onClick={() => setLancador(!lancador)}><Icone nome="apps" /></button>
          <Sino itens={urgentes} ir={() => irPara('comunicados')} />
          <button className="avbtn" onClick={() => setPerfilAberto(true)} aria-label="Minha conta" title={`${perfil.nome} — minha conta`}><Avatar nome={perfil.nome} avatar={perfil.avatar} tamanho={28} /></button>
        </header>

        <div className="meio">
          <main className="conteudo" id="conteudo-principal" tabIndex={-1}>
            {avisoFav && <p className="erro" role="alert">{avisoFav}</p>}
            {tela === 'inicio' && <Inicio irPara={irPara} comunicados={comunicados} />}
            {tela === 'comunicados' && <Comunicados slug={rota.slug} busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'aplicacoes' && <Aplicacoes busca={busca} limparBusca={() => setBusca('')} favoritos={favoritos} alternarFavorito={alternarFavorito} />}
            {tela === 'documentos' && <Documentos busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'gestao' && gere && <Gestao perfil={usuario.perfil} aba={rota.slug} aoMudarAba={(a) => irPara('gestao', a)} />}
            {tela === 'gestao' && !gere && <p className="erro">Você não tem acesso à gestão do portal.</p>}
            <footer className="rodape-portal"><span><b>Di Paula</b> | Intranet | Conectando pessoas, ideias e grandes movimentos.</span><span>Portal Intranet</span></footer>
          </main>
          <Lancador aberto={lancador} alternar={() => setLancador(!lancador)} fechar={() => setLancador(false)} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        </div>
      </div>

      <nav className="abas-mobile" aria-label="Navegação principal">
        {ABAS.map(([id, nome, ico]) => (
          <button key={id} aria-current={id === tela ? 'page' : undefined} onClick={() => (id === 'menu' ? setGaveta(true) : irPara(id))}><Icone nome={ico} tamanho={22} /><span>{nome}</span></button>
        ))}
      </nav>
      {perfilAberto && <JanelaConta usuario={usuario} avatar={perfil.avatar} mudarAvatar={mudarAvatar} sair={() => void sair()} fechar={() => setPerfilAberto(false)} />}
    </div>
  );
}

/** Porta de entrada: carrega a sessão e mostra login, troca obrigatória de senha ou o portal. */
export function App() {
  const { usuario, offline, entrar, sair, recarregar } = useSessao();
  if (offline) {
    return (
      <main className="conteudo">
        <h1>Portal Intranet</h1>
        <p className="erro">A API não respondeu. Rode <code>npm run dev</code> na pasta do projeto e recarregue a página.</p>
      </main>
    );
  }
  if (usuario === undefined) return <p className="carregando" role="status">Carregando…</p>;
  if (usuario === null) return <Login entrar={entrar} />;
  if (usuario.trocar_senha) return <TrocaObrigatoria nome={usuario.nome} aoConcluir={() => void recarregar()} sair={() => void sair()} />;
  return <Portal usuario={usuario} sair={sair} />;
}
