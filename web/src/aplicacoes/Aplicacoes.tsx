import { Icone } from '../icones';
import { Cabecalho, Estado } from '../Cabecalho';
import { useLista, type Aplicacao } from '../dados';
import { LinkApp, useLargura } from './LinkApp';
import { LARGURA_DESKTOP } from '../links';

export function CartaoApp({ app, favorito, alternarFavorito }: { app: Aplicacao; favorito: boolean; alternarFavorito: (slug: string) => void }) {
  const desktop = useLargura() >= LARGURA_DESKTOP;
  return (
    <article className="cartao-app">
      <div className="cartao-app-topo">
        <span className="icone"><Icone nome={app.icone === 'users' ? 'pessoas' : 'aplicacoes'} tamanho={24} /></span>
        <button className="icone-btn" aria-pressed={favorito} onClick={() => alternarFavorito(app.slug)} aria-label={favorito ? `Remover ${app.nome} dos favoritos` : `Favoritar ${app.nome}`} title={favorito ? 'Remover dos favoritos' : 'Favoritar'}>
          <Icone nome="estrela" tamanho={16} />
        </button>
      </div>
      <div className="texto">
        <h3>{app.nome}</h3>
        <p>{app.descricao}</p>
        <small>{app.categoria} · {app.acesso}</small>
      </div>
      <footer>
        <small>{desktop ? 'Abre em nova aba.' : 'Abre nesta aba; use Voltar do navegador.'}</small>
        <LinkApp url={app.url} className="btn btn-pri btn-pequeno">Abrir <Icone nome="externo" tamanho={14} /></LinkApp>
      </footer>
    </article>
  );
}

export function Aplicacoes({ busca, limparBusca, favoritos, alternarFavorito }: { busca: string; limparBusca: () => void; favoritos: string[]; alternarFavorito: (slug: string) => void }) {
  const { dados, erro } = useLista<Aplicacao>('/api/aplicacoes');
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? []).filter((a) => !termo || [a.nome, a.descricao, a.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo)));
  return (
    <>
      <Cabecalho titulo="Aplicações" sub="Sistemas web usados pela equipe. Outras categorias aparecem aqui quando houver destino confirmado." />
      <p className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'aplicação' : 'aplicações'}{termo ? ` para “${busca}”` : ''}</p>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={limparBusca} />
      <div className="grade-apps">{lista.map((a) => <CartaoApp key={a.slug} app={a} favorito={favoritos.includes(a.slug)} alternarFavorito={alternarFavorito} />)}</div>
    </>
  );
}
