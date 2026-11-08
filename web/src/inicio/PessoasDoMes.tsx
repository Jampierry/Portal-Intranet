import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { MESES_LONGOS, dataCurta } from '../dados';

interface Aniv { nome: string; area: string; dia: number; mes: number; foto: string | null; iniciais: string; hoje: boolean }
interface Novo { nome: string; area: string; funcao: string | null; entrada: string; mensagem: string | null; foto: string | null; iniciais: string }
interface Resposta { mes: number; aniversariantes: Aniv[]; novos: Novo[] }

function Avatar({ foto, iniciais }: { foto: string | null; iniciais: string }) {
  return <span className="pm-avatar" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais}</span>;
}

/** Início: aniversariantes do mês e novos colaboradores (cadastrados pelo RH em Publicar). Só mostra o cartão se houver alguém autorizado. */
export function PessoasDoMes() {
  const [r, setR] = useState<Resposta | null>(null);
  useEffect(() => { api<Resposta>('/api/pessoas-do-mes').then(setR).catch(() => setR(null)); }, []);
  if (!r || (r.aniversariantes.length === 0 && r.novos.length === 0)) return null;
  const mes = MESES_LONGOS[r.mes - 1].toLowerCase();
  return (
    <section className="cartao-sec pessoas-mes" aria-label="Pessoas do mês">
      {r.aniversariantes.length > 0 && (
        <div className="pm-col">
          <div className="sec-topo"><h2><Icone nome="calendario" tamanho={22} /> Aniversariantes de {mes}</h2></div>
          <ul className="pm-lista">
            {r.aniversariantes.map((a) => (
              <li key={`${a.nome}|${a.dia}`} className={a.hoje ? 'pm-hoje' : undefined}>
                <Avatar foto={a.foto} iniciais={a.iniciais} />
                <div><b title={a.nome}>{a.nome}</b><small>{a.area}</small></div>
                <span className="pm-data">{a.hoje ? 'Hoje' : `${a.dia} ${mes.slice(0, 3)}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.novos.length > 0 && (
        <div className="pm-col">
          <div className="sec-topo"><h2><Icone nome="pessoas" tamanho={22} /> Novos colaboradores</h2></div>
          <ul className="pm-lista">
            {r.novos.map((n) => (
              <li key={`${n.nome}|${n.entrada}`}>
                <Avatar foto={n.foto} iniciais={n.iniciais} />
                <div><b title={n.nome}>{n.nome}</b><small>{[n.funcao, n.area].filter(Boolean).join(' · ')}</small>{n.mensagem && <em>{n.mensagem}</em>}</div>
                <span className="pm-data" title="Data de entrada">{dataCurta(n.entrada)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
