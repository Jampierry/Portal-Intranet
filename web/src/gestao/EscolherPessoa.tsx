import { BotaoLimpar } from '../BotaoLimpar';
import { useEffect, useId, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { semAcentoBusca } from './Filtros';

export interface PessoaPortal { id: number; nome: string; login: string; email: string; departamento: string }
let cache: { ate: number; itens: PessoaPortal[] } | null = null;

/** Campo de apoio dos formulários de Destaque, Aniversariantes, Novos colaboradores e Contatos: procura uma pessoa com cadastro no portal
 *  (as que vieram do Keycloak entram em Configurações › Usuários) e devolve os dados para preencher o formulário. Tudo continua editável. */
export function EscolherPessoa({ aoEscolher, dica }: { aoEscolher: (p: PessoaPortal) => void; dica?: string }) {
  const [itens, setItens] = useState<PessoaPortal[] | null>(null);
  const [erro, setErro] = useState('');
  const [q, setQ] = useState('');
  const [escolhida, setEscolhida] = useState<PessoaPortal | null>(null);
  const idLista = useId();
  useEffect(() => {
    if (cache && cache.ate > Date.now()) { setItens(cache.itens); return; }
    api<PessoaPortal[]>('/api/gestao/pessoas-portal').then((r) => { cache = { ate: Date.now() + 60_000, itens: r }; setItens(r); }).catch((e: Error) => setErro(e.message));
  }, []);
  const alvo = semAcentoBusca(q.trim());
  const achadas = alvo && itens ? itens.filter((p) => semAcentoBusca(`${p.nome} ${p.login} ${p.email} ${p.departamento}`).includes(alvo)).slice(0, 30) : [];
  return (
    <div className="escolher-pessoa">
      <label>Preencher com uma pessoa do portal (opcional)
        <span className="busca-pagina"><Icone nome="busca" tamanho={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={itens ? `Nome, login ou e-mail (${itens.length} pessoas)` : 'Carregando pessoas…'} aria-controls={idLista} autoComplete="off" disabled={!itens} />{q && <BotaoLimpar aoLimpar={() => setQ('')} />}
        </span>
      </label>
      {dica && <small className="suave">{dica}</small>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {escolhida && !alvo && <small className="ok" role="status">Preenchido com os dados de {escolhida.nome}. Ajuste o que for preciso.</small>}
      {alvo && (
        <ul id={idLista} className="escolher-pessoa-lista" role="listbox" aria-label="Pessoas encontradas">
          {achadas.length === 0 && <li className="suave">Ninguém encontrado. Quem ainda não tem cadastro entra em Configurações › Usuários › Sem cadastro.</li>}
          {achadas.map((p) => (
            <li key={p.id} role="option" aria-selected={escolhida?.id === p.id}>
              <button type="button" onClick={() => { setEscolhida(p); setQ(''); aoEscolher(p); }}>
                <b>{p.nome}</b><small className="suave">{[p.departamento, p.email || p.login].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
