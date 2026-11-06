import { useState } from 'react';
import { Icone } from '../icones';
import { useLista, type Aplicacao } from '../dados';
import { LinkApp, useLargura } from './LinkApp';
import { LARGURA_DESKTOP } from '../links';

export function CartaoApp({ app, favorito, alternarFavorito }: { app: Aplicacao; favorito: boolean; alternarFavorito: (slug: string) => void }) {
  const desktop = useLargura() >= LARGURA_DESKTOP;
  return (
    <article className="modulo cartao-app">
      <span className="icone"><Icone nome={app.icone === 'users' ? 'pessoas' : 'aplicacoes'} tamanho={22} /></span>
      <span className="texto">
        <b>{app.nome}</b>
        <small>{app.descricao}</small>
        <small className="acesso">{app.categoria} · {app.acesso}</small>
        <small className="acesso">{desktop ? 'Abre em nova aba.' : 'Abre nesta aba; use Voltar do navegador para retornar.'}</small>
      </span>
      <span className="acoes-app">
        <button className="btn btn-sec btn-pequeno" aria-pressed={favorito} onClick={() => alternarFavorito(app.slug)} title={favorito ? 'Remover dos favoritos' : 'Favoritar'}>
          <Icone nome="estrela" tamanho={14} /> {favorito ? 'Favorito' : 'Favoritar'}
        </button>
        <LinkApp url={app.url} className="btn btn-acento btn-pequeno">Abrir <Icone nome="externo" tamanho={14} /></LinkApp>
      </span>
    </article>
  );
}

export function Aplicacoes({ favoritos, alternarFavorito }: { favoritos: string[]; alternarFavorito: (slug: string) => void }) {
  const { dados, erro } = useLista<Aplicacao>('/api/aplicacoes');
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const lista = (dados ?? []).filter((a) => !termo || [a.nome, a.descricao, a.categoria].some((v) => v.toLocaleLowerCase('pt-BR').includes(termo)));
  return (
    <>
      <p className="suave">Sistemas web usados pela equipe. Outras categorias aparecem aqui quando houver destino confirmado.</p>
      <div className="barra">
        <input className="busca" type="search" placeholder="Buscar aplicação" aria-label="Buscar aplicação" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="suave" aria-live="polite">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados === null && !erro && <p className="vazio">Carregando…</p>}
      {dados && lista.length === 0 && <p className="vazio">Nenhuma aplicação encontrada. <button className="btn btn-sec btn-pequeno" onClick={() => setBusca('')}>Limpar busca</button></p>}
      <div className="modulos">{lista.map((a) => <CartaoApp key={a.slug} app={a} favorito={favoritos.includes(a.slug)} alternarFavorito={alternarFavorito} />)}</div>
    </>
  );
}
