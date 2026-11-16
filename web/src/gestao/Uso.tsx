import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { dataCurta } from '../dados';
import { Icone } from '../icones';
import { DicaAba } from '../Dica';
import { useOrdenacao } from './Ordenar';

interface Resumo {
  dias: number; desde: string; cadastrados: number; ativos: number; semAcesso: number;
  serie: { dia: string; ativos: number; entradas: number; telas: number }[];
  horas: { hora: number; eventos: number }[];
  telas: { tela: string; acessos: number; pessoas: number }[];
  aparelhos: { aparelho: string; pessoas: number; eventos: number }[];
  departamentos: { id: number | null; nome: string; pessoas: number; ativos: number; eventos: number }[];
}
interface Pessoa {
  id: number; nome: string; login: string; perfil_nome: string; departamento_id: number | null; departamento: string | null; ultimo_acesso: string | null;
  entradas: number; telas: number; dias_ativos: number; aparelho: string | null; tela_preferida: string | null;
}
const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses']] as const;
const NOME_TELA: Record<string, string> = {
  inicio: 'Início', comunicados: 'Comunicados', documentos: 'Documentos', calendario: 'Calendário', pessoas: 'Contatos', ajuda: 'Ajuda',
  pesquisas: 'Pesquisas', perfil: 'Meu perfil', publicar: 'Publicar', configuracoes: 'Configurações',
};
const telaNome = (t: string | null) => (t ? NOME_TELA[t] ?? t : '—');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Barra horizontal simples (a cor vem do tema). */
function Barra({ valor, max, rotulo }: { valor: number; max: number; rotulo: string }) {
  return <span className="uso-barra" role="img" aria-label={rotulo}><i style={{ width: `${max > 0 ? Math.max(valor > 0 ? 3 : 0, (valor / max) * 100) : 0}%` }} /></span>;
}

