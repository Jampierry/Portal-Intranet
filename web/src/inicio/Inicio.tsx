import { Icone } from '../icones';
import { Capa, Lema } from '../Capa';
import { Destaques } from './Destaques';
import { ListaComunicados } from '../comunicados/Comunicados';
import { LinkApp } from '../aplicacoes/LinkApp';
import { saudacao, type Perfil } from '../perfil';
import type { Aplicacao, Comunicado } from '../dados';
import type { Tela } from '../Menu';

/** Início: saudação, faixa de novidades, pessoas em destaque, comunicados e (à direita) aplicações favoritas. */
export function Inicio({ irPara, perfil, apps, favoritos, comunicados }: {
  irPara: (t: Tela) => void; perfil: Perfil; apps: Aplicacao[] | null; favoritos: string[]; comunicados: Comunicado[] | null;
}) {
  const favs = (apps ?? []).filter((a) => favoritos.includes(a.slug));
  const lista = favs.length ? favs : (apps ?? []).slice(0, 3);
  const primeiro = perfil.nome.split(' ')[0];
  return (
    <>
      <div className="saudacao"><h1>{saudacao()}, {primeiro}</h1><p>Juntos, movemos o que inspira.</p></div>

      <section className="hero" aria-label="Novidades da semana">
        <div className="hero-texto">
          <small className="eyebrow">DI PAULA</small>
          <h2>Novidades<br />da <em>semana</em></h2>
          <p>Coleção Movimento Real já está em produção e chega em breve às nossas lojas.</p>
          <button className="btn btn-coral" onClick={() => irPara('comunicados')}>Saiba mais <Icone nome="seta" tamanho={16} /></button>
        </div>
        <Capa semente="hero" icone="colecoes" classe="hero-arte"><Lema linhas={['MODA', 'QUE ACOMPANHA', 'A SUA HISTÓRIA']} /></Capa>
        <div className="hero-marca" aria-hidden="true"><Lema linhas={['QUALIDADE', 'EM CADA', 'MOVIMENTO']} /></div>
      </section>

      <div className="inicio-grade">
        <div className="inicio-principal">
          <Destaques />
          <section className="cartao-sec" aria-labelledby="com-rec">
            <div className="sec-topo">
              <h2 id="com-rec"><Icone nome="comunicados" tamanho={24} /> Comunicados</h2>
              <button className="link-ver" onClick={() => irPara('comunicados')}>Ver todos os comunicados <Icone nome="seta" tamanho={16} /></button>
            </div>
            {comunicados === null ? <p className="vazio">Carregando…</p> : <ListaComunicados itens={comunicados.slice(0, 3)} linha />}
          </section>
        </div>

        <aside className="inicio-lateral" aria-label="Aplicações favoritas">
          <section className="cartao-sec">
            <div className="sec-topo"><h2><Icone nome="aplicacoes" tamanho={22} /> Aplicações favoritas</h2></div>
            {lista.length === 0 && <p className="vazio">Nenhum favorito ainda. Abra Aplicações e use “Favoritar”.</p>}
            <ul className="favs">
              {lista.map((a) => (
                <li key={a.slug}>
                  <LinkApp url={a.url} className="fav">
                    <span className="icone"><Icone nome={a.icone === 'users' ? 'pessoas' : 'aplicacoes'} tamanho={22} /></span>
                    <span className="texto"><b>{a.nome}</b><small>{a.descricao}</small></span>
                    <Icone nome="externo" tamanho={18} />
                  </LinkApp>
                  <small className="abre">Abre em nova aba do navegador</small>
                </li>
              ))}
            </ul>
          </section>
          <section className="painel-marca painel-marca-baixo" aria-hidden="true"><Lema linhas={['JUNTOS', 'POR UM FUTURO', 'MAIS ATIVO']} /></section>
        </aside>
      </div>
    </>
  );
}
