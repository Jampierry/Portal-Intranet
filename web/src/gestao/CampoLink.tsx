import { RotuloDica } from '../Dica';
import { abrirFlutuante, posicionarFlutuante } from '../flutuante';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { api } from '../api';

interface Com { slug: string; titulo: string; categoria: string }
interface Doc { slug: string; titulo: string; categoria: string }
interface Opcao { valor: string; rotulo: string; detalhe?: string; grupo: 'Páginas do portal' | 'Comunicados' | 'Documentos' }

const PAGINAS: Opcao[] = [
  { valor: '#inicio', rotulo: 'Início', grupo: 'Páginas do portal' },
  { valor: '#comunicados', rotulo: 'Comunicados (lista)', grupo: 'Páginas do portal' },
  { valor: '#documentos', rotulo: 'Documentos', grupo: 'Páginas do portal' },
  { valor: '#pessoas', rotulo: 'Pessoas (contatos)', grupo: 'Páginas do portal' },
  { valor: '#ajuda', rotulo: 'Ajuda', grupo: 'Páginas do portal' },
];
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Link do botão do banner: escolha (com pesquisa) uma página do portal ou um comunicado; ou digite um endereço externo.
 *  Mesma estrutura dos outros campos do formulário (rótulo + controle + dica). */
export function CampoLink({ rotulo, id, valor, mudar, dica, obrigatorio, metade }: { rotulo: string; id: string; valor: string; mudar: (v: string) => void; dica?: string; obrigatorio?: boolean; metade?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [coms, setComs] = useState<Com[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [externo, setExterno] = useState(() => valor !== '' && !valor.startsWith('#'));
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // Comunicados publicados (se a pessoa não tiver acesso à lista, ficam só as páginas).
  useEffect(() => { api<Com[]>('/api/comunicados').then(setComs).catch(() => setComs([])); api<Doc[]>('/api/documentos').then(setDocs).catch(() => setDocs([])); }, []);

  // O painel é "fixed" (fica por cima do pop-up, sem aumentar a rolagem dele). Como a página pode estar com zoom, a posição é
  // medida depois de desenhada e corrigida: o painel sempre nasce colado no campo, abaixo dele (ou acima, se não couber).
  useLayoutEffect(() => {
    const p = painel.current, b = botao.current;
    if (!aberto || !p || !b) return;
    abrirFlutuante(p); // camada superior: não é cortada pela janela pop-up
    // Abre embaixo se couber; senão, para o lado com mais espaço (limitando a altura, com rolagem dentro da lista).
    posicionarFlutuante(p, b.getBoundingClientRect(), { larguraIgual: true, alturaMax: 380 });
    campoBusca.current?.focus({ preventScroll: true });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: Event) => { if (!(e.target instanceof Node) || !raiz.current?.contains(e.target)) setAberto(false); };
    addEventListener('resize', fechar); addEventListener('scroll', fechar, true);
    return () => { removeEventListener('resize', fechar); removeEventListener('scroll', fechar, true); };
  }, [aberto]);

  const opcoes: Opcao[] = useMemo(() => [
    ...PAGINAS,
    ...coms.map((c) => ({ valor: `#comunicados/${c.slug}`, rotulo: c.titulo, detalhe: c.categoria, grupo: 'Comunicados' as const })),
    ...docs.map((d) => ({ valor: `#documentos/${d.slug}`, rotulo: d.titulo, detalhe: d.categoria, grupo: 'Documentos' as const })),
  ], [coms, docs]);
  const atual = opcoes.find((o) => o.valor === valor);
  const filtradas = opcoes.filter((o) => semAcento(`${o.rotulo} ${o.detalhe ?? ''}`).includes(semAcento(busca.trim())));

  const escolher = (v: string) => { mudar(v); setExterno(false); setAberto(false); setBusca(''); botao.current?.focus(); };
  const fecharSeFora = (e: FocusEvent) => { if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false); };
  const texto = externo ? 'Endereço externo (digite abaixo)'
    : atual ? atual.rotulo
    : valor ? `Não encontrado: ${valor}`
    : 'Sem link (o botão não aparece)';

  return (
    <div ref={raiz} className={metade ? 'meia' : undefined} onBlur={fecharSeFora}
      onKeyDown={(e) => { if (e.key === 'Escape' && aberto) { e.stopPropagation(); e.preventDefault(); setAberto(false); botao.current?.focus(); } }}>
      <label htmlFor={id}><RotuloDica texto={`${rotulo}${obrigatorio ? ' *' : ''}`} dica={dica} />
        <button id={id} ref={botao} type="button" className="campo-link-botao" aria-haspopup="listbox" aria-expanded={aberto} onClick={(e) => { e.preventDefault(); setAberto(!aberto); }}>
          <span className={atual || externo ? '' : 'suave'}>{texto}</span>
        </button>
      </label>
      {aberto && (
        <div ref={painel} popover="manual" className="campo-link-painel" role="dialog" aria-label="Escolher o destino do botão">
          <input ref={campoBusca} type="search" placeholder="Pesquisar comunicado ou página…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar" />
          <ul role="listbox">
            <li><button type="button" role="option" aria-selected={valor === '' && !externo} onClick={() => escolher('')}><i>Sem link</i></button></li>
            {(['Páginas do portal', 'Comunicados', 'Documentos'] as const).map((g) => {
              const itens = filtradas.filter((o) => o.grupo === g);
              return itens.length === 0 ? null : (
                <li key={g} role="presentation" className="grupo">
                  <span>{g}</span>
                  <ul>
                    {itens.map((o) => (
                      <li key={o.valor}><button type="button" role="option" aria-selected={o.valor === valor} onClick={() => escolher(o.valor)}>
                        <b>{o.rotulo}</b>{o.detalhe && <small>{o.detalhe}</small>}
                      </button></li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {filtradas.length === 0 && <li className="vazio">Nada encontrado para “{busca}”.</li>}
            <li><button type="button" role="option" aria-selected={externo} onClick={() => { setExterno(true); setAberto(false); if (valor.startsWith('#')) mudar(''); }}>Endereço externo (https://…)</button></li>
          </ul>
        </div>
      )}
      {externo && (
        <input type="text" aria-label="Endereço externo" placeholder="https://…" maxLength={300} value={valor.startsWith('#') ? '' : valor} onChange={(e) => mudar(e.target.value)} />
      )}
    </div>
  );
}

