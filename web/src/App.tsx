import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PainelTema, useTema } from './tema';
import { Menu, type Tela } from './Menu';
import { Icone } from './icones';
import { usePerfil } from './perfil';
import { BuscaGlobal } from './BuscaGlobal';
import { MenuConta } from './Conta';
import { Login, TrocaObrigatoria } from './Login';
import { pode, podeGerir, useSessao, type Usuario } from './sessao';
const Publicar = lazy(() => import('./gestao/Gestao').then((m) => ({ default: m.Publicar })));
const Configuracoes = lazy(() => import('./gestao/Gestao').then((m) => ({ default: m.Configuracoes })));
import { Pessoas } from './pessoas/Pessoas';
const Ajuda = lazy(() => import('./ajuda/Ajuda').then((m) => ({ default: m.Ajuda })));
import { MeuPerfil } from './perfil/MeuPerfil';
import { dataCurta, useLista, type Comunicado } from './dados';
import { Inicio } from './inicio/Inicio';
import { Comunicados } from './comunicados/Comunicados';
import { Documentos } from './documentos/Documentos';
const CalendarioPagina = lazy(() => import('./CalendarioPagina').then((m) => ({ default: m.CalendarioPagina })));
import { podeAbaCalendario } from './calendarioTipos';
import { Lancador } from './aplicacoes/Lancador';
import { PulsoCard } from './inicio/PulsoCard';
import { ResultadoPopup } from './pesquisas/ResultadoPopup';
import { Pesquisas } from './pesquisas/Pesquisas';
import { useEmpresa } from './empresa';

interface Saude { ok: boolean; versao: string; modulos: string[] }

const ABAS: [Tela | 'menu' | 'apps', string, string][] = [['inicio', 'Início', 'inicio'], ['comunicados', 'Comunicados', 'comunicados'], ['calendario', 'Calendário', 'calendario'], ['apps', 'Aplicativos', 'apps'], ['menu', 'Menu', 'menu']];

