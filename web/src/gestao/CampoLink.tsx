import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { api } from '../api';
import { Icone } from '../icones';

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

/** Link do botão do banner: escolha (com pesquisa) uma página do portal ou um comunicado; ou digite um endereço externo. */
export function CampoLink({ rotulo, id, valor, mudar, dica, obrigatorio }: { rotulo: string; id: string; valor: string; mudar: (v: string) => void; dica?: string; obrigatorio?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [coms, setComs] = useState<Com[]>([]);
  const [externo, setExterno] = useState(() => valor !== '' && !valor.startsWith('#'));
  const raiz = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  // Comunicados publicados (se a pessoa não tiver acesso à lista, ficam só as páginas).
  useEffect(() => { api<Com[]>('/api/comunicados').then(setComs).catch(() => setComs([])); }, []);
  useEffect(() => { if (aberto) campoBusca.current?.focus(); }, [aberto]);

  const opcoes: Opcao[] = useMemo(() => [
    ...PAGINAS,
    ...coms.map((c) => ({ valor: `#comunicados/${c.slug}`, rotulo: c.titulo, detalhe: c.categoria, grupo: 'Comunicados' as const })),
  ], [coms]);
  const atual = opcoes.find((o) => o.valor === valor);
  const filtradas = opcoes.filter((o) => semAcento(`${o.rotulo} ${o.detalhe ?? ''}`).includes(semAcento(busca.trim())));

  const escolher = (v: string) => { mudar(v); setExterno(false); setAberto(false); setBusca(''); };
  const fecharSeFora = (e: FocusEvent) => { if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false); };
  const texto = externo ? 'Endereço externo (digitado abaixo)'
    : atual ? atual.rotulo
    : valor ? `Comunicado ou página não encontrado: ${valor}`
    : 'Sem link (o botão não aparece)';

  return (
    <div className="campo-link" ref={raiz} onBlur={fecharSeFora} onKeyDown={(e) => { if (e.key === 'Escape' && aberto) { e.stopPropagation(); e.preventDefault(); setAberto(false); } }}>
      <label htmlFor={id}>{rotulo}{obrigatorio ? ' *' : ''}</label>
      <div className="campo-link-caixa">
      <button id={id} type="button" className="campo-link-botao" aria-haspopup="listbox" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <span className={atual || externo ? '' : 'suave'}>{texto}</span>
        <Icone nome="busca" tamanho={15} />
      </button>
      {aberto && (
        <div className="campo-link-painel" role="dialog" aria-label="Escolher o destino do botão">
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
      </div>
      {externo && (
        <input type="text" aria-label="Endereço externo" placeholder="https://…" maxLength={300} value={valor.startsWith('#') ? '' : valor} onChange={(e) => mudar(e.target.value)} />
      )}
      {dica && <small className="suave">{dica}</small>}
    </div>
  );
}
