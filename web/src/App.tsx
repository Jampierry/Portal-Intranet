import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { PainelTema, useTema } from './tema';
import { Menu, type Tela } from './Menu';
import { Icone } from './icones';
import { Avatar, JanelaPerfil, usePerfil } from './perfil';
import { dataCurta, useLista, type Aplicacao, type Comunicado } from './dados';
import { Inicio } from './inicio/Inicio';
import { Comunicados } from './comunicados/Comunicados';
import { Aplicacoes } from './aplicacoes/Aplicacoes';
import { Documentos } from './documentos/Documentos';
import { Lancador } from './aplicacoes/Lancador';

interface Saude { ok: boolean; versao: string; modulos: string[] }

const CHAVE_FAV = 'portal.favoritos';
const ABAS: [Tela | 'menu', string, string][] = [['inicio', 'Início', 'inicio'], ['comunicados', 'Comunicados', 'comunicados'], ['aplicacoes', 'Aplicações', 'aplicacoes'], ['menu', 'Menu', 'menu']];

const TELAS: Tela[] = ['inicio', 'comunicados', 'aplicacoes', 'documentos'];
const telaDoEndereco = (): Tela => { const h = location.hash.slice(1) as Tela; return TELAS.includes(h) ? h : 'inicio'; };

function lerFavoritos(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_FAV) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}

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

export function App() {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [offline, setOffline] = useState(false);
  const [tela, setTela] = useState<Tela>(telaDoEndereco);
  const [gaveta, setGaveta] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [lancador, setLancador] = useState(false);
  const [busca, setBusca] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const { config, mudar } = useTema();
  const { perfil, mudarPerfil } = usePerfil();
  const { dados: apps } = useLista<Aplicacao>('/api/aplicacoes');
  const { dados: comunicados } = useLista<Comunicado>('/api/comunicados');
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente');
  const favs = (apps ?? []).filter((a) => favoritos.includes(a.slug));

  useEffect(() => { api<Saude>('/api/saude').then(setSaude).catch(() => setOffline(true)); }, []);
  useEffect(() => {
    if (!lancador) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setLancador(false); };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [lancador]);
  useEffect(() => { const f = () => setTela(telaDoEndereco()); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  useEffect(() => { try { localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch { /* vale só nesta sessão */ } }, [favoritos]);

  const alternarFavorito = (slug: string) => setFavoritos((f) => (f.includes(slug) ? f.filter((x) => x !== slug) : [...f, slug]));
  const irPara = (t: Tela) => { setTela(t); setGaveta(false); try { history.pushState(null, '', t === 'inicio' ? location.pathname : `#${t}`); } catch { /* sem histórico */ } document.getElementById('conteudo-principal')?.scrollTo?.(0, 0); };
  const buscar = (v: string) => { setBusca(v); if (v && tela === 'inicio') setTela('comunicados'); };

  if (offline) {
    return (
      <main className="conteudo">
        <h1>Portal Intranet</h1>
        <p className="erro">A API não respondeu. Rode <code>npm run dev</code> na pasta do projeto e recarregue a página.</p>
      </main>
    );
  }

  return (
    <div className="app">
      <a className="pular" href="#conteudo-principal">Pular para o conteúdo</a>
      <Menu tela={tela} irPara={irPara} recolhido={config.menuRecolhido} gavetaAberta={gaveta} fecharGaveta={() => setGaveta(false)}
        alternar={() => (innerWidth <= 860 ? setGaveta(!gaveta) : mudar({ menuRecolhido: !config.menuRecolhido }))}
        perfil={perfil} abrirPerfil={() => { setGaveta(false); setPerfilAberto(true); }} apps={favs} />
      {gaveta && <div className="cortina" onClick={() => setGaveta(false)} />}

      <div className="corpo">
        <header className="topo">
          <div className="busca-topo">
            <Icone nome="busca" tamanho={18} />
            <input type="search" placeholder="Buscar no portal" aria-label="Buscar no portal" value={busca} onChange={(e) => buscar(e.target.value)} />
            <kbd className="selo-enter" aria-hidden="true">ENTER</kbd>
          </div>
          <span className="versao" title="Estado da API"><i aria-hidden="true" />Online · v{saude?.versao ?? '…'}</span>
          <PainelTema config={config} mudar={mudar} />
          <button className="icone-btn lancador-mob" aria-label="Aplicativos" aria-expanded={lancador} onClick={() => setLancador(!lancador)}><Icone nome="apps" /></button>
          <Sino itens={urgentes} ir={() => irPara('comunicados')} />
          <button className="avbtn" onClick={() => setPerfilAberto(true)} aria-label="Meu perfil" title={perfil.nome}><Avatar nome={perfil.nome} avatar={perfil.avatar} tamanho={34} /></button>
        </header>

        <div className="meio">
          <main className="conteudo" id="conteudo-principal" tabIndex={-1}>
            {tela === 'inicio' && <Inicio irPara={irPara} perfil={perfil} apps={apps} favoritos={favoritos} comunicados={comunicados} />}
            {tela === 'comunicados' && <Comunicados busca={busca} limparBusca={() => setBusca('')} />}
            {tela === 'aplicacoes' && <Aplicacoes busca={busca} limparBusca={() => setBusca('')} favoritos={favoritos} alternarFavorito={alternarFavorito} />}
            {tela === 'documentos' && <Documentos busca={busca} limparBusca={() => setBusca('')} />}
            <footer className="rodape-portal"><span><b>Di Paula</b> | Intranet | Conectando pessoas, ideias e grandes movimentos.</span><span>Conteúdo de demonstração</span></footer>
          </main>
          <Lancador aberto={lancador} alternar={() => setLancador(!lancador)} fechar={() => setLancador(false)} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        </div>
      </div>

      <nav className="abas-mobile" aria-label="Navegação principal">
        {ABAS.map(([id, nome, ico]) => (
          <button key={id} aria-current={id === tela ? 'page' : undefined} onClick={() => (id === 'menu' ? setGaveta(true) : irPara(id))}><Icone nome={ico} tamanho={22} /><span>{nome}</span></button>
        ))}
      </nav>
      {perfilAberto && <JanelaPerfil perfil={perfil} mudar={mudarPerfil} fechar={() => setPerfilAberto(false)} />}
    </div>
  );
}
