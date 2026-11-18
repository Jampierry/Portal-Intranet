import { maiusc } from '../caixaAlta';
import type { ReactNode } from 'react';
import { Capa } from '../Capa';
import { Icone } from '../icones';
import { iconePorTexto } from '../iconesAuto';
import { IconeApp } from '../aplicacoes/IconeApp';
import { dataCurta, MESES_LONGOS } from '../dados';
import { Dica } from '../Dica';

type V = Record<string, string | boolean | object>;
const t = (x: unknown) => String(x ?? '').trim();

/** Moldura comum das prévias ao vivo dos formulários de Publicar (ficam à direita do formulário). */
function Painel({ titulo = 'Prévia', dica, avisos = [], children }: { titulo?: string; dica?: string; avisos?: string[]; children: ReactNode }) {
  return (
    <div className="pv">
      <h3 className="pv-titulo pv-com-dica">{titulo}{dica && <Dica lado="dir">{dica}</Dica>}</h3>
      <div className="pv-cartao">{children}</div>
      {avisos.length > 0 && <ul className="pv-avisos">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
    </div>
  );
}

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** Comunicado como aparece nos cartões do portal. */
export function PreviaComunicado({ v }: { v: V }) {
  const titulo = t(v.titulo) || 'Título do comunicado', categoria = t(v.categoria) || 'Categoria';
  const avisos: string[] = [];
  if (t(v.status) === 'rascunho') avisos.push('Rascunho: não aparece no portal.');
  if (t(v.exibir_de)) avisos.push(`Só passa a aparecer em ${dataCurta(t(v.exibir_de))}.`);
  if (v.exige_leitura) avisos.push('Cada pessoa verá o botão “Li e estou ciente”.');
  return (
    <Painel titulo="Prévia do cartão" dica="Assim o comunicado aparece na lista de Comunicados e no Início." avisos={avisos}>
      <article className="cartao-com">
        <Capa semente={titulo} icone={iconePorTexto(`${categoria} ${titulo}`, 'comunicados')} foto={t(v.imagem) || null} classe="capa-card">
          {t(v.prioridade) === 'urgente' && <span className="selo">URGENTE</span>}
        </Capa>
        <div className="cartao-com-corpo">
          <small className="cat">{categoria}</small>
          <h3>{titulo}</h3>
          <p>{t(v.resumo) || 'O resumo aparece aqui.'}</p>
          <footer><span><Icone nome="calendario" tamanho={15} /> {dataCurta(t(v.exibir_de) || new Date().toISOString().slice(0, 10))}</span><Icone nome="seta" tamanho={16} /></footer>
        </div>
      </article>
    </Painel>
  );
}

/** Documento como aparece nos cartões da tela Documentos. */
export function PreviaDocumento({ v }: { v: V }) {
  const titulo = t(v.titulo) || 'Título do documento', categoria = t(v.categoria) || 'Categoria', formato = t(v.formato);
  const avisos: string[] = [];
  if (t(v.classificacao) === 'restrito') avisos.push('Restrito: só editores e administradores veem.');
  if (!t(v.link_oficial)) avisos.push('Sem endereço: o botão de abrir não aparece.');
  return (
    <Painel titulo="Prévia do cartão" dica="Assim o documento aparece na tela Documentos." avisos={avisos}>
      <article className="cartao-doc">
        <span className="icone"><Icone nome={iconePorTexto(`${categoria} ${titulo}`, 'documentos')} tamanho={22} /></span>
        <div className="texto">
          <h3>{titulo}</h3><p>{t(v.resumo) || 'O resumo aparece aqui.'}</p>
          <small>{categoria}{formato ? ` · ${formato}` : ''}{t(v.link_oficial) ? '' : ' · sem link oficial'}</small>
          <dl className="meta-doc">
            <div><dt>Versão</dt><dd>{t(v.versao) || '1.0'}</dd></div>
            <div><dt>Responsável</dt><dd>{t(v.responsavel) || 'você'}</dd></div>
            {t(v.revisado_em) && <div><dt>Revisado em</dt><dd>{dataCurta(t(v.revisado_em))}</dd></div>}
          </dl>
          {t(v.link_oficial) && <span className="btn btn-pri btn-pequeno abrir-doc">Abrir documento <Icone nome="externo" tamanho={13} /></span>}
        </div>
      </article>
    </Painel>
  );
}

/** Cartão de pessoa (Colaborador Destaque, aniversariantes e novos colaboradores). */
export function PreviaPessoa({ v, periodo, extra, dica, avisos }: { v: V; periodo?: string; extra?: string; dica: string; avisos?: string[] }) {
  const nome = t(v.nome) || 'Nome da pessoa';
  return (
    <Painel titulo="Prévia do cartão" dica={dica} avisos={avisos}>
      <div className="pv-pessoa">
        <article className="pessoa">
          <div className="pessoa-foto">
            <Capa semente={nome} icone="pessoas" foto={t(v.foto) || null} classe="capa-pessoa">{!t(v.foto) && <span className="iniciais-capa">{iniciais(nome) || '?'}</span>}</Capa>
            {periodo && <span className="pessoa-periodo">{periodo}</span>}
          </div>
          <div><h3 title={maiusc(nome)}>{maiusc(nome)}</h3><small className="area">{maiusc(t(v.area)) || 'ÁREA'}</small>{extra && <p>{extra}</p>}</div>
        </article>
      </div>
    </Painel>
  );
}

export const mesAno = (v: V) => `${MESES_LONGOS[Number(t(v.mes)) - 1] ?? ''} ${t(v.ano)}`.trim();

/** Aplicativo como aparece no catálogo. */
export function PreviaAplicativo({ v }: { v: V }) {
  const nome = t(v.nome) || 'Nome do aplicativo';
  const avisos: string[] = [];
  if (!v.ativo) avisos.push('Inativa: some do portal.');
  if (v.restrita) avisos.push('Restrita: só aparece para quem for liberado.');
  return (
    <Painel titulo="Prévia do cartão" dica="Assim o aplicativo aparece no catálogo e na barra de aplicativos." avisos={avisos}>
      <article className="cartao-app">
        <div className="cartao-app-topo">
          <span className="icone"><IconeApp app={{ icone: t(v.icone) || 'auto', logo: t(v.logo) || null, nome, categoria: t(v.categoria) }} tamanho={24} /></span>
          <span className="icone-btn" aria-hidden="true"><Icone nome="estrela" tamanho={16} /></span>
        </div>
        <div className="texto">
          <h3>{nome}</h3>
          <p>{t(v.descricao) || 'A descrição aparece aqui.'}</p>
          <small>{t(v.categoria) || 'Categoria'} · {t(v.acesso) || 'Condição de acesso'}</small>
        </div>
        <footer><small>Abre em nova aba.</small><span className="btn btn-pri btn-pequeno">Abrir <Icone nome="externo" tamanho={14} /></span></footer>
      </article>
    </Painel>
  );
}

/** Publicação de rede social em formato de postagem (imagem + legenda). */
export function PreviaRede({ v, plataforma }: { v: V; plataforma: string }) {
  const imagem = t(v.imagem);
  const avisos: string[] = [];
  if (!imagem) avisos.push('Sem imagem ou arte.');
  if (t(v.link)) avisos.push('A legenda vai citar o link informado.');
  return (
    <Painel titulo="Prévia da publicação" dica="Aproximação de como a postagem fica: arte, legenda e link. O visual final depende da plataforma." avisos={avisos}>
      <article className="pv-post">
        <header><span className="pv-post-avatar" aria-hidden="true" /><b>{plataforma}</b></header>
        {imagem ? <img src={imagem} alt="" /> : <div className="pv-post-sem">Sem imagem</div>}
        <p>{t(v.legenda) || 'A legenda aparece aqui.'}</p>
        {t(v.link) && <small className="pv-post-link">{t(v.link)}</small>}
      </article>
    </Painel>
  );
}
