import { useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from '../icones';
import { IconeApp } from './IconeApp';
import { useLista, type Aplicacao } from '../dados';
import { LinkApp } from './LinkApp';


/** Barra lateral direita de aplicativos. Recolhida (desktop): só os ícones dos favoritos. Aberta: abas Todos os apps / Favoritos.
 *  No celular some e, ao tocar em Aplicativos, aparece primeiro recolhida (só os ícones, `barraMobile`); o botão da barra a expande numa gaveta. */
export function Lancador({ aberto, barraMobile = false, alternar, fechar, favoritos, alternarFavorito }: {
  aberto: boolean; barraMobile?: boolean; alternar: () => void; fechar: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void;
}) {
  const { dados, erro } = useLista<Aplicacao>('/api/aplicacoes');
  const [aba, setAba] = useState<'favoritos' | 'todos'>('todos');
  // Nome do app ao passar o mouse (ou focar) no ícone da barra recolhida. Fica fora da barra (portal) porque ela corta o que passa da borda.
  const [dica, setDica] = useState<{ nome: string; y: number; x: number } | null>(null);
  const mostrar = (nome: string) => (e: SyntheticEvent<HTMLElement>) => { const r = (e.currentTarget.firstElementChild ?? e.currentTarget).getBoundingClientRect(); setDica({ nome, y: r.top + r.height / 2, x: innerWidth - r.left + 10 }); };
  const todos = dados ?? [];
  const favs = todos.filter((a) => favoritos.includes(a.slug));
  const lista = aba === 'favoritos' ? favs : todos;
  return (
    <>
      {(aberto || barraMobile) && <div className="cortina-lancador" onClick={fechar} />}
      <aside className={`lancador${aberto ? ' aberto' : ''}${barraMobile ? ' barra-mob' : ''}`} aria-label="Aplicativos">
        <div className="lancador-topo">
          {aberto && <h2>Aplicativos</h2>}
          <button className="icone-btn" aria-expanded={aberto} aria-label={aberto ? 'Recolher aplicativos' : 'Abrir aplicativos'} title={aberto ? 'Recolher' : 'Aplicativos'} onClick={alternar}>
            <Icone nome={aberto ? 'dir' : 'apps'} />
          </button>
        </div>

        {!aberto && (
          <div className="lancador-mini">
            {favs.map((a) => (
              <span key={a.slug} className="lancador-caixa" onMouseEnter={mostrar(a.nome)} onMouseLeave={() => setDica(null)} onFocus={mostrar(a.nome)} onBlur={() => setDica(null)}>
                <LinkApp url={a.url} className="lancador-ico"><IconeApp app={a} tamanho={20} /><span className="sr-only">{a.nome}</span></LinkApp>
              </span>
            ))}
            {favs.length === 0 && (
              <span className="lancador-caixa" onMouseEnter={mostrar('Favoritar apps')} onMouseLeave={() => setDica(null)} onFocus={mostrar('Favoritar apps')} onBlur={() => setDica(null)}>
                <button className="lancador-ico vazio-ico" onClick={alternar} aria-label="Adicionar favoritos"><Icone nome="estrela" tamanho={20} /></button>
              </span>
            )}
          </div>
        )}

        {aberto && (
          <div className="lancador-corpo">
            <div className="abas" role="tablist" aria-label="Aplicativos">
              {(['todos', 'favoritos'] as const).map((id) => (
                <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{id === 'favoritos' ? `Favoritos (${favs.length})` : 'Todos os apps'}</button>
              ))}
            </div>
            {erro && <p className="erro" role="alert">{erro}</p>}
            {lista.length === 0 && !erro && <p className="vazio">{aba === 'favoritos' ? 'Nenhum favorito ainda. Em “Todos os apps”, use a estrela para favoritar.' : 'Nenhum app cadastrado.'}</p>}
            <ul className="lancador-lista">
              {lista.map((a) => {
                const fav = favoritos.includes(a.slug);
                return (
                  <li className="lancador-item" key={a.slug}>
                    <LinkApp url={a.url} className="lancador-link">
                      <span className="icone"><IconeApp app={a} tamanho={20} /></span>
                      <span className="texto"><b>{a.nome}</b><small>{a.categoria}</small></span>
                      <Icone nome="externo" tamanho={15} />
                    </LinkApp>
                    <button className="icone-btn" aria-pressed={fav} aria-label={`${fav ? 'Remover' : 'Adicionar'} ${a.nome} ${fav ? 'dos' : 'aos'} favoritos`} onClick={() => alternarFavorito(a.slug)}>
                      <Icone nome="estrela" tamanho={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
      {!aberto && dica && createPortal(<div className="lancador-dica" role="tooltip" style={{ top: dica.y, right: dica.x }}>{dica.nome}</div>, document.body)}
    </>
  );
}
