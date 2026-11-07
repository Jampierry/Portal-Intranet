import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, IconeSistema } from './icones';
import { LinkApp } from './aplicacoes/LinkApp';
import type { Aplicacao } from './dados';

export type Tela = 'inicio' | 'comunicados' | 'aplicacoes' | 'documentos' | 'gestao';

// Item: [id, nome, ativo]. Só os "ativos" têm tela; os demais aparecem apagados ("em breve").
type Item = [string, string, boolean];
const ITENS: Item[] = [
  ['inicio', 'Início', true], ['comunicados', 'Comunicados', true], ['aplicacoes', 'Aplicações', true], ['documentos', 'Documentos', true],
  ['pessoas', 'Pessoas', false], ['ajuda', 'Ajuda', false],
];

interface Props {
  tela: Tela; irPara: (t: Tela, slug?: string) => void; recolhido: boolean; alternar: () => void; gavetaAberta: boolean; fecharGaveta: () => void;
  apps: Aplicacao[]; mostrarGestao: boolean;
}

/** Submenu flutuante do menu recolhido (vem do PREMIA): abre ao passar o mouse, fecha com Esc, clique fora ou uma pequena espera. */
function Flutuante({ anc, titulo, classe = '', aoEntrar, aoSair, fechar, children }: {
  anc: HTMLElement; titulo?: string; classe?: string; aoEntrar: () => void; aoSair: () => void; fechar: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const r = anc.getBoundingClientRect();
  useEffect(() => {
    const fora = (e: Event) => { if (!ref.current?.contains(e.target as Node) && !anc.contains(e.target as Node)) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { fechar(); anc.focus(); } };
    addEventListener('pointerdown', fora, true); addEventListener('keydown', tecla); addEventListener('resize', fechar);
    return () => { removeEventListener('pointerdown', fora, true); removeEventListener('keydown', tecla); removeEventListener('resize', fechar); };
  }, [anc, fechar]);
  return (
    <div className={`nfly ${classe}`} ref={ref} role="menu" aria-label={titulo} onMouseEnter={aoEntrar} onMouseLeave={aoSair}
      style={{ left: r.right + 8, top: Math.max(8, Math.min(r.top - 6, innerHeight - 260)) }}>
      {titulo && <div className="nflyt">{titulo}</div>}
      {children}
    </div>
  );
}

/** Menu lateral esquerdo: marca, navegação, aplicações web favoritas e cartão do usuário. */
export function Menu(p: Props) {
  const mini = p.recolhido;
  const [aberto, setAberto] = useState<{ tipo: 'apps'; el: HTMLElement } | null>(null);
  const espera = useRef<number>(0);
  const comMouse = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
  const cancela = () => clearTimeout(espera.current);
  const agenda = () => { cancela(); espera.current = window.setTimeout(() => setAberto(null), 300); };
  useEffect(() => { setAberto(null); }, [p.tela, mini]);
  const abrir = (tipo: 'apps') => (e: React.MouseEvent<HTMLElement>) => { if (comMouse()) { cancela(); setAberto({ tipo, el: e.currentTarget }); } };

  const listaApps = (
    p.apps.length === 0
      ? <small className="menu-vazio">Favorite aplicações para vê-las aqui.</small>
      : p.apps.map((a) => <LinkApp key={a.slug} url={a.url} className="nitem nitem-app"><Icone nome="externo" tamanho={16} /><span className="lbl">{a.nome}</span></LinkApp>)
  );

  return (
    <aside className={`menu${mini ? ' mini' : ''}${p.gavetaAberta ? ' aberto' : ''}`} aria-label="Menu">
      <div className="sbtop">
        <button className="appbtn" onClick={p.alternar} aria-expanded={!mini} aria-label={mini ? 'Expandir menu' : 'Recolher menu'} title={mini ? 'Expandir menu' : 'Recolher menu'}>
          <IconeSistema tamanho={30} />
        </button>
        <div className="brandtxt"><span className="empnome">Di Paula</span><span>MODA EM MOVIMENTO</span></div>
      </div>

      <nav aria-label="Seções do portal">
        {!mini && <span className="menu-label">ESPAÇO DE TRABALHO</span>}
        {[...ITENS.slice(0, 4), ...(p.mostrarGestao ? ([['gestao', 'Gestão', true]] as Item[]) : []), ...ITENS.slice(4)].map(([id, nome, ativo]) => (
          <button key={id} className={`nitem${ativo ? '' : ' breve'}`} title={ativo ? nome : `${nome} — em breve`}
            aria-label={mini ? nome : undefined} aria-current={ativo && p.tela === id ? 'page' : undefined} aria-disabled={ativo ? undefined : true}
            onClick={() => { if (ativo) { p.fecharGaveta(); p.irPara(id as Tela); } }}>
            <Icone nome={id} /><span className="lbl">{nome}</span>{!ativo && !mini && <small>em breve</small>}
          </button>
        ))}

        <div className="menu-sep" />
        {mini ? (
          <button className="nitem nsec" title="Aplicações web" aria-label="Aplicações web" aria-haspopup="menu" aria-expanded={aberto?.tipo === 'apps'}
            onMouseEnter={abrir('apps')} onMouseLeave={agenda} onClick={(e) => { const el = e.currentTarget; setAberto(aberto?.tipo === 'apps' ? null : { tipo: 'apps', el }); }}>
            <Icone nome="externo" />
          </button>
        ) : (
          <div className="menu-apps">
            <b>Aplicações web</b>
            <small>No computador, abrem em nova aba</small>
            {listaApps}
          </div>
        )}
      </nav>

      {!mini && <div className="sbfoot"><span className="menu-rodape">JUNTOS<br />VAMOS MAIS LONGE</span></div>}

      {aberto?.tipo === 'apps' && mini && (
        <Flutuante anc={aberto.el} titulo="Aplicações web" aoEntrar={cancela} aoSair={agenda} fechar={() => setAberto(null)}>{listaApps}</Flutuante>
      )}
    </aside>
  );
}
