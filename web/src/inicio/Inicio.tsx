import { Icone } from '../icones';
import { Capa, Lema } from '../Capa';
import { Destaques } from './Destaques';
import { ListaComunicados } from '../comunicados/Comunicados';
import { dataCurta, useLista, type Comunicado, type Documento } from '../dados';
import type { Tela } from '../Menu';

/** Início: faixa de novidades, pessoas em destaque, comunicados e (à direita) avisos importantes e documentos atualizados. */
export function Inicio({ irPara, comunicados }: {
  irPara: (t: Tela, slug?: string) => void; comunicados: Comunicado[] | null;
}) {
  const { dados: docs } = useLista<Documento>('/api/documentos');
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente').slice(0, 3);
  // Documentos mais recentemente revisados (os sem data de revisão ficam por último).
  const recentes = [...(docs ?? [])].sort((a, b) => (b.revisado_em ?? '').localeCompare(a.revisado_em ?? '')).slice(0, 4);
  return (
    <>
      <section className="hero" aria-label="Novidades da semana">
        <div className="hero-texto">
          <small className="eyebrow">DI PAULA</small>
          <h2>Novidades<br />da <em>semana</em></h2>
          <p>Coleção Movimento Real já está em produção e chega em breve às nossas lojas.</p>
          <button className="btn btn-coral" onClick={() => irPara('comunicados', comunicados?.[0]?.slug)}>Saiba mais <Icone nome="seta" tamanho={16} /></button>
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

        <aside className="inicio-lateral" aria-label="Avisos e documentos">
          {urgentes.length > 0 && (
            <section className="cartao-sec cartao-aviso" aria-labelledby="av-imp">
              <div className="sec-topo"><h2 id="av-imp"><Icone nome="sino" tamanho={22} /> Avisos importantes</h2></div>
              <ul className="mini-lista">
                {urgentes.map((c) => (
                  <li key={c.slug}>
                    <a className="mini-item" href={`#comunicados/${encodeURIComponent(c.slug)}`}>
                      <span className="mini-ico urgente"><Icone nome="comunicados" tamanho={18} /></span>
                      <span className="texto"><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)}</small></span>
                      <Icone nome="dir" tamanho={15} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="cartao-sec" aria-labelledby="doc-rec">
            <div className="sec-topo">
              <h2 id="doc-rec"><Icone nome="documentos" tamanho={22} /> Documentos atualizados</h2>
              <button className="link-ver" onClick={() => irPara('documentos')}>Ver todos <Icone nome="seta" tamanho={15} /></button>
            </div>
            {docs === null && <p className="vazio">Carregando…</p>}
            {docs && recentes.length === 0 && <p className="vazio">Nenhum documento cadastrado ainda.</p>}
            <ul className="mini-lista">
              {recentes.map((d) => (
                <li key={d.slug}>
                  <a className="mini-item" href="#documentos">
                    <span className="mini-ico"><Icone nome="documentos" tamanho={18} /></span>
                    <span className="texto">
                      <b>{d.titulo}</b>
                      <small>{[d.versao && `Versão ${d.versao}`, d.responsavel, d.revisado_em && `revisado em ${dataCurta(d.revisado_em)}`].filter(Boolean).join(' · ') || d.categoria}</small>
                    </span>
                    <Icone nome="dir" tamanho={15} />
                  </a>
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
