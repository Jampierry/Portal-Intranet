import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PainelTema, useTema } from './tema';
import { Menu, type Tela } from './Menu';
import { Icone } from './icones';
import { Avatar, usePerfil } from './perfil';
import { BuscaGlobal } from './BuscaGlobal';
import { JanelaConta } from './Conta';
import { Login, TrocaObrigatoria } from './Login';
import { pode, podeGerir, useSessao, type Usuario } from './sessao';
import { Publicar, Configuracoes } from './gestao/Gestao';
import { Pessoas } from './pessoas/Pessoas';
import { Ajuda } from './ajuda/Ajuda';
import { dataCurta, useLista, type Comunicado } from './dados';
import { Inicio } from './inicio/Inicio';
import { Comunicados } from './comunicados/Comunicados';
import { Documentos } from './documentos/Documentos';
import { CalendarioPagina } from './CalendarioPagina';
import { podeAbaCalendario } from './calendarioTipos';
import { Lancador } from './aplicacoes/Lancador';
import { useEmpresa } from './empresa';

interface Saude { ok: boolean; versao: string; modulos: string[] }

const ABAS: [Tela | 'menu' | 'apps', string, string][] = [['inicio', 'Início', 'inicio'], ['comunicados', 'Comunicados', 'comunicados'], ['apps', 'Aplicativos', 'apps'], ['menu', 'Menu', 'menu']];

// Avisos de cada tela, mostrados na barra superior (barra universal) em vez de dentro da página.
const AVISOS: Record<Tela, string> = {
  inicio: 'Aplicativos: use a barra da direita. No computador abrem em nova aba; no celular, use Voltar do navegador.',
  comunicados: 'Avisos publicados pelas áreas responsáveis.',
  calendario: 'Feriados, datas importantes e as agendas da empresa. Use os filtros para escolher o que mostrar.',
  documentos: 'Os arquivos ficam nos sistemas de origem: abra pelo link oficial de cada documento.',
  publicar: 'O que for publicado aparece no portal conforme a situação e a janela de exibição.',
  configuracoes: 'Usuários, perfis e auditoria do portal. Só o administrador acessa.',
  pessoas: 'Contatos por área: e-mail, ramal ou ferramenta de chamados. Não há dados pessoais de funcionários aqui.',
  ajuda: 'Respostas rápidas sobre login, aplicações, comunicados e documentos.',
};
// Nome de cada tela, mostrado na barra superior universal (não aparece dentro da janela).
const TITULOS: Record<Tela, string> = { inicio: 'Início', comunicados: 'Comunicados', calendario: 'Calendário', documentos: 'Documentos', publicar: 'Publicar', configuracoes: 'Configurações', pessoas: 'Pessoas', ajuda: 'Ajuda' };
const TELAS: Tela[] = ['inicio', 'comunicados', 'calendario', 'documentos', 'publicar', 'configuracoes', 'pessoas', 'ajuda'];
interface Rota { tela: Tela; slug?: string }
/** Endereço: #comunicados, #comunicados/<slug>, #aplicacoes... (vazio = início). */
const rotaDoEndereco = (): Rota => {
  let [t, slug] = location.hash.slice(1).split('/');
  // Endereços antigos (#gestao/...) levam à tela nova correspondente.
  if (t === 'gestao') t = ['usuarios', 'auditoria'].includes(slug) ? 'configuracoes' : 'publicar';
  return TELAS.includes(t as Tela) ? { tela: t as Tela, slug: slug ? decodeURIComponent(slug) : undefined } : { tela: 'inicio' };
};
/** Sino da barra superior: lista os comunicados urgentes (vem do PREMIA: sino com contador e lista de pendências). */
interface PedidoSenha { id: number; usuario_id: number; criado_em: string; login: string; nome: string }
function Sino({ itens, ir, pedidos, irPedidos }: { itens: Comunicado[]; ir: () => void; pedidos: PedidoSenha[]; irPedidos: () => void }) {
  const [aberto, setAberto] = useState(false);
  const total = itens.length + pedidos.length;
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
      <button className="icone-btn sino" aria-label={`Avisos${total ? `: ${total} pendente(s)` : ''}`} aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(!aberto)}>
        <Icone nome="sino" />{total > 0 && <i className="ponto-aviso" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="tema-painel painel-avisos" role="dialog" aria-label="Avisos">
          <h3>Avisos</h3>
          {pedidos.length > 0 && <small className="aviso-grupo">Pedidos de nova senha</small>}
          {pedidos.map((p) => (
            <button key={p.id} className="aviso" onClick={() => { setAberto(false); irPedidos(); }}><b>{p.nome} pediu uma nova senha</b><small>Login {p.login} · {dataCurta(p.criado_em)} · clique para redefinir</small></button>
          ))}
          {pedidos.length > 0 && itens.length > 0 && <small className="aviso-grupo">Comunicados urgentes</small>}
          {itens.length === 0 && pedidos.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhum aviso urgente no momento.</p> : itens.map((c) => (
            <button key={c.slug} className="aviso" onClick={() => { setAberto(false); ir(); }}><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)}</small></button>
          ))}
        </div>
      )}
    </div>
  );
}

