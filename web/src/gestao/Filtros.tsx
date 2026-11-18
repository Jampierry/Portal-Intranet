import { BotaoLimpar } from '../BotaoLimpar';
import { useMemo, useState } from 'react';
import { Icone } from '../icones';

export const semAcentoBusca = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface FiltroDef<T> { chave: string; rotulo: string; valor: (r: T) => string }

/** Pesquisa + filtros por lista suspensa, no mesmo formato da barra das abas de Publicar (Crud). `texto` devolve o que a pesquisa deve enxergar em cada linha. */
export function useFiltros<T>(linhas: T[] | null, filtros: FiltroDef<T>[], texto: (r: T) => string) {
  const [busca, setBusca] = useState('');
  const [escolhidos, setEscolhidos] = useState<Record<string, string>>({});
  const opcoes = useMemo(() => Object.fromEntries(filtros.map((f) => [f.chave, [...new Set((linhas ?? []).map(f.valor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))])), [linhas]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtradas = useMemo(() => {
    if (!linhas) return linhas;
    const alvo = semAcentoBusca(busca.trim());
    return linhas.filter((r) => filtros.every((f) => !escolhidos[f.chave] || f.valor(r) === escolhidos[f.chave]) && (!alvo || semAcentoBusca(texto(r)).includes(alvo)));
  }, [linhas, busca, escolhidos]); // eslint-disable-line react-hooks/exhaustive-deps
  const ativo = !!busca || Object.values(escolhidos).some(Boolean);
  const barra = (extra?: React.ReactNode) => (
    <div className="barra filtros-usuarios">
      <label className="busca-pagina"><Icone nome="busca" tamanho={16} /><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nesta lista" aria-label="Pesquisar nesta lista" />{busca && <BotaoLimpar aoLimpar={() => setBusca('')} />}</label>
      {filtros.map((f) => (
        <select key={f.chave} value={escolhidos[f.chave] ?? ''} onChange={(e) => setEscolhidos((o) => ({ ...o, [f.chave]: e.target.value }))} aria-label={`Filtrar por ${f.rotulo.toLowerCase()}`}>
          <option value="">{f.rotulo}: todos</option>
          {(opcoes[f.chave] ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {ativo && <button type="button" className="btn btn-sec btn-pequeno" onClick={() => { setBusca(''); setEscolhidos({}); }}>Limpar</button>}
      {linhas && <span className="suave" aria-live="polite">{filtradas?.length ?? 0} de {linhas.length}</span>}
      {extra}
    </div>
  );
  return { filtradas, barra };
}
