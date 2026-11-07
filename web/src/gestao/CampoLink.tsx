import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { api } from '../api';

interface Com { slug: string; titulo: string; categoria: string }
interface Opcao { valor: string; rotulo: string; detalhe?: string; grupo: 'Páginas do portal' | 'Comunicados' }

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
  const [externo, setExterno] = useState(() => valor !== '' && !valor.startsWith('#'));
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // Comunicados publicados (se a pessoa não tiver acesso à lista, ficam só as páginas).
  useEffect(() => { api<Com[]>('/api/comunicados').then(setComs).catch(() => setComs([])); }, []);

  // O painel é "fixed" (fica por cima do pop-up, sem aumentar a rolagem dele). Como a página pode estar com zoom, a posição é
  // medida depois de desenhada e corrigida: o painel sempre nasce colado no campo, abaixo dele (ou acima, se não couber).
  useLayoutEffect(() => {
    const p = painel.current, b = botao.current;
    if (!aberto || !p || !b) return;
    const r = b.getBoundingClientRect();
    p.style.maxHeight = ''; p.style.width = `${r.width}px`;
    const escala = (() => { const w = p.getBoundingClientRect().width; return w ? r.width / w : 1; })(); // inverso do zoom da página
    p.style.width = `${r.width * escala}px`;
    // Coloca o painel exatamente em (esq, topo), nas medidas dos elementos: converte pelo zoom e corrige a sobra uma vez.
    const colocar = (esq: number, topo: number) => {
      p.style.left = `${esq * escala}px`; p.style.top = `${topo * escala}px`;
      const a = p.getBoundingClientRect();
      p.style.left = `${esq * escala + (esq - a.left) * escala}px`; p.style.top = `${topo * escala + (topo - a.top) * escala}px`;
    };
    colocar(r.left, r.bottom + 4);
    // Abre para baixo; só vai para cima se a lista não couber embaixo e houver mais espaço em cima.
    const altura = viewportAltura();
    const abaixo = altura - r.bottom - 12, acima = r.top - 12;
    p.style.maxHeight = `${380 * escala}px`;
    const natural = p.getBoundingClientRect().height; // altura que a lista quer ter (até 380)
    const paraCima = natural > abaixo && acima > abaixo;
    p.style.maxHeight = `${Math.max(120, Math.min(natural, paraCima ? acima : abaixo)) * escala}px`;
    if (paraCima) colocar(r.left, r.top - 4 - p.getBoundingClientRect().height);
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
  ], [coms]);
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
      <label htmlFor={id}>{rotulo}{obrigatorio ? ' *' : ''}
        <button id={id} ref={botao} type="button" className="campo-link-botao" aria-haspopup="listbox" aria-expanded={aberto} onClick={(e) => { e.preventDefault(); setAberto(!aberto); }}>
          <span className={atual || externo ? '' : 'suave'}>{texto}</span>
        </button>
      </label>
      {aberto && (
        <div ref={painel} className="campo-link-painel" role="dialog" aria-label="Escolher o destino do botão">
          <input ref={campoBusca} type="search" placeholder="Pesquisar comunicado ou página…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar" />
          <ul role="listbox">
            <li><button type="button" role="option" aria-selected={valor === '' && !externo} onClick={() => escolher('')}><i>Sem link</i></button></li>
            {(['Páginas do portal', 'Comunicados'] as const).map((g) => {
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
      {dica && <small className="suave">{dica}</small>}
    </div>
  );
}

/** Altura útil da janela no mesmo "espaço" das medidas dos elementos (a página pode ter zoom). */
function viewportAltura() {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  return innerHeight / z;
}
