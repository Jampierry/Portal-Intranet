import { useEffect, useState } from 'react';
import { Lema } from './Capa';
import { IconeSistema } from './icones';
import { LogoEmpresa, LogoNome, useEmpresa, type ConfigEmpresa } from './empresa';

/** Configuração da lateral da tela de entrada (vem de /api/entrada; editada em Configurações › Tela de entrada). */
export interface ConfigEntrada {
  fundo: 'cor' | 'imagem' | 'carrossel';
  imagens: string[];
  intervalo: number;
  escurecer: number;
  linhas: string[];
  rodape: string;
  texto_extra: string;
}
export const PADRAO_ENTRADA: ConfigEntrada = {
  fundo: 'cor', imagens: [], intervalo: 6, escurecer: 35, linhas: [], rodape: '', texto_extra: '',
};

let guardada: ConfigEntrada | null = null;
/** Lê a configuração pública da tela de entrada (sem login). Enquanto não chega, usa o padrão. */
export function useEntrada() {
  const [cfg, setCfg] = useState<ConfigEntrada>(guardada ?? PADRAO_ENTRADA);
  useEffect(() => {
    let vivo = true;
    fetch('/api/entrada', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (vivo && c) { const nova: ConfigEntrada = { ...PADRAO_ENTRADA, ...c }; guardada = nova; setCfg(nova); } }).catch(() => { /* fica no padrão */ });
    return () => { vivo = false; };
  }, []);
  return cfg;
}

/** Lateral colorida da entrada: cor sólida, imagem fixa ou carrossel, com ícone, título, frase e textos. Usada também na prévia da configuração. */
export function MarcaEntrada({ cfg, previa = false, empresa: rascunho }: { cfg: ConfigEntrada; previa?: boolean; empresa?: ConfigEmpresa }) {
  const [i, setI] = useState(0);
  const [ant, setAnt] = useState(-1); // imagem que está saindo: mantém o movimento até terminar o fade
  const salva = useEmpresa();
  const empresa = rascunho ?? salva;
  const imagens = cfg.fundo === 'cor' ? [] : cfg.fundo === 'imagem' ? cfg.imagens.slice(0, 1) : cfg.imagens;
  const [pausado, setPausado] = useState(false);
  useEffect(() => { setI(0); setAnt(-1); }, [cfg.fundo, imagens.length]); // recomeça da primeira imagem só quando a configuração muda
  useEffect(() => {
    if (cfg.fundo !== 'carrossel' || imagens.length < 2 || pausado) return;
    const t = setInterval(() => setI((x) => { setAnt(x); return (x + 1) % imagens.length; }), cfg.intervalo * 1000);
    return () => clearInterval(t);
  }, [cfg.fundo, cfg.intervalo, imagens.length, pausado]); // eslint-disable-line react-hooks/exhaustive-deps
  const veu = cfg.escurecer / 100;
  return (
    <section className={`entrar-marca${previa ? ' previa' : ''}${imagens.length ? ' com-imagem' : ''}`} aria-hidden="true" onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      {imagens.map((u, k) => <div key={u} className={`entrar-fundo-img kb${k % 4}${k === i ? ' ativa' : ''}${k === ant && k !== i ? ' saindo' : ''}`} style={{ backgroundImage: `url(${u})`, ['--dur' as string]: `${cfg.intervalo + 3}s` }} />)}
      {imagens.length > 0 && <div className="entrar-fundo-veu" style={{ background: `linear-gradient(180deg, rgba(0,0,0,${veu * 0.55}) 0%, rgba(0,0,0,${veu}) 100%)` }} />}
      <div className="entrar-logo">
        {rascunho ? (rascunho.logo ? <img className="entrar-logo-img" src={rascunho.logo} alt="" width={34} height={34} style={{ objectFit: 'contain', borderRadius: 8 }} /> : <IconeSistema tamanho={34} />) : <LogoEmpresa tamanho={previa ? 26 : 34} classe="entrar-logo-img" />}
        {(empresa.logo_nome || empresa.logo_nome_escuro) ? <LogoNome cfg={rascunho} classe="entrar-nome-img" /> : <span>{empresa.nome}</span>}
      </div>
      <div className="entrar-frase">
        {cfg.texto_extra && <p className="entrar-extra">{cfg.texto_extra}</p>}
        {cfg.linhas.length > 0 && <Lema linhas={cfg.linhas} />}
        {cfg.rodape && <small>{cfg.rodape}</small>}
      </div>
    </section>
  );
}