function Portal({ usuario, sair }: { usuario: Usuario; sair: () => Promise<void> }) {
  const empresa = useEmpresa();
  useEffect(() => { document.title = `${empresa.nome_portal} | ${empresa.nome}`; }, [empresa.nome_portal, empresa.nome]);
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
  const admin = usuario.perfil === 'admin';
  const podeConfig = ['usuarios', 'perfis', 'empresa', 'entrada', 'integracoes', 'auditoria'].some((a) => pode(usuario, `cfg.${a}.ver`)) || podeAbaCalendario(usuario.permissoes);
  const telasLiberadas = (['comunicados', 'documentos', 'calendario', 'pessoas', 'ajuda'] as Tela[]).filter((t) => pode(usuario, `ver.${t}`));
  const libera = (t: Tela) => t === 'inicio' || telasLiberadas.includes(t);
  const { dados: comunicados } = useLista<Comunicado>(libera('comunicados') ? '/api/comunicados' : null);
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente');
  // Quem pode redefinir senhas recebe no sino os pedidos de "Esqueci minha senha" (atualiza a cada minuto e ao trocar de tela).
  const veSenha = pode(usuario, 'cfg.usuarios.senha');
  const [pedidos, setPedidos] = useState<PedidoSenha[]>([]);
  useEffect(() => {
    if (!veSenha) { setPedidos([]); return; }
    let vivo = true;
    const ler = () => api<PedidoSenha[]>('/api/gestao/pedidos-senha').then((r) => { if (vivo) setPedidos(r); }).catch(() => { /* sem aviso */ });
    void ler(); const t = setInterval(() => void ler(), 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, [veSenha, tela]);

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

  return (
    <div className="app">
      <a className="pular" href="#conteudo-principal">Pular para o conteúdo</a>
      <Menu tela={tela} irPara={irPara} recolhido={config.menuRecolhido} gavetaAberta={gaveta} fecharGaveta={() => setGaveta(false)}
        alternar={() => (innerWidth <= 860 ? setGaveta(!gaveta) : mudar({ menuRecolhido: !config.menuRecolhido }))}
        mostrarPublicar={gere} mostrarConfig={podeConfig} telasLiberadas={telasLiberadas}
        mostrarCalendario={pode(usuario, 'ver.calendario')} podeCriarData={pode(usuario, 'calendario.criar')} podeExcluirData={pode(usuario, 'calendario.excluir')} />
      {gaveta && <div className="cortina" onClick={() => setGaveta(false)} />}

      <div className="corpo">
        <header className="topo">
          <h1 className="titulo-tela">{TITULOS[tela]}</h1>
          <span className="bemvindo">Bem-vindo(a), <b>{perfil.nome}</b></span>
          <p className="aviso-universal" role="status"><Icone nome="info" tamanho={14} /><span>{AVISOS[tela]}</span></p>
          <span className="versao" title="Estado da API"><i aria-hidden="true" />v{saude?.versao ?? '…'}</span>
          <BuscaGlobal valor={busca} mudar={setBusca} irPara={irPara} permissoes={usuario.permissoes} />
          <PainelTema config={config} mudar={mudar} />
          <button className="icone-btn lancador-mob" aria-label="Aplicativos" aria-expanded={lancador} onClick={() => setLancador(!lancador)}><Icone nome="apps" /></button>
          <Sino itens={urgentes} ir={() => irPara('comunicados')} pedidos={pedidos} irPedidos={() => irPara('configuracoes', 'usuarios')} />
          <button className="avbtn" onClick={() => setPerfilAberto(true)} aria-label="Minha conta" title={`${perfil.nome} — minha conta`}><Avatar nome={perfil.nome} avatar={perfil.avatar} tamanho={28} /></button>
        </header>

        <div className="meio">
          <main className="conteudo" id="conteudo-principal" tabIndex={-1}>
            {avisoFav && <p className="erro" role="alert">{avisoFav}</p>}
            {tela === 'inicio' && <Inicio irPara={irPara} comunicados={comunicados} veComunicados={libera('comunicados')} veDocumentos={libera('documentos')} />}
            {['comunicados', 'documentos', 'calendario', 'pessoas', 'ajuda'].includes(tela) && !libera(tela) && <p className="erro">Você não tem acesso a esta tela. Fale com o administrador do portal.</p>}
            {tela === 'comunicados' && libera(tela) && <Comunicados slug={rota.slug} busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'calendario' && libera(tela) && <CalendarioPagina dia={rota.slug} podeConfigurar={podeAbaCalendario(usuario.permissoes)} irConfig={() => irPara('configuracoes', 'calendario')} />}
            {tela === 'documentos' && libera(tela) && <Documentos busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'pessoas' && libera(tela) && <Pessoas busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'ajuda' && libera(tela) && <Ajuda irPara={irPara} />}
            {tela === 'publicar' && gere && <Publicar permissoes={usuario.permissoes} aba={rota.slug} aoMudarAba={(a) => irPara('publicar', a)} busca={busca} limparBusca={() => setBusca('')} favoritos={favoritos} alternarFavorito={alternarFavorito} />}
            {tela === 'publicar' && !gere && <p className="erro">Você não tem acesso à publicação de conteúdo.</p>}
            {tela === 'configuracoes' && podeConfig && <Configuracoes permissoes={usuario.permissoes} souAdmin={admin} aba={rota.slug} aoMudarAba={(a) => irPara('configuracoes', a)} />}
            {tela === 'configuracoes' && !podeConfig && <p className="erro">Você não tem acesso às configurações. Fale com o administrador do portal.</p>}
            <footer className="rodape-portal"><span><b>{empresa.nome}</b>{empresa.frase_rodape ? ` | ${empresa.frase_rodape}` : ''}</span><span>{empresa.nome_portal}</span></footer>
          </main>
          <Lancador aberto={lancador} alternar={() => setLancador(!lancador)} fechar={() => setLancador(false)} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        </div>
      </div>

      <nav className="abas-mobile" aria-label="Navegação principal">
        {ABAS.filter(([id]) => id === 'menu' || id === 'apps' || libera(id as Tela)).map(([id, nome, ico]) => (
          <button key={id} aria-current={id === tela ? 'page' : undefined} onClick={() => (id === 'menu' ? setGaveta(true) : id === 'apps' ? setLancador(true) : irPara(id))}><Icone nome={ico} tamanho={22} /><span>{nome}</span></button>
        ))}
      </nav>
      {perfilAberto && <JanelaConta usuario={usuario} avatar={perfil.avatar} mudarAvatar={mudarAvatar} sair={() => void sair()} fechar={() => setPerfilAberto(false)} />}
    </div>
  );
}

/** Porta de entrada: carrega a sessão e mostra login, troca obrigatória de senha ou o portal. */
export function App() {
  const { usuario, offline, entrar, sair, recarregar } = useSessao();
  const empresa = useEmpresa();
  useEffect(() => { document.title = `${empresa.nome_portal} | ${empresa.nome}`; }, [empresa.nome_portal, empresa.nome]);
  if (offline) {
    return (
      <main className="conteudo">
        <h1>{empresa.nome_portal}</h1>
        <p className="erro">A API não respondeu. Rode <code>npm run dev</code> na pasta do projeto e recarregue a página.</p>
      </main>
    );
  }
  if (usuario === undefined) return <p className="carregando" role="status">Carregando…</p>;
  if (usuario === null) return <Login entrar={entrar} />;
  if (usuario.trocar_senha) return <TrocaObrigatoria nome={usuario.nome} aoConcluir={() => void recarregar()} sair={() => void sair()} />;
  return <Portal usuario={usuario} sair={sair} />;
}
