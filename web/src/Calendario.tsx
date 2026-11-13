import { confirmar } from './Confirmar.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { MESES_LONGOS } from './dados';
import { Icone } from './icones';
import { JanelaForm } from './gestao/Crud';
import { NOME_TIPO, type TipoData } from './calendarioTipos';

interface Evento { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string; agenda?: string; tipo?: TipoData }
interface Resposta { conectado: boolean; sem_agenda?: boolean; erro?: string; eventos: Evento[]; datas?: { id: number; data: string; data_fim: string; titulo: string; tipo: TipoData }[] }
/** Classe de cor (ver .k-* no CSS): uma por tipo de data e uma por agenda do Zimbra, as mesmas cores da tela Calendário. */
const CLASSES_AGENDA = ['k-ag0', 'k-ag1', 'k-ag2', 'k-ag3'];

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
export function Calendario({ podeCriar = false, podeExcluir = false, abrirCalendario }: { podeCriar?: boolean; podeExcluir?: boolean; abrirCalendario?: (dia: string) => void }) {
  const hoje = new Date();
  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [sel, setSel] = useState(hojeIso);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [versao, setVersao] = useState(0);
  const [novo, setNovo] = useState<{ titulo: string; data: string; data_fim: string; dia_inteiro: boolean; hora_inicio: string; hora_fim: string; local: string } | null>(null);
  const [erroAcao, setErroAcao] = useState('');
  const [verLegenda, setVerLegenda] = useState(false);
  const caixa = useRef<HTMLElement>(null);
  // Em telas baixas (menos de 900 px) o calendário do menu começa recolhido, para não cobrir os itens do menu; a escolha da pessoa é lembrada.
  const [recolhido, setRecolhido] = useState(() => {
    try { const v = localStorage.getItem('cal-menu-recolhido'); if (v !== null) return v === '1'; } catch { /* sem armazenamento: usa o padrão */ }
    return window.innerHeight < 900;
  });
  const alternar = () => setRecolhido((r) => { try { localStorage.setItem('cal-menu-recolhido', r ? '0' : '1'); } catch { /* ignora */ } return !r; });
  // Painel lateral com os compromissos do dia: abre à direita do menu, por cima da tela (seta na borda do calendário).
  const [voo, setVooAberto] = useState(false);
  const [medida, setMedida] = useState<{ esq: number; base: number; alt: number; recuo: number } | null>(null);
  const painel = useRef<HTMLElement>(null);
  const casca = useRef<HTMLDivElement>(null);
  /** Mede o calendário em px de CSS (dentro do zoom da página): a aba e o painel ficam colados na borda do menu, alinhados ao calendário. */
  const medir = () => {
    const el = caixa.current, menu = el?.closest('.menu') as HTMLElement | null;
    if (!el || !menu) return;
    let topo = 0, esq = 0; for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) { topo += n.offsetTop; esq += n.offsetLeft; }
    topo -= menu.scrollTop;
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
    const m = { esq: menu.offsetWidth, base: Math.max(0, window.innerHeight / z - (topo + el.offsetHeight)), alt: el.offsetHeight, recuo: Math.max(0, Math.round(menu.offsetWidth - (esq + el.offsetWidth))) };
    setMedida((v) => (v && v.esq === m.esq && Math.abs(v.base - m.base) < 0.5 && v.alt === m.alt && v.recuo === m.recuo ? v : m));
  };
  useEffect(() => {
    medir();
    const el = caixa.current, menu = el?.closest('.menu');
    const ro = new ResizeObserver(medir);
    if (el) ro.observe(el);
    if (menu) ro.observe(menu);
    window.addEventListener('resize', medir);
    menu?.addEventListener('scroll', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); menu?.removeEventListener('scroll', medir); };
  }, [recolhido]);
  const alternarVoo = () => setVooAberto((v) => !v);
  useEffect(() => {
    if (!voo) return;
    const fora = (e: MouseEvent) => { const alvo = e.target as Node; if (!casca.current?.contains(alvo) && !caixa.current?.contains(alvo)) setVooAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setVooAberto(false); };
    const fechar = () => setVooAberto(false);
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc); window.addEventListener('resize', fechar);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('resize', fechar); };
  }, [voo]);
  // A legenda abre pelo "i" e fecha ao clicar fora, no "i" de novo ou com Esc.
  useEffect(() => {
    if (!verLegenda) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setVerLegenda(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setVerLegenda(false); };
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [verLegenda]);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    api<Resposta>(`/api/calendario?mes=${ref.ano}-${dois(ref.mes + 1)}`).then((r) => { if (vivo) setResp(r); }).catch(() => { if (vivo) { setResp(null); setFalhou(true); } });
    return () => { vivo = false; };
  }, [ref.ano, ref.mes, versao]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of resp?.eventos ?? []) for (const dia of diasDoEvento(e)) m.set(dia, [...(m.get(dia) ?? []), e]);
    // feriados e datas da empresa (cadastrados em Configurações › Calendário) entram como itens de dia inteiro
    for (const d of resp?.datas ?? []) { const e: Evento = { id: `d${d.id}`, titulo: d.titulo, inicio: d.data, fim: d.data_fim || d.data, dia_inteiro: true, local: '', tipo: d.tipo }; for (const dia of diasDoEvento(e)) m.set(dia, [...(m.get(dia) ?? []), e]); }
    return m;
  }, [resp]);

  const agendas = useMemo(() => [...new Set((resp?.eventos ?? []).map((e) => e.agenda ?? ''))].filter(Boolean).sort(), [resp]);
  const classe = (e: Evento) => (e.tipo ? `k-${e.tipo}` : CLASSES_AGENDA[Math.max(0, agendas.indexOf(e.agenda ?? '')) % CLASSES_AGENDA.length]);
  const quem = (e: Evento) => (e.tipo ? NOME_TIPO[e.tipo] : e.agenda ?? 'Agenda');
  /** Próximas 3 datas a partir de hoje (neste mês), para quando o dia escolhido está vazio. */
  const proximas = useMemo(() => {
    const vistos = new Set<string>(), out: { e: Evento; dia: string }[] = [];
    for (const dia of [...porDia.keys()].sort()) { if (dia < hojeIso) continue; for (const e of porDia.get(dia)!) { const k = `${e.id}${e.inicio}`; if (!vistos.has(k)) { vistos.add(k); out.push({ e, dia }); } } }
    return out.slice(0, 3);
  }, [porDia, hojeIso]);
  /** Legenda: só o que existe no mês mostrado (tipos de data e agendas), com a cor de cada um. */
  const legenda = useMemo(() => { const m = new Map<string, string>(); for (const lista of porDia.values()) for (const e of lista) m.set(classe(e), quem(e)); return [...m]; }, [porDia, agendas]); // eslint-disable-line react-hooks/exhaustive-deps
  const primeiro = new Date(ref.ano, ref.mes, 1).getDay();
  const total = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  const mover = (d: -1 | 1) => setRef(({ ano, mes }) => { const n = new Date(ano, mes + d, 1); return { ano: n.getFullYear(), mes: n.getMonth() }; });
  const doDia = porDia.get(sel) ?? [];
  const [sa, sm, sd] = sel.split('-').map(Number);
  const rotuloSel = `${NOME_DIA[new Date(sa, sm - 1, sd).getDay()]}, ${sd} de ${MESES_LONGOS[sm - 1].toLowerCase()}`;
  const excluir = async (e: Evento) => {
    if (!(await confirmar({ titulo: 'Excluir data', mensagem: `Excluir a data importante "${e.titulo}"?`, confirmar: 'Excluir', perigo: true }))) return;
    setErroAcao('');
    try { await api(`/api/calendario/${encodeURIComponent(e.id)}`, undefined, 'DELETE'); setVersao((v) => v + 1); }
    catch (x) { setErroAcao((x as Error).message); }
  };
  const hora = (e: Evento) => (e.dia_inteiro ? 'Dia todo' : e.inicio.slice(11, 16));

  return (
    <section className="cal-menu" aria-label="Calendário de datas importantes" ref={caixa}>
      <div className="cal-corpo">
      <div className="cal-topo">
        <button className="cal-nav" onClick={() => mover(-1)} aria-label="Mês anterior"><Icone nome="esq" tamanho={14} /></button>
        <b aria-live="polite">{MESES_LONGOS[ref.mes]} {ref.ano}
          {legenda.length > 0 && <button type="button" className="cal-info" aria-expanded={verLegenda} aria-label="O que significam as cores" title="O que significam as cores" onClick={() => setVerLegenda((v) => !v)}><Icone nome="info" tamanho={12} /></button>}
        </b>
        <button className="cal-nav" onClick={() => mover(1)} aria-label="Próximo mês"><Icone nome="dir" tamanho={14} /></button>
        <button type="button" className="cal-nav cal-recolher" onClick={alternar} aria-expanded={!recolhido} aria-label={recolhido ? 'Mostrar o calendário' : 'Recolher o calendário'} title={recolhido ? 'Mostrar o calendário' : 'Recolher o calendário'}><Icone nome="chev" tamanho={14} classe={recolhido ? '' : 'gira'} /></button>
      </div>
      {!recolhido && <>
      {verLegenda && <div className="cal-legenda" role="dialog" aria-label="Legenda das cores">{legenda.map(([c, nome]) => <span key={c} className={c}><i aria-hidden="true" />{nome}</span>)}</div>}
      <div className="cal-grade" role="grid" aria-label={`${MESES_LONGOS[ref.mes]} de ${ref.ano}`}>
        {SEMANA.map((s, i) => <span key={i} className="cal-sem" role="columnheader">{s}</span>)}
        {celulas.map((d, i) => {
          if (!d) return <span key={i} className="cal-vazio" />;
          const dia = iso(ref.ano, ref.mes, d), lista = porDia.get(dia) ?? [], n = lista.length;
          const cores = [...new Set(lista.map(classe))].slice(0, 3);
          return (
            <button key={i} role="gridcell" className={`cal-dia${dia === hojeIso ? ' hoje' : ''}${dia === sel ? ' sel' : ''}${n ? ' tem' : ''}`}
              title={n ? lista.slice(0, 4).map((e) => e.titulo).join('\n') + (n > 4 ? `\n+ ${n - 4}` : '') : undefined}
              aria-label={`${d} de ${MESES_LONGOS[ref.mes].toLowerCase()}${n ? `, ${n} ${n > 1 ? 'datas importantes' : 'data importante'}` : ''}`}
              aria-pressed={dia === sel} onClick={() => { setSel(dia); setVooAberto(true); }}>
              {d}
              {n > 0 && <span className="cal-pontos" aria-hidden="true">{cores.map((c) => <i key={c} className={c} />)}</span>}
            </button>
          );
        })}
      </div>
      </>}
      </div>
      {!recolhido && medida && createPortal(
        <div className={`cal-voo-casca${voo ? ' aberta' : ''}`} ref={casca} style={{ left: medida.esq, bottom: medida.base, minHeight: medida.alt }}>
          <button type="button" className="cal-voo-btn" style={voo ? undefined : { left: -medida.recuo, right: 'auto' }} onClick={alternarVoo} aria-expanded={voo} aria-label={voo ? 'Recolher os compromissos do dia' : 'Ver os compromissos do dia'} title={voo ? 'Recolher os compromissos' : 'Ver os compromissos do dia'}><Icone nome={voo ? 'esq' : 'dir'} tamanho={14} /></button>
          {voo && <aside className="cal-voo" ref={painel} aria-label={`Compromissos de ${rotuloSel}`}>
      <div className="cal-voo-lista" aria-live="polite">
        <div className="cal-voo-topo"><b className="cal-data">{rotuloSel}</b><button type="button" className="cal-nav" onClick={() => setVooAberto(false)} aria-label="Recolher os compromissos"><Icone nome="esq" tamanho={14} /></button></div>
        {resp && !resp.conectado && !porDia.size && <p className="cal-aviso">Agenda ainda não conectada ao Zimbra.</p>}
        {resp?.sem_agenda && !porDia.size && <p className="cal-aviso">Nenhuma agenda escolhida ainda. O administrador define em Configurações › Calendário.</p>}
        {resp?.erro && <p className="cal-aviso">{resp.erro}</p>}
        {falhou && <p className="cal-aviso">Não foi possível carregar o calendário.</p>}
        {doDia.length === 0 && (resp?.conectado ? !resp.sem_agenda && !resp.erro : !!resp) && <p className="cal-aviso">Nenhuma data importante.</p>}
        <ul>
          {doDia.map((e) => (
            <li key={`${e.id}${e.inicio}`} className={classe(e)} title={[e.titulo, quem(e), e.local].filter(Boolean).join(' · ')}><i aria-hidden="true" /><div><span>{hora(e)}</span> {e.titulo}<small>{quem(e)}</small></div></li>
          ))}
        </ul>
                {doDia.length === 0 && proximas.length > 0 && (
          <div className="cal-prox">
            <small className="cal-data">Próximas datas</small>
            <ul>{proximas.map(({ e, dia }) => (
              <li key={`${e.id}${e.inicio}`} className={classe(e)}><i aria-hidden="true" /><div><button type="button" onClick={() => setSel(dia)}>{e.titulo}</button><small>{dia.slice(8)}/{dia.slice(5, 7)} · {quem(e)}</small></div></li>
            ))}</ul>
          </div>
        )}
        {erroAcao && <p className="cal-aviso" role="alert">{erroAcao}</p>}
        {podeCriar && resp?.conectado && !resp.sem_agenda && <button type="button" className="cal-novo" onClick={() => setNovo({ titulo: '', data: sel, data_fim: '', dia_inteiro: true, hora_inicio: '09:00', hora_fim: '10:00', local: '' })}>+ Data importante</button>}
        {abrirCalendario && <button type="button" className="cal-voo-abrir" onClick={() => { setVooAberto(false); abrirCalendario(sel); }}>Abrir calendário completo</button>}
        </div>
          </aside>}
        </div>, document.body)}
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
