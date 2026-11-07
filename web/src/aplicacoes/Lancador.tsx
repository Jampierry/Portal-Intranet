import { useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Aplicacao } from '../dados';
import { LinkApp } from './LinkApp';

const iconeApp = (a: Aplicacao) => (a.icone === 'users' ? 'pessoas' : 'aplicacoes');

/** Barra lateral direita de aplicativos. Recolhida (desktop): só os ícones dos favoritos. Aberta: abas Favoritos / Todos os apps.
 *  No celular some e vira uma gaveta sobre a página, aberta pelo botão de apps do topo. */
export function Lancador({ aberto, alternar, fechar, favoritos, alternarFavorito }: {
  aberto: boolean; alternar: () => void; fechar: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void;
}) {
  const { dados, erro } = useLista<Aplicacao>('/api/aplicacoes');
  const [aba, setAba] = useState<'favoritos' | 'todos'>('favoritos');
  const todos = dados ?? [];
  const favs = todos.filter((a) => favoritos.includes(a.slug));
  const lista = aba === 'favoritos' ? favs : todos;
  return (
    <>
      {aberto && <div className="cortina-lancador" onClick={fechar} />}
      <aside className={`lancador${aberto ? ' aberto' : ''}`} aria-label="Aplicativos">
        <div className="lancador-topo">
          {aberto && <h2>Aplicativos</h2>}
          <button className="icone-btn" aria-expanded={aberto} aria-label={aberto ? 'Recolher aplicativos' : 'Abrir aplicativos'} title={aberto ? 'Recolher' : 'Aplicativos'} onClick={alternar}>
            <Icone nome={aberto ? 'dir' : 'apps'} />
          </button>
        </div>

        {!aberto && (
          <div className="lancador-mini">
            {favs.map((a) => (
              <LinkApp key={a.slug} url={a.url} className="lancador-ico"><Icone nome={iconeApp(a)} tamanho={20} /><span className="sr-only">{a.nome}</span><span className="dica" aria-hidden="true">{a.nome}</span></LinkApp>
            ))}
            {favs.length === 0 && <button className="lancador-ico vazio-ico" onClick={alternar} aria-label="Adicionar favoritos"><Icone nome="estrela" tamanho={20} /><span className="dica" aria-hidden="true">Favoritar apps</span></button>}
          </div>
        )}

        {aberto && (
          <div className="lancador-corpo">
            <div className="abas" role="tablist" aria-label="Aplicativos">
              {(['favoritos', 'todos'] as const).map((id) => (
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
                      <span className="icone"><Icone nome={iconeApp(a)} tamanho={20} /></span>
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
            <small className="suave">No computador, abrem em nova aba. Favoritos ficam salvos só neste navegador.</small>
          </div>
        )}
      </aside>
    </>
  );
}