// Dica de cada tela, mostrada no "i" ao lado do título (barra superior) em vez de dentro da página.
const AVISOS: Record<Tela, string> = {
  inicio: 'Aplicativos: use a barra da direita. No computador abrem em nova aba; no celular, use Voltar do navegador.',
  comunicados: 'Avisos publicados pelas áreas responsáveis.',
  calendario: 'Feriados, datas importantes e as agendas da empresa. Use os filtros para escolher o que mostrar.',
  documentos: 'Os arquivos ficam nos sistemas de origem: abra pelo link oficial de cada documento.',
  publicar: 'O que for publicado aparece no portal conforme a situação e a janela de exibição.',
  configuracoes: 'Usuários, perfis e auditoria do portal. Só o administrador acessa.',
  pessoas: 'Quem procurar em cada área da empresa: e-mail, ramal ou ferramenta de chamados. Não há dados pessoais de funcionários aqui.',
  ajuda: 'Respostas rápidas sobre login, aplicações, comunicados e documentos.',
  perfil: 'Seus dados de contato, contato de emergência, e-mail, avisos e senha. Só você vê o que preenche aqui.',
  pesquisas: 'Resultados das pesquisas que o RH divulgou. Os novos aparecem em um aviso ao entrar; depois, só aqui.',
};
// Nome de cada tela, mostrado na barra superior universal (não aparece dentro da janela).
const TITULOS: Record<Tela, string> = { inicio: 'Início', comunicados: 'Comunicados', calendario: 'Calendário', documentos: 'Documentos', publicar: 'Publicar', configuracoes: 'Configurações', pessoas: 'Contatos', ajuda: 'Ajuda', pesquisas: 'Pesquisas', perfil: 'Meu perfil' };
const TELAS: Tela[] = ['inicio', 'comunicados', 'calendario', 'documentos', 'pesquisas', 'publicar', 'configuracoes', 'pessoas', 'ajuda', 'perfil'];
interface Rota { tela: Tela; slug?: string }
/** Endereço: #comunicados, #comunicados/<slug>, #aplicacoes... (vazio = início). */
const rotaDoEndereco = (): Rota => {
  const [t0, slug] = location.hash.slice(1).split('/');
  let t = t0;
  // Endereços antigos (#gestao/...) levam à tela nova correspondente.
  if (t === 'gestao') t = ['usuarios', 'auditoria'].includes(slug) ? 'configuracoes' : 'publicar';
  return TELAS.includes(t as Tela) ? { tela: t as Tela, slug: slug ? decodeURIComponent(slug) : undefined } : { tela: 'inicio' };
};
/** "i" ao lado do título da tela: abre uma dica curta sobre a tela (antes ocupava a barra inteira). */
function DicaTela({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  useEffect(() => { setAberto(false); }, [texto]);
  return (
    <span className="dica-tela" ref={raiz}>
      <button type="button" className="dica-tela-btn" aria-label="Sobre esta tela" aria-expanded={aberto} onClick={() => setAberto(!aberto)}><Icone nome="info" tamanho={15} /></button>
      {aberto && <span className="dica-tela-painel" role="note">{texto}</span>}
    </span>
  );
}

/** Sino da barra superior: lista os comunicados urgentes (vem do PREMIA: sino com contador e lista de pendências). */
interface PedidoSenha { id: number; usuario_id: number; criado_em: string; login: string; nome: string }
interface PedidoEdicao { id: number; rotulo: string; titulo: string | null; criado_em: string; status: string; solicitante: string; dono: string | null }
interface CaixaEdicao { pendentes: PedidoEdicao[]; respostas: PedidoEdicao[] }
interface LinhaAprov { id: number; tipo: 'comunicado' | 'rede_social'; titulo: string; detalhe: string | null; solicitante: string; status: string; motivo: string | null; decisor: string | null; criado_em: string }
interface CaixaAprov { pendentes: LinhaAprov[]; respostas: LinhaAprov[] }
function Sino({ itens: todosItens, leitura, ir, pedidos, irPedidos, edicoes: caixa, decidir, lidos, marcar, aprov: caixaAprov, irPublicar }: { itens: Comunicado[]; leitura: Comunicado[]; ir: (slug?: string) => void; pedidos: PedidoSenha[]; irPedidos: () => void; edicoes: CaixaEdicao; decidir: (id: number, aprovar: boolean) => void; lidos: Set<string>; marcar: (chaves: string[]) => void; aprov: CaixaAprov; irPublicar: (aba: string) => void }) {
  const [aberto, setAberto] = useState(false);
  // o que a pessoa já abriu ou limpou sai da lista; confirmação de leitura, pedidos para decidir e pedidos de senha só saem quando resolvidos
  const chaveCom = (c: Comunicado) => `urgente:${encodeURIComponent(c.slug)}`;
  const chaveEd = (p: PedidoEdicao) => `resposta:${p.id}`;
  const itens = todosItens.filter((c) => !lidos.has(chaveCom(c)));
  const edicoes: CaixaEdicao = { pendentes: caixa.pendentes, respostas: caixa.respostas.filter((p) => !lidos.has(chaveEd(p))) };
  const chaveAp = (p: LinhaAprov) => `aprov:${p.id}`;
  const respAprov = caixaAprov.respostas.filter((p) => !lidos.has(chaveAp(p)));
  const limpaveis = [...itens.map(chaveCom), ...edicoes.respostas.map(chaveEd), ...respAprov.map(chaveAp)];
  const total = itens.length + leitura.length + pedidos.length + edicoes.pendentes.length + edicoes.respostas.length + caixaAprov.pendentes.length + respAprov.length;
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
          <div className="avisos-topo">
            <h3>Avisos</h3>
            {limpaveis.length > 0 && <button type="button" className="btn btn-sec btn-pequeno" title="Limpa os avisos que não pedem confirmação de leitura" onClick={() => marcar(limpaveis)}>Marcar todas como lidas</button>}
          </div>
          {caixaAprov.pendentes.length > 0 && <small className="aviso-grupo">Publicações aguardando a sua aprovação</small>}
          {caixaAprov.pendentes.length > 0 && <button className="aviso" onClick={() => { setAberto(false); irPublicar('aprovacoes'); }}><b>{caixaAprov.pendentes.length} publicaç{caixaAprov.pendentes.length === 1 ? 'ão' : 'ões'} para aprovar</b><small>{caixaAprov.pendentes.slice(0, 3).map((p) => `${p.titulo} (${p.solicitante})`).join(' · ')}{caixaAprov.pendentes.length > 3 ? '…' : ''} · clique para decidir</small></button>}
          {respAprov.length > 0 && <small className="aviso-grupo">Retorno das suas publicações</small>}
          {respAprov.map((p) => (
            <button key={p.id} className="aviso" onClick={() => { marcar([chaveAp(p)]); setAberto(false); irPublicar(p.tipo === 'comunicado' ? 'comunicados' : 'redes'); }}>
              <b>{p.status === 'aprovado' ? 'Aprovada' : 'Rejeitada'}: {p.titulo}</b>
              <small>{p.status === 'aprovado' ? (p.tipo === 'comunicado' ? 'Já está no portal.' : 'Pode publicar na plataforma.') : `Motivo: ${p.motivo ?? '—'}`}{p.decisor ? ` · por ${p.decisor}` : ''} · clique para abrir e limpar</small>
            </button>
          ))}
          {edicoes.pendentes.length > 0 && <small className="aviso-grupo">Pedidos para editar conteúdo</small>}
          {edicoes.pendentes.map((p) => (
            <div key={p.id} className="aviso">
              <b>{p.solicitante} quer editar {p.rotulo.toLowerCase()}{p.titulo ? `: ${p.titulo}` : ''}</b>
              <small>{p.dono ? `Criado por ${p.dono}` : 'Sem autor registrado (só o administrador decide)'} · {dataCurta(p.criado_em)}</small>
              <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className="btn btn-pri" onClick={() => decidir(p.id, true)}>Autorizar</button>
                <button className="btn btn-sec" onClick={() => decidir(p.id, false)}>Negar</button>
              </span>
            </div>
          ))}
          {edicoes.respostas.length > 0 && <small className="aviso-grupo">Respostas aos seus pedidos</small>}
          {edicoes.respostas.map((p) => (
            <button key={p.id} className="aviso" onClick={() => marcar([chaveEd(p)])}><b>{p.status === 'aprovado' ? 'Edição autorizada' : 'Edição negada'}: {p.rotulo.toLowerCase()}{p.titulo ? ` “${p.titulo}”` : ''}</b><small>{p.status === 'aprovado' ? 'Vale por 24 horas: abra o conteúdo e edite.' : 'Procure o autor ou o administrador.'} · clique para limpar</small></button>
          ))}
          {pedidos.length > 0 && <small className="aviso-grupo">Pedidos de nova senha</small>}
          {pedidos.map((p) => (
            <button key={p.id} className="aviso" onClick={() => { setAberto(false); irPedidos(); }}><b>{p.nome} pediu uma nova senha</b><small>Login {p.login} · {dataCurta(p.criado_em)} · clique para redefinir</small></button>
          ))}
          {(pedidos.length > 0 || leitura.length > 0) && itens.length > 0 && <small className="aviso-grupo">Comunicados urgentes</small>}
          {itens.length === 0 && leitura.length === 0 && pedidos.length === 0 && edicoes.pendentes.length === 0 && edicoes.respostas.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nenhum aviso no momento.</p> : itens.map((c) => (
            <button key={c.slug} className="aviso" onClick={() => { marcar([chaveCom(c)]); setAberto(false); ir(c.slug); }}><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)}</small></button>
          ))}
          {leitura.length > 0 && <small className="aviso-grupo">Pedem a sua confirmação de leitura (saem quando você confirmar)</small>}
          {leitura.map((c) => (
            <button key={c.slug} className="aviso" onClick={() => { setAberto(false); ir(c.slug); }}><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)} · clique para ler e confirmar</small></button>
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
  const [lancador, setLancador] = useState(false);
  /** Celular: a barra de aplicativos abre primeiro "recolhida" (só os ícones dos favoritos); o botão da barra a expande (`lancador`). */
  const [barraMob, setBarraMob] = useState(false);
  const alternarAppsMobile = () => { setLancador(false); setBarraMob(!(barraMob || lancador)); };
  const fecharApps = () => { setLancador(false); setBarraMob(false); };
  const [busca, setBusca] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [avisoFav, setAvisoFav] = useState('');
  const { config, mudar } = useTema();
  const { perfil, mudarAvatar } = usePerfil(usuario.login, usuario.nome);
  const gere = podeGerir(usuario);
  const admin = usuario.perfil === 'admin';
  const podeConfig = ['usuarios', 'perfis', 'empresa', 'entrada', 'integracoes', 'auditoria'].some((a) => pode(usuario, `cfg.${a}.ver`)) || podeAbaCalendario(usuario.permissoes);
  const telasLiberadas = (['comunicados', 'documentos', 'calendario', 'pessoas', 'ajuda'] as Tela[]).filter((t) => pode(usuario, `ver.${t}`));
  const libera = (t: Tela) => t === 'inicio' || t === 'pesquisas' || telasLiberadas.includes(t);
  const { dados: comunicados, recarregar: recarregarComunicados } = useLista<Comunicado>(libera('comunicados') ? '/api/comunicados' : null);
  // Ao confirmar a leitura (tela do comunicado), o aviso sai do sino na hora, sem recarregar a página.
  useEffect(() => { window.addEventListener('leitura-confirmada', recarregarComunicados); return () => window.removeEventListener('leitura-confirmada', recarregarComunicados); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const leitura = (comunicados ?? []).filter((c) => c.exige_leitura && !c.lido);
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente' && !leitura.includes(c));
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

  // Pedidos para editar conteúdo de outra pessoa: o dono e o administrador decidem; quem pediu vê a resposta.
  const [edicoes, setEdicoes] = useState<CaixaEdicao>({ pendentes: [], respostas: [] });
  const lerEdicoes = () => api<CaixaEdicao>('/api/pedidos-edicao/caixa').then(setEdicoes).catch(() => { /* sem aviso */ });
  useEffect(() => {
    void lerEdicoes(); const t = setInterval(() => void lerEdicoes(), 60_000);
    window.addEventListener('pedidos-edicao', lerEdicoes);
    return () => { clearInterval(t); window.removeEventListener('pedidos-edicao', lerEdicoes); };
  }, [tela]);  
  // Avisos que a pessoa já abriu ou limpou (guardados no servidor: valem no celular e no computador).
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  useEffect(() => { api<{ chaves: string[] }>('/api/avisos/lidos').then((r) => setLidos(new Set(r.chaves))).catch(() => { /* sem aviso */ }); }, []);
  const marcarLidos = (chaves: string[]) => {
    const novas = chaves.filter((k) => !lidos.has(k));
    if (novas.length === 0) return;
    setLidos((a) => new Set([...a, ...novas]));
    api('/api/avisos/lidos', { chaves: novas }).catch(() => setLidos((a) => new Set([...a].filter((k) => !novas.includes(k))))); // se falhar, o aviso volta
  };
  // abrir um comunicado urgente (pelo sino, pelo Início ou por um aviso push) tira o aviso do sino
  useEffect(() => {
    if (rota.tela !== 'comunicados' || !rota.slug) return;
    if ((comunicados ?? []).some((c) => c.slug === rota.slug && c.prioridade === 'urgente')) marcarLidos([`urgente:${encodeURIComponent(rota.slug)}`]);
  }, [rota.tela, rota.slug, comunicados]); // eslint-disable-line react-hooks/exhaustive-deps
  // Aprovação de publicações: o RH vê a fila no sino; quem pediu vê o retorno (aprovada ou rejeitada, com o motivo).
  const [aprov, setAprov] = useState<CaixaAprov>({ pendentes: [], respostas: [] });
  const lerAprov = () => api<CaixaAprov>('/api/aprovacoes/caixa').then(setAprov).catch(() => { /* sem aviso */ });
  useEffect(() => {
    void lerAprov(); const t = setInterval(() => void lerAprov(), 60_000);
    window.addEventListener('aprovacoes', lerAprov);
    return () => { clearInterval(t); window.removeEventListener('aprovacoes', lerAprov); };
  }, [tela]);  
  const decidirEdicao = async (id: number, aprovar: boolean) => { try { await api(`/api/pedidos-edicao/${id}/decidir`, { aprovar }); } finally { void lerEdicoes(); } };

  // Mede a altura do cabeçalho de cada tabela com rolagem (.rolagem) e das abas de cada tela para a barra de rolagem começar logo abaixo deles.
  useEffect(() => {
    const medir = () => document.querySelectorAll<HTMLElement>('.rolagem').forEach((el) => {
      const cab = el.querySelector('thead');
      const h = cab ? Math.round(cab.getBoundingClientRect().height) : 0;
      if (h && el.style.getPropertyValue('--cab-h') !== `${h}px`) el.style.setProperty('--cab-h', `${h}px`);
    });
    // Telas com abas: a barra de rolagem da tela começa logo abaixo das abas.
    document.querySelectorAll<HTMLElement>('.conteudo').forEach((el) => {
      const abas = el.querySelector<HTMLElement>(':scope > .abas-gestao');
      const h = abas ? Math.round(abas.getBoundingClientRect().height) + 4 : 0;
      if (h) { if (el.style.getPropertyValue('--abas-h') !== `${h}px`) el.style.setProperty('--abas-h', `${h}px`); } else el.style.removeProperty('--abas-h');
    });
    medir();
    const obs = new MutationObserver(() => medir());
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', medir);
    return () => { obs.disconnect(); window.removeEventListener('resize', medir); };
  }, []);

  useEffect(() => { api<Saude>('/api/saude').then(setSaude).catch(() => setSaude(null)); }, []);
  useEffect(() => {
    if (!lancador && !barraMob) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLancador(false); setBarraMob(false); } };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [lancador, barraMob]);
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
        mostrarCalendario={pode(usuario, 'ver.calendario')} podeCriarData={pode(usuario, 'calendario.criar')} />
      {gaveta && <div className="cortina" onClick={() => setGaveta(false)} />}

      <div className="corpo">
        <PulsoCard />
        <ResultadoPopup />
        <header className={`topo${['comunicados', 'documentos', 'pessoas', 'ajuda'].includes(tela) ? ' tem-busca-propria' : ''}`}>
          <h1 className="titulo-tela">{TITULOS[tela]}</h1>
          <DicaTela texto={AVISOS[tela]} />
          <span className="bemvindo">Bem-vindo(a), <b>{perfil.nome}</b></span>
          <span className="faixa-espaco" aria-hidden="true" />
          <span className="versao" title="Estado da API"><i aria-hidden="true" />v{saude?.versao ?? '…'}</span>
          <BuscaGlobal valor={busca} mudar={setBusca} irPara={irPara} permissoes={usuario.permissoes} />
          <PainelTema config={config} mudar={mudar} />
          <button className="icone-btn lancador-mob" aria-label="Aplicativos" aria-expanded={barraMob || lancador} onClick={alternarAppsMobile}><Icone nome="apps" /></button>
          <Sino itens={urgentes} leitura={leitura} ir={(slug) => irPara('comunicados', slug)} pedidos={pedidos} irPedidos={() => irPara('configuracoes', 'usuarios')} edicoes={edicoes} decidir={decidirEdicao} lidos={lidos} marcar={marcarLidos} aprov={aprov} irPublicar={(aba) => irPara('publicar', aba)} />
          <MenuConta usuario={usuario} avatar={perfil.avatar} foto={perfil.foto} mudarAvatar={mudarAvatar} abrirPerfil={() => irPara('perfil')} sair={() => void sair()} />
        </header>

        <div className={`meio${tela === 'calendario' ? ' meio-fixo' : ''}`}>
          <div className="coluna-tela">
          <main className="conteudo" id="conteudo-principal" tabIndex={-1}>
            <Suspense fallback={<p className="carregando" role="status">Carregando…</p>}>
            {avisoFav && <p className="erro" role="alert">{avisoFav}</p>}
            {tela === 'inicio' && <Inicio irPara={irPara} comunicados={comunicados} veComunicados={libera('comunicados')} veDocumentos={libera('documentos')} />}
            {['comunicados', 'documentos', 'calendario', 'pessoas', 'ajuda'].includes(tela) && !libera(tela) && <p className="erro">Você não tem acesso a esta tela. Fale com o administrador do portal.</p>}
            {tela === 'comunicados' && libera(tela) && <Comunicados slug={rota.slug} busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'calendario' && libera(tela) && <CalendarioPagina dia={rota.slug} podeConfigurar={podeAbaCalendario(usuario.permissoes)} irConfig={() => irPara('configuracoes', 'calendario')} />}
            {tela === 'documentos' && libera(tela) && <Documentos busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'pessoas' && libera(tela) && <Pessoas busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'ajuda' && libera(tela) && <Ajuda irPara={irPara} />}
            {tela === 'pesquisas' && <Pesquisas />}
            {tela === 'perfil' && <MeuPerfil usuario={usuario} avatar={perfil.avatar} foto={perfil.foto} mudarAvatar={mudarAvatar} />}
            {tela === 'publicar' && gere && <Publicar permissoes={usuario.permissoes} aba={rota.slug} aoMudarAba={(a) => irPara('publicar', a)} busca={busca} limparBusca={() => setBusca('')} favoritos={favoritos} alternarFavorito={alternarFavorito} perfil={usuario.perfil} />}
            {tela === 'publicar' && !gere && <p className="erro">Você não tem acesso à publicação de conteúdo.</p>}
            {tela === 'configuracoes' && podeConfig && <Configuracoes permissoes={usuario.permissoes} souAdmin={admin} aba={rota.slug} aoMudarAba={(a) => irPara('configuracoes', a)} />}
            {tela === 'configuracoes' && !podeConfig && <p className="erro">Você não tem acesso às configurações. Fale com o administrador do portal.</p>}
            </Suspense>
          </main>
          <footer className="rodape-portal"><span><b>{empresa.nome}</b>{empresa.frase_rodape ? ` | ${empresa.frase_rodape}` : ''}</span><span>{empresa.nome_portal}</span></footer>
          </div>
          <Lancador aberto={lancador} barraMobile={barraMob} alternar={() => setLancador(!lancador)} fechar={fecharApps} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        </div>
      </div>

      <nav className="abas-mobile" aria-label="Navegação principal">
        {ABAS.filter(([id]) => id === 'menu' || id === 'apps' || libera(id as Tela)).map(([id, nome, ico]) => (
          <button key={id} aria-current={id === tela ? 'page' : undefined} onClick={() => (id === 'menu' ? setGaveta(true) : id === 'apps' ? alternarAppsMobile() : irPara(id))}><Icone nome={ico} tamanho={22} /><span>{nome}</span></button>
        ))}
      </nav>
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
