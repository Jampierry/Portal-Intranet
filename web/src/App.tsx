import { useEffect, useState } from 'react';
import { api } from './api';
import { PainelTema, useTema } from './tema';
import { Menu, type Tela } from './Menu';
import { Icone } from './icones';
import { Inicio } from './inicio/Inicio';
import { Comunicados } from './comunicados/Comunicados';
import { Aplicacoes } from './aplicacoes/Aplicacoes';
import { Lancador } from './aplicacoes/Lancador';
import { Documentos } from './documentos/Documentos';

interface Saude { ok: boolean; versao: string; modulos: string[] }

const TITULOS: Record<Tela, string> = { inicio: 'Início', comunicados: 'Comunicados', aplicacoes: 'Aplicações', documentos: 'Documentos' };
const CHAVE_FAV = 'portal.favoritos';

function lerFavoritos(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_FAV) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}

export function App() {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [offline, setOffline] = useState(false);
  const [tela, setTela] = useState<Tela>('inicio');
  const [gaveta, setGaveta] = useState(false);
  const [lancador, setLancador] = useState(false);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const { config, mudar } = useTema();

  useEffect(() => { api<Saude>('/api/saude').then(setSaude).catch(() => setOffline(true)); }, []);
  useEffect(() => { try { localStorage.setItem(CHAVE_FAV, JSON.stringify(favoritos)); } catch { /* vale só nesta sessão */ } }, [favoritos]);
  useEffect(() => {
    if (!lancador) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setLancador(false); };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [lancador]);

  const alternarFavorito = (slug: string) => setFavoritos((f) => (f.includes(slug) ? f.filter((x) => x !== slug) : [...f, slug]));

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
      <Menu tela={tela} irPara={setTela} recolhido={config.menuRecolhido} gavetaAberta={gaveta} fecharGaveta={() => setGaveta(false)}
        alternar={() => (innerWidth <= 860 ? setGaveta(!gaveta) : mudar({ menuRecolhido: !config.menuRecolhido }))} />
      {gaveta && <div className="cortina" onClick={() => setGaveta(false)} />}

      <div className="corpo">
        <header className="topo">
          <button className="icone-btn menu-mob" aria-label="Abrir menu" onClick={() => setGaveta(true)}><Icone nome="menu" /></button>
          <div className="titulo-tela"><small>Portal Di Paula</small><h1>{TITULOS[tela]}</h1></div>
          <span className="versao"><i aria-hidden="true" />Online · v{saude?.versao ?? '…'}</span>
          <PainelTema config={config} mudar={mudar} />
          <button className="icone-btn lancador-mob" aria-label="Aplicativos" aria-expanded={lancador} onClick={() => setLancador(!lancador)}><Icone nome="apps" /></button>
        </header>

        <div className="meio">
          <main className="conteudo" id="conteudo-principal">
            {tela === 'inicio' && <Inicio irPara={setTela} />}
            {tela === 'comunicados' && <Comunicados />}
            {tela === 'aplicacoes' && <Aplicacoes favoritos={favoritos} alternarFavorito={alternarFavorito} />}
            {tela === 'documentos' && <Documentos />}
          </main>
          <Lancador aberto={lancador} alternar={() => setLancador(!lancador)} fechar={() => setLancador(false)} favoritos={favoritos} alternarFavorito={alternarFavorito} />
        </div>
      </div>
    </div>
  );
}
