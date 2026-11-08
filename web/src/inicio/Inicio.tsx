import { Icone } from '../icones';
import { useEmpresa } from '../empresa';
import { iconePorTexto } from '../iconesAuto';
import { Capa, Lema } from '../Capa';
import { Destaques } from './Destaques';
import { Novidades } from './Novidades';
import { MissaoVisaoValores } from './MissaoVisaoValores';
import { PessoasDoMes } from './PessoasDoMes';
import { ListaComunicados } from '../comunicados/Comunicados';
import { dataCurta, useLista, type Banner, type Comunicado, type Documento } from '../dados';
import type { Tela } from '../Menu';

/** Início: faixa de novidades, missão/visão/valores, colaborador destaque, comunicados e (à direita) avisos importantes e documentos atualizados. */
export function Inicio({ irPara, comunicados, veComunicados = true, veDocumentos = true }: {
  irPara: (t: Tela, slug?: string) => void; comunicados: Comunicado[] | null; veComunicados?: boolean; veDocumentos?: boolean;
}) {
  const empresa = useEmpresa();
  const { dados: docs } = useLista<Documento>(veDocumentos ? '/api/documentos' : null);
  const { dados: banners } = useLista<Banner>('/api/banners');
  // Avisos importantes: os urgentes e os que pedem a sua confirmação de leitura (sem repetir).
  const pedeLeitura = (c: Comunicado) => !!c.exige_leitura && !c.lido;
  const urgentes = (comunicados ?? []).filter((c) => c.prioridade === 'urgente' || pedeLeitura(c)).slice(0, 3);
  // Documentos mais recentemente revisados (os sem data de revisão ficam por último).
  const recentes = [...(docs ?? [])].sort((a, b) => (b.revisado_em ?? '').localeCompare(a.revisado_em ?? '')).slice(0, 4);
  const heroPadrao = (
      <section className="hero" aria-label="Novidades da semana">
        <div className="hero-texto">
          <small className="eyebrow">{empresa.nome.toUpperCase()}</small>
          <h2>Novidades<br />da <em>semana</em></h2>
          <p>Acompanhe os comunicados e as novidades mais recentes da {empresa.nome}.</p>
          <button className="btn btn-coral" onClick={() => irPara('comunicados', comunicados?.[0]?.slug)}>Saiba mais <Icone nome="seta" tamanho={16} /></button>
        </div>
        <Capa semente="hero" icone="colecoes" classe="hero-arte"><Lema linhas={['MODA', 'QUE ACOMPANHA', 'A SUA HISTÓRIA']} /></Capa>
        <div className="hero-marca" aria-hidden="true"><Lema linhas={['QUALIDADE', 'EM CADA', 'MOVIMENTO']} /></div>
      </section>
  );
  return (
    <>
      {banners === null && <section className="hero novidades" aria-label="Novidades da semana" />}
      {banners && banners.length > 0 && <Novidades banners={banners} irPara={irPara} padrao={heroPadrao} />}
      {banners && banners.length === 0 && heroPadrao}

      <div className="inicio-grade">
        <div className="inicio-principal">
          <div className="linha-mvv">
            <MissaoVisaoValores />
            <Destaques compacto />
          </div>
          <PessoasDoMes />
          {veComunicados && <section className="cartao-sec" aria-labelledby="com-rec">
            <div className="sec-topo">
              <h2 id="com-rec"><Icone nome="comunicados" tamanho={24} /> Comunicados</h2>
              <button className="link-ver" onClick={() => irPara('comunicados')}>Ver todos os comunicados <Icone nome="seta" tamanho={16} /></button>
            </div>
            {comunicados === null ? <p className="vazio">Carregando…</p> : <ListaComunicados itens={comunicados.slice(0, 3)} linha />}
          </section>}
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
                      <span className="texto"><b>{c.titulo}</b><small>{c.categoria} · {dataCurta(c.publicado_em)}{pedeLeitura(c) ? ' · confirme a leitura' : ''}</small></span>
                      <Icone nome="dir" tamanho={15} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {veDocumentos && <section className="cartao-sec" aria-labelledby="doc-rec">
            <div className="sec-topo">
              <h2 id="doc-rec"><Icone nome="documentos" tamanho={22} /> Documentos recentes</h2>
              <button className="link-ver" onClick={() => irPara('documentos')}>Ver todos <Icone nome="seta" tamanho={15} /></button>
            </div>
            {docs === null && <p className="vazio">Carregando…</p>}
            {docs && recentes.length === 0 && <p className="vazio">Nenhum documento cadastrado ainda.</p>}
            <ul className="mini-lista">
              {recentes.map((d) => (
                <li key={d.slug}>
                  <a className="mini-item" href="#documentos">
                    <span className="mini-ico"><Icone nome={iconePorTexto(`${d.categoria} ${d.titulo}`, 'documentos')} tamanho={18} /></span>
                    <span className="texto">
                      <b>{d.titulo}</b>
                      <small>{[d.versao && `Versão ${d.versao}`, d.responsavel, d.revisado_em && `revisado em ${dataCurta(d.revisado_em)}`].filter(Boolean).join(' · ') || d.categoria}</small>
                    </span>
                    <Icone nome="dir" tamanho={15} />
                  </a>
                </li>
              ))}
            </ul>
          </section>}

        </aside>
      </div>
    </>
  );
}
