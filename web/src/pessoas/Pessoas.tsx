import { useMemo, useState } from 'react';
import { Icone } from '../icones';
import { Estado } from '../Cabecalho';
import { LinkApp } from '../aplicacoes/LinkApp';
import { useLista } from '../dados';
import { urlSegura } from '../links';

export interface Contato { id: number; departamento: string; nome: string; canal: string; ramal: string | null; celular: string | null }

/** Canal de contato: e-mail vira link mailto; endereço http(s) abre como link; o resto (ramal, ferramenta) é texto. */
function Canal({ canal }: { canal: string }) {
  if (!canal) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canal)) return <a className="canal" href={`mailto:${canal}`}><Icone nome="email" tamanho={14} /> {canal}</a>;
  if (urlSegura(canal)) return <LinkApp url={canal} className="canal"><Icone nome="externo" tamanho={14} /> {canal}</LinkApp>;
  return <span className="canal"><Icone nome="info" tamanho={14} /> {canal}</span>;
}

/** Contatos (rota 'pessoas') = contatos por área (o canal certo para cada assunto). Não mostra dados pessoais de funcionários. */
export function Pessoas({ busca, limparBusca }: { busca: string; limparBusca: () => void }) {
  const { dados, erro } = useLista<Contato>('/api/contatos');
  const [q, setQ] = useState('');
  const termos = [busca, q].map((t) => t.trim().toLocaleLowerCase('pt-BR')).filter(Boolean);
  const lista = (dados ?? []).filter((c) => termos.every((t) => [c.departamento, c.nome, c.canal, c.ramal ?? '', c.celular ?? ''].some((v) => v.toLocaleLowerCase('pt-BR').includes(t))));
  const areas = useMemo(() => {
    const m = new Map<string, Contato[]>();
    for (const c of lista) m.set(c.departamento, [...(m.get(c.departamento) ?? []), c]);
    return [...m.entries()];
  }, [lista]);
  return (
    <>
      <label className="busca-pagina">
        <Icone nome="busca" tamanho={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar área, assunto, e-mail ou ramal" aria-label="Buscar contatos" />
      </label>
      <Estado dados={dados} erro={erro} vazio={!!dados && lista.length === 0} limpar={() => { limparBusca(); setQ(''); }} />
      <div className="grade-areas">
        {areas.map(([area, contatos]) => (
          <section className="cartao-area" key={area} aria-labelledby={`area-${area}`}>
            <h2 id={`area-${area}`}><span className="mini-ico"><Icone nome="pessoas" tamanho={18} /></span>{area}</h2>
            <ul>
              {contatos.map((c) => <li key={c.id}><b>{c.nome}</b><Canal canal={c.canal} />
                {c.ramal && <span className="canal"><Icone nome="telefone" tamanho={14} /> Ramal {c.ramal}</span>}
                {c.celular && <a className="canal" href={`tel:${c.celular.replace(/[^+\d]/g, '')}`}><Icone nome="celular" tamanho={14} /> {c.celular}</a>}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
