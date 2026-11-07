import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { MESES_LONGOS } from './dados';
import { Icone } from './icones';
import { JanelaForm } from './gestao/Crud';

interface Evento { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string }
interface Resposta { conectado: boolean; sem_agenda?: boolean; erro?: string; eventos: Evento[] }

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dois = (n: number) => String(n).padStart(2, '0');
const iso = (a: number, m: number, d: number) => `${a}-${dois(m + 1)}-${dois(d)}`;

/** Todos os dias (AAAA-MM-DD) que o evento cobre, limitados a 62 para não travar com eventos enormes. */
function diasDoEvento(e: Evento): string[] {
  const ini = e.inicio.slice(0, 10), fim = (e.fim || e.inicio).slice(0, 10);
  const saida: string[] = [];
  const d = new Date(`${ini}T12:00:00`);
  for (let i = 0; i < 62; i++) {
    const s = iso(d.getFullYear(), d.getMonth(), d.getDate());
    if (s > fim) break;
    saida.push(s); d.setDate(d.getDate() + 1);
  }
  return saida.length ? saida : [ini];
}

/** Calendário do menu: marca as datas importantes vindas da agenda da empresa (Zimbra, via servidor do portal). */
export function Calendario({ podeCriar = false, podeExcluir = false }: { podeCriar?: boolean; podeExcluir?: boolean }) {
  const hoje = new Date();
  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [sel, setSel] = useState(hojeIso);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState<{ titulo: string; data: string; data_fim: string; dia_inteiro: boolean; hora_inicio: string; hora_fim: string; local: string } | null>(null);
  const [erroAcao, setErroAcao] = useState('');

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    api<Resposta>(`/api/calendario?mes=${ref.ano}-${dois(ref.mes + 1)}`).then((r) => { if (vivo) setResp(r); }).catch(() => { if (vivo) { setResp(null); setFalhou(true); } });
    return () => { vivo = false; };
  }, [ref.ano, ref.mes, versao]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of resp?.eventos ?? []) for (const dia of diasDoEvento(e)) m.set(dia, [...(m.get(dia) ?? []), e]);
    return m;
  }, [resp]);

  const primeiro = new Date(ref.ano, ref.mes, 1).getDay();
  const total = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  const mover = (d: -1 | 1) => setRef(({ ano, mes }) => { const n = new Date(ano, mes + d, 1); return { ano: n.getFullYear(), mes: n.getMonth() }; });
  const doDia = porDia.get(sel) ?? [];
  const [sa, sm, sd] = sel.split('-').map(Number);
  const rotuloSel = `${NOME_DIA[new Date(sa, sm - 1, sd).getDay()]}, ${sd} de ${MESES_LONGOS[sm - 1].toLowerCase()}`;
  const excluir = async (e: Evento) => {
    if (!window.confirm(`Excluir a data importante "${e.titulo}"?`)) return;
    setErroAcao('');
    try { await api(`/api/calendario/${encodeURIComponent(e.id)}`, undefined, 'DELETE'); setVersao((v) => v + 1); }
    catch (x) { setErroAcao((x as Error).message); }
  };
  const hora = (e: Evento) => (e.dia_inteiro ? 'Dia todo' : e.inicio.slice(11, 16));

  return (
    <section className="cal-menu" aria-label="Calendário de datas importantes">
      <div className="cal-topo">
        <button className="cal-nav" onClick={() => mover(-1)} aria-label="Mês anterior"><Icone nome="esq" tamanho={14} /></button>
        <b aria-live="polite">{MESES_LONGOS[ref.mes]} {ref.ano}</b>
        <button className="cal-nav" onClick={() => mover(1)} aria-label="Próximo mês"><Icone nome="dir" tamanho={14} /></button>
      </div>
      <div className="cal-grade" role="grid" aria-label={`${MESES_LONGOS[ref.mes]} de ${ref.ano}`}>
        {SEMANA.map((s, i) => <span key={i} className="cal-sem" role="columnheader">{s}</span>)}
        {celulas.map((d, i) => {
          if (!d) return <span key={i} className="cal-vazio" />;
          const dia = iso(ref.ano, ref.mes, d), n = porDia.get(dia)?.length ?? 0;
          return (
            <button key={i} role="gridcell" className={`cal-dia${dia === hojeIso ? ' hoje' : ''}${dia === sel ? ' sel' : ''}${n ? ' tem' : ''}`}
              aria-label={`${d} de ${MESES_LONGOS[ref.mes].toLowerCase()}${n ? `, ${n} ${n > 1 ? 'datas importantes' : 'data importante'}` : ''}`}
              aria-pressed={dia === sel} onClick={() => setSel(dia)}>{d}</button>
          );
        })}
      </div>
      <div className="cal-lista" aria-live="polite">
        <small className="cal-data">{rotuloSel}</small>
        {resp && !resp.conectado && <p className="cal-aviso">Agenda ainda não conectada ao Zimbra.</p>}
        {resp?.sem_agenda && <p className="cal-aviso">Nenhuma agenda escolhida ainda. O administrador define em Configurações › Integrações.</p>}
        {resp?.erro && <p className="cal-aviso">{resp.erro}</p>}
        {falhou && <p className="cal-aviso">Não foi possível carregar o calendário.</p>}
        {resp?.conectado && !resp.sem_agenda && !resp.erro && doDia.length === 0 && <p className="cal-aviso">Nenhuma data importante.</p>}
        <ul>
          {doDia.slice(0, 4).map((e) => (
            <li key={`${e.id}${e.inicio}`} title={e.local ? `${e.titulo} · ${e.local}` : e.titulo}><span>{hora(e)}</span> {e.titulo}
              {podeExcluir && <button type="button" className="cal-x" onClick={() => void excluir(e)} aria-label={`Excluir ${e.titulo}`} title="Excluir">×</button>}</li>
          ))}
        </ul>
        {doDia.length > 4 && <small className="cal-aviso">+ {doDia.length - 4} outras</small>}
        {erroAcao && <p className="cal-aviso" role="alert">{erroAcao}</p>}
        {podeCriar && resp?.conectado && !resp.sem_agenda && <button type="button" className="cal-novo" onClick={() => setNovo({ titulo: '', data: sel, data_fim: '', dia_inteiro: true, hora_inicio: '09:00', hora_fim: '10:00', local: '' })}>+ Data importante</button>}
      </div>
      {novo && (
        <JanelaForm titulo="Nova data importante" rotuloEnviar="Cadastrar" aoFechar={() => setNovo(null)}
          aoEnviar={async () => {
            await api('/api/calendario', { titulo: novo.titulo, data: novo.data, data_fim: novo.data_fim || novo.data, dia_inteiro: novo.dia_inteiro, hora_inicio: novo.hora_inicio, hora_fim: novo.hora_fim, local: novo.local });
            setNovo(null); setVersao((v) => v + 1);
          }}>
          <label>Título *<input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={100} minLength={2} required autoFocus /></label>
          <div className="grade2">
            <label>Data *<input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} required /></label>
            <label>Até (se durar vários dias)<input type="date" value={novo.data_fim} min={novo.data} onChange={(e) => setNovo({ ...novo, data_fim: e.target.value })} /></label>
          </div>
          <label className="linha"><input type="checkbox" checked={novo.dia_inteiro} onChange={(e) => setNovo({ ...novo, dia_inteiro: e.target.checked })} />Dia inteiro</label>
          {!novo.dia_inteiro && <div className="grade2">
            <label>Início<input type="time" value={novo.hora_inicio} onChange={(e) => setNovo({ ...novo, hora_inicio: e.target.value })} required /></label>
            <label>Fim<input type="time" value={novo.hora_fim} onChange={(e) => setNovo({ ...novo, hora_fim: e.target.value })} required /></label>
          </div>}
          <label>Local (opcional)<input value={novo.local} onChange={(e) => setNovo({ ...novo, local: e.target.value })} maxLength={100} /></label>
          <small className="suave">A data é criada na agenda da empresa no Zimbra e aparece para todos.</small>
        </JanelaForm>
      )}
    </section>
  );
}
