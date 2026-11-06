import { useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Aplicacao } from '../dados';
import { LinkApp } from './LinkApp';

/** Lançador global na direita. Recolhido (desktop): só ícones dos favoritos. No celular vira gaveta sobre a página. */
export function Lancador({ aberto, alternar, fechar, favoritos, alternarFavorito }: {
  aberto: boolean; alternar: () => void; fechar: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void;
}) {
  const { dados } = useLista<Aplicacao>('/api/aplicacoes');
  const [aba, setAba] = useState<'favoritos' | 'todos'>('favoritos');
  const todos = dados ?? [];
  const favs = todos.filter((a) => favoritos.includes(a.slug));
  const lista = aba === 'favoritos' ? favs : todos;
  return (
    <>
      {aberto && <div className="cortina cortina-lancador" onClick={fechar} />}
      <aside className={`lancador${aberto ? ' aberto' : ''}`} aria-label="Aplicativos">
        <button className="icone-btn lancador-toggle" aria-expanded={aberto} aria-label={aberto ? 'Recolher aplicativos' : 'Abrir aplicativos'} onClick={alternar}>
          <Icone nome="apps" />
        </button>
        {!aberto && <div className="lancador-mini">{favs.map((a) => (
          <LinkApp key={a.slug} url={a.url} className="icone-btn"><Icone nome="aplicacoes" tamanho={18} /><span className="sr-only">{a.nome}</span></LinkApp>
        ))}</div>}
        {aberto && (
          <div className="lancador-corpo">
            <div className="abas" role="tablist" aria-label="Aplicativos">
              {(['favoritos', 'todos'] as const).map((id) => (
                <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}>{id === 'favoritos' ? 'Favoritos' : 'Todos os apps'}</button>
              ))}
            </div>
            {lista.length === 0 && <p className="vazio">{aba === 'favoritos' ? 'Nenhum favorito ainda. Use "Todos os apps" para favoritar.' : 'Nenhum app cadastrado.'}</p>}
            {lista.map((a) => (
              <div className="lancador-item" key={a.slug}>
                <LinkApp url={a.url} className="lancador-link"><b>{a.nome}</b><small>{a.categoria}</small></LinkApp>
                <button className="icone-btn" aria-pressed={favoritos.includes(a.slug)} aria-label={`${favoritos.includes(a.slug) ? 'Remover' : 'Adicionar'} ${a.nome} ${favoritos.includes(a.slug) ? 'dos' : 'aos'} favoritos`} onClick={() => alternarFavorito(a.slug)}>
                  <Icone nome="estrela" tamanho={16} />
                </button>
              </div>
            ))}
            <small className="suave">Favoritos ficam salvos só neste navegador.</small>
          </div>
        )}
      </aside>
    </>
  );
}