/** Configurações › Uso do portal: adoção por dia, tela, horário, aparelho, departamento e por pessoa. */
export function UsoPortal() {
  const [dias, setDias] = useState(30);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [erro, setErro] = useState('');
  const [depto, setDepto] = useState('');
  const [busca, setBusca] = useState('');
  const [soSemAcesso, setSoSemAcesso] = useState(false);

  useEffect(() => {
    let vivo = true;
    setResumo(null); setPessoas(null); setErro('');
    api<Resumo>(`/api/gestao/uso/resumo?dias=${dias}`).then((r) => { if (vivo) setResumo(r); }).catch((e: Error) => { if (vivo) setErro(e.message); });
    api<{ pessoas: Pessoa[] }>(`/api/gestao/uso/pessoas?dias=${dias}`).then((r) => { if (vivo) setPessoas(r.pessoas); }).catch((e: Error) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, [dias]);

  const filtradas = useMemo(() => (pessoas ?? []).filter((p) =>
    (!depto || (depto === '0' ? p.departamento_id === null : String(p.departamento_id) === depto))
    && (!soSemAcesso || p.dias_ativos === 0)
    && (!busca.trim() || `${p.nome} ${p.login}`.toLowerCase().includes(busca.trim().toLowerCase()))), [pessoas, depto, soSemAcesso, busca]);
  const ord = useOrdenacao(filtradas, {
    nome: (p) => p.nome, depto: (p) => p.departamento, perfil: (p) => p.perfil_nome, acesso: (p) => p.ultimo_acesso,
    dias: (p) => p.dias_ativos, entradas: (p) => p.entradas, telas: (p) => p.telas, aparelho: (p) => p.aparelho, preferida: (p) => telaNome(p.tela_preferida),
  });

  const maxDia = Math.max(1, ...(resumo?.serie ?? []).map((d) => d.ativos));
  const maxHora = Math.max(1, ...(resumo?.horas ?? []).map((h) => h.eventos));
  const maxTela = Math.max(1, ...(resumo?.telas ?? []).map((t) => t.acessos));
  const eventosAp = (resumo?.aparelhos ?? []).reduce((s, a) => s + a.eventos, 0);

  return (
    <section className="crud uso-secao">
      <DicaAba>Mostra se o portal está sendo útil: quem entra, o que abre, quando e de qual aparelho, por pessoa e por departamento. O portal registra só data, tela aberta e tipo de aparelho (nada do que é digitado) e guarda 12 meses. Cada consulta da lista de pessoas fica na auditoria.</DicaAba>
      <div className="barra uso-barra-topo">
        <div className="abas abas-gestao" role="tablist" aria-label="Período">
          {PERIODOS.map(([n, nome]) => <button key={n} role="tab" aria-selected={dias === n} onClick={() => setDias(n)}>{nome}</button>)}
        </div>
        <p className="suave uso-aviso"><Icone nome="escudo" tamanho={14} /> Dados de uso identificam pessoas: use só para entender a adoção do portal.</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!resumo && !erro && <p className="vazio">Carregando…</p>}

      {resumo && (<>
        <div className="uso-kpis">
          <div className="uso-kpi"><small>Pessoas ativas</small><b>{resumo.ativos}<span> de {resumo.cadastrados}</span></b><small>{pct(resumo.ativos, resumo.cadastrados)}% dos usuários</small></div>
          <div className="uso-kpi"><small>Sem acesso no período</small><b>{resumo.semAcesso}</b><small>{pct(resumo.semAcesso, resumo.cadastrados)}% dos usuários</small></div>
          <div className="uso-kpi"><small>Entradas</small><b>{resumo.serie.reduce((s, d) => s + d.entradas, 0)}</b><small>logins no período</small></div>
          <div className="uso-kpi"><small>Telas abertas</small><b>{resumo.serie.reduce((s, d) => s + d.telas, 0)}</b><small>no período</small></div>
        </div>

        <div className="uso-linha-1">
          <section className="cartao-sec uso-cartao uso-dias">
            <h3>Pessoas ativas por dia</h3>
            <div className="uso-colunas" role="img" aria-label={`Pessoas ativas por dia, de ${dia(resumo.serie[0].dia)} a ${dia(resumo.serie[resumo.serie.length - 1].dia)}; pico de ${maxDia}.`}>
              {resumo.serie.map((d) => <i key={d.dia} title={`${dia(d.dia)}: ${d.ativos} pessoa(s), ${d.entradas} entrada(s)`} style={{ height: `${Math.max(d.ativos ? 4 : 1, (d.ativos / maxDia) * 100)}%` }} />)}
            </div>
            <div className="uso-eixo"><span>{dia(resumo.serie[0].dia)}</span><span>{dia(resumo.serie[resumo.serie.length - 1].dia)}</span></div>
          </section>

          <section className="cartao-sec uso-cartao">
            <h3>Telas mais usadas</h3>
            {resumo.telas.length === 0 && <p className="vazio">Sem registros ainda.</p>}
            <ul className="uso-lista">
              {resumo.telas.map((t) => (
                <li key={t.tela}><span>{telaNome(t.tela)}</span><Barra valor={t.acessos} max={maxTela} rotulo={`${telaNome(t.tela)}: ${t.acessos} acessos`} /><b>{t.acessos}</b><small className="suave">{t.pessoas} pess.</small></li>
              ))}
            </ul>
          </section>

          <section className="cartao-sec uso-cartao">
            <h3>Horário de uso</h3>
            <div className="uso-colunas uso-horas" role="img" aria-label="Uso por hora do dia">
              {resumo.horas.map((h) => <i key={h.hora} title={`${String(h.hora).padStart(2, '0')}h: ${h.eventos}`} style={{ height: `${Math.max(h.eventos ? 4 : 1, (h.eventos / maxHora) * 100)}%` }} />)}
            </div>
            <div className="uso-eixo"><span>0h</span><span>12h</span><span>23h</span></div>
            <h3 className="uso-sub">Aparelhos</h3>
            <ul className="uso-lista">
              {resumo.aparelhos.length === 0 && <li className="vazio">Sem registros ainda.</li>}
              {resumo.aparelhos.map((a) => (
                <li key={a.aparelho}><span>{a.aparelho === 'celular' ? 'Celular' : 'Computador'}</span><Barra valor={a.eventos} max={eventosAp} rotulo={`${a.aparelho}: ${pct(a.eventos, eventosAp)}%`} /><b>{pct(a.eventos, eventosAp)}%</b><small className="suave">{a.pessoas} pess.</small></li>
              ))}
            </ul>
          </section>

        </div>

        <div className="uso-linha-2">
          <section className="cartao-sec uso-cartao uso-deptos">
            <h3>Departamentos</h3>
            <div className="rolagem">
              <table className="dados">
                <thead><tr><th>Departamento</th><th>Pessoas</th><th>Ativas</th><th>Adoção</th></tr></thead>
                <tbody>
                  {resumo.departamentos.map((d) => (
                    <tr key={d.id ?? 'sem'}>
                      <td data-rotulo="Departamento">{d.nome}</td><td data-rotulo="Pessoas">{d.pessoas}</td><td data-rotulo="Ativas">{d.ativos}</td>
                      <td data-rotulo="Adoção" className="uso-adocao"><Barra valor={d.ativos} max={d.pessoas} rotulo={`${d.nome}: ${pct(d.ativos, d.pessoas)}%`} /> {pct(d.ativos, d.pessoas)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {pessoas ? (
        <section className="cartao-sec uso-cartao uso-pessoas">
          <h3>Por pessoa <small className="suave">({filtradas.length} de {pessoas.length})</small></h3>
          <div className="barra uso-filtros">
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa…" aria-label="Buscar pessoa" />
            <select value={depto} onChange={(e) => setDepto(e.target.value)} aria-label="Departamento">
              <option value="">Todos os departamentos</option>
              {resumo.departamentos.map((d) => <option key={d.id ?? 0} value={d.id ?? 0}>{d.nome}</option>)}
            </select>
            <label className="linha"><input type="checkbox" checked={soSemAcesso} onChange={(e) => setSoSemAcesso(e.target.checked)} />Só quem não acessou</label>
          </div>
          <div className="rolagem">
            <table className="dados">
              <thead><tr>{ord.cab('nome', 'Pessoa')}{ord.cab('depto', 'Departamento')}{ord.cab('acesso', 'Último acesso')}{ord.cab('dias', 'Dias ativos')}{ord.cab('entradas', 'Entradas')}{ord.cab('telas', 'Telas')}{ord.cab('aparelho', 'Aparelho')}{ord.cab('preferida', 'Tela preferida')}</tr></thead>
              <tbody>
                {(ord.linhas ?? []).map((p) => (
                  <tr key={p.id}>
                    <td data-rotulo="Pessoa" title={`${p.nome} (${p.login}) · ${p.perfil_nome}`}>{p.nome}</td>
                    <td data-rotulo="Departamento">{p.departamento ?? '—'}</td>
                    <td data-rotulo="Último acesso">{p.ultimo_acesso ? dataCurta(p.ultimo_acesso) : 'Nunca'}</td>
                    <td data-rotulo="Dias ativos">{p.dias_ativos}</td><td data-rotulo="Entradas">{p.entradas}</td><td data-rotulo="Telas">{p.telas}</td>
                    <td data-rotulo="Aparelho">{p.aparelho ? (p.aparelho === 'celular' ? 'Celular' : 'Computador') : '—'}</td>
                    <td data-rotulo="Tela preferida">{telaNome(p.tela_preferida)}</td>
                  </tr>
                ))}
                {filtradas.length === 0 && <tr><td colSpan={8} className="vazio">Ninguém corresponde ao filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
          ) : <section className="cartao-sec uso-cartao"><p className="vazio">Carregando…</p></section>}
        </div>
      </>)}

    </section>
  );
}
