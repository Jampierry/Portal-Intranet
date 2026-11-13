import { Icone } from './icones';
import { ajustarConsultasDeMidia, fatorAuto } from './escala-auto';
import { useEffect, useRef, useState } from 'react';

export type ModoTema = 'auto' | 'claro' | 'escuro';
import { ESTILOS, type Estilo } from './temas-dados.ts';
export { ESTILOS };
export type { Estilo };

export interface Config { modo: ModoTema; estilo: Estilo; menuRecolhido: boolean; escala: number }

// Escala de visualização (% do tamanho normal): aumenta ou diminui fontes e todo o app.
export const ESCALAS = [80, 90, 100, 110, 125, 150];
export const ESCALA_MIN = 80;
export const ESCALA_MAX = 150;


const CHAVE = 'portal.tema';
const PADRAO: Config = { modo: 'auto', estilo: 'dipaula', menuRecolhido: false, escala: 100 };

function ler(): Config {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const c: Config = bruto ? { ...PADRAO, ...JSON.parse(bruto) } : PADRAO;
    // Estilo salvo que não existe mais (ex.: Di Paula, Obsidiana, Violeta) volta ao Bordô.
    const estilo = ESTILOS.some((e) => e.id === c.estilo) ? c.estilo : PADRAO.estilo;
    const escala = Number.isFinite(c.escala) ? Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(c.escala))) : 100;
    return { modo: c.modo, estilo, menuRecolhido: c.menuRecolhido, escala };
  } catch {
    return PADRAO;
  }
}

function aplicar(c: Config) {
  const raiz = document.documentElement;
  const escuro = c.modo === 'escuro' || (c.modo === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  raiz.dataset.tema = escuro ? 'escuro' : 'claro';
  raiz.dataset.estilo = c.estilo;
  // menu claro (só em alguns estilos, no modo claro): decide a logo exibida sobre o menu e sobre a lateral do login
  raiz.dataset.menu = !escuro && ESTILOS.find((e) => e.id === c.estilo)?.menuClaro ? 'claro' : 'escuro';
  const auto = fatorAuto(window.innerWidth, window.innerHeight);
  const z = Math.round((c.escala / 100) * auto * 1000) / 1000;
  raiz.style.setProperty('zoom', String(z));
  raiz.style.setProperty('--zoom', String(z));
  raiz.dataset.escalaAuto = auto < 1 ? 'sim' : 'nao';
  ajustarConsultasDeMidia(auto);
}

// Aplica já ao carregar o módulo (antes do React montar) e de novo quando a janela muda de tamanho ou termina de carregar.
if (typeof document !== 'undefined') {
  aplicar(ler());
  let fila = 0;
  const reaplicar = () => { cancelAnimationFrame(fila); fila = requestAnimationFrame(() => aplicar(ler())); };
  window.addEventListener('resize', reaplicar);
  window.addEventListener('load', reaplicar);
}

export function useTema() {
  const [config, setConfig] = useState<Config>(ler);
  useEffect(() => {
    aplicar(config);
    try { localStorage.setItem(CHAVE, JSON.stringify(config)); } catch { /* sem armazenamento: vale só nesta sessão */ }
    if (config.modo !== 'auto') return;
    const m = matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => aplicar(config);
    m.addEventListener('change', aoMudar);
    return () => m.removeEventListener('change', aoMudar);
  }, [config]);
  const mudar = (parcial: Partial<Config>) => setConfig((c) => ({ ...c, ...parcial }));
  return { config, mudar };
}

/** Botão da barra superior que abre o painel de tema, estilo, escala e menu. */
export function PainelTema({ config, mudar }: { config: Config; mudar: (p: Partial<Config>) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const [estAberto, setEstAberto] = useState(() => { try { return localStorage.getItem('portal.tema.estilos') === 'aberto'; } catch { return false; } });
  const alternarEst = () => setEstAberto((v) => { try { localStorage.setItem('portal.tema.estilos', v ? 'fechado' : 'aberto'); } catch { /* só nesta sessão */ } return !v; });
  // Durante o arrasto só o valor mostrado muda; a escala é aplicada ao soltar (evita o painel "pular" sob o mouse).
  const [escalaTmp, setEscalaTmp] = useState(config.escala);
  useEffect(() => setEscalaTmp(config.escala), [config.escala]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);

  return (
    <div className="tema-raiz" ref={raiz}>
      <button className="icone-btn" aria-label="Aparência" aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(!aberto)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      </button>
      {aberto && (
        <div className="tema-painel" role="dialog" aria-label="Aparência">
          <h3>Tema</h3>
          <div className="pilulas">
            {([['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']] as const).map(([id, nome]) => (
              <button key={id} aria-pressed={config.modo === id} onClick={() => mudar({ modo: id })}>{nome}</button>
            ))}
          </div>
          <h3 className="conta-recolher"><button type="button" aria-expanded={estAberto} aria-controls="tema-estilos" onClick={alternarEst}><Icone nome="dir" tamanho={14} classe="recolher-seta" />Estilo{!estAberto && <span className="recolher-atual">{ESTILOS.find((e) => e.id === config.estilo)?.nome}</span>}<span className="recolher-dica">{estAberto ? 'Ocultar' : 'Mostrar'}</span></button></h3>
          <div className="estilos" id="tema-estilos" hidden={!estAberto}>
            {ESTILOS.map((e) => (
              <button key={e.id} aria-pressed={config.estilo === e.id} onClick={() => mudar({ estilo: e.id })}>
                <span className="amostra" aria-hidden="true">
                  <i style={{ background: e.menu }} /><i style={{ background: e.fundo }} /><i style={{ background: e.acento }} />
                </span>
                {e.nome}
              </button>
            ))}
          </div>
          <h3>Escala de visualização</h3>
          <div className="escala-barra">
            <div className="escala-marcas" aria-hidden="true">
              {ESCALAS.map((n) => (
                <span key={n} className={escalaTmp === n ? 'ativa' : ''} style={{ left: `${((n - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100}%` }}
                  onClick={() => { setEscalaTmp(n); mudar({ escala: n }); }}>{n}%</span>
              ))}
            </div>
            <input type="range" aria-label="Escala de visualização" min={ESCALA_MIN} max={ESCALA_MAX} step={5} value={escalaTmp}
              onChange={(e) => setEscalaTmp(Number(e.target.value))}
              onPointerUp={() => mudar({ escala: escalaTmp })}
              onKeyUp={() => mudar({ escala: escalaTmp })} />
            <div className="escala-valor">{escalaTmp}%</div>
          </div>
          <h3>Menu</h3>
          <div className="pilulas">
            <button aria-pressed={!config.menuRecolhido} onClick={() => mudar({ menuRecolhido: false })}>Expandido</button>
            <button aria-pressed={config.menuRecolhido} onClick={() => mudar({ menuRecolhido: true })}>Recolhido</button>
          </div>
        </div>
      )}
    </div>
  );
}
