import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { MESES_LONGOS } from './dados';
import { Icone } from './icones';
import { JanelaForm } from './gestao/Crud';
import { diasEntre, dois, isoDe, NOME_TIPO, TIPOS_DATA, type DataLocal, type TipoData } from './calendarioTipos';

interface EventoZ { id: string; titulo: string; inicio: string; fim: string; dia_inteiro: boolean; local: string; agenda: string }
interface Resposta { conectado: boolean; sem_agenda?: boolean; erro?: string; eventos: EventoZ[]; datas: (Omit<DataLocal, 'data_fim' | 'anual'> & { data_fim: string; anual: boolean })[] }
/** Item pronto para desenhar: vem das datas da empresa ou de uma agenda do Zimbra. */
interface Item { chave: string; camada: string; classe: string; titulo: string; hora: string; detalhe: string; dias: string[] }

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CLASSES_AGENDA = ['ag0', 'ag1', 'ag2', 'ag3'];
const CAMADAS_LS = 'portal-calendario-camadas';
const lerOcultas = (): string[] => { try { const v = JSON.parse(localStorage.getItem(CAMADAS_LS) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } };

/** Tela cheia do Calendário: feriados, facultativos, eventos da empresa e as agendas do Zimbra, com filtros por camada. */
export function CalendarioPagina({ podeConfigurar, irConfig, dia }: { podeConfigurar: boolean; irConfig: () => void; dia?: string }) {
  const hoje = new Date(), hojeIso = isoDe(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [sel, setSel] = useState(hojeIso);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [ocultas, setOcultas] = useState<string[]>(lerOcultas);
  const [novo, setNovo] = useState<{ titulo: string; data: string; data_fim: string; tipo: TipoData; anual: boolean } | null>(null);
  const [versao, setVersao] = useState(0);
  // Legendas/camadas: a pessoa escolhe quais ver (clicando em cada uma) e pode minimizar a faixa para dar mais espaço ao calendário; a escolha é lembrada.
  const [legendaAberta, setLegendaAberta] = useState(() => { try { return localStorage.getItem('calp-legenda') !== '0'; } catch { return true; } });
  const alternarLegenda = () => setLegendaAberta((a) => { try { localStorage.setItem('calp-legenda', a ? '0' : '1'); } catch { /* ignora */ } return !a; });

  // Vindo do calendário do menu (clique duplo ou "Abrir calendário"): abre já no mês e no dia escolhidos.
  useEffect(() => {
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) { setSel(dia); setRef({ ano: Number(dia.slice(0, 4)), mes: Number(dia.slice(5, 7)) - 1 }); }
  }, [dia]);
  useEffect(() => {
    let vivo = true; setFalhou(false);
    api<Resposta>(`/api/calendario?mes=${ref.ano}-${dois(ref.mes + 1)}`).then((r) => { if (vivo) setResp(r); }).catch(() => { if (vivo) { setResp(null); setFalhou(true); } });
    return () => { vivo = false; };
  }, [ref.ano, ref.mes, versao]);

  const agendas = useMemo(() => [...new Set((resp?.eventos ?? []).map((e) => e.agenda))].sort(), [resp]);
  const itens = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const d of resp?.datas ?? []) out.push({ chave: `d${d.id}`, camada: d.tipo, classe: `t-${d.tipo}`, titulo: d.titulo, hora: '', detalhe: NOME_TIPO[d.tipo], dias: diasEntre(d.data, d.data_fim) });
    for (const e of resp?.eventos ?? []) {
      const camada = `ag:${e.agenda}`, i = agendas.indexOf(e.agenda);
      out.push({ chave: `e${e.agenda}${e.id}${e.inicio}`, camada, classe: CLASSES_AGENDA[i % CLASSES_AGENDA.length], titulo: e.titulo, hora: e.dia_inteiro ? 'Dia todo' : e.inicio.slice(11, 16), detalhe: [e.agenda, e.local].filter(Boolean).join(' · '), dias: diasEntre(e.inicio, e.fim) });
    }
    return out;
  }, [resp, agendas]);
  const visiveis = itens.filter((i) => !ocultas.includes(i.camada));
  const porDia = useMemo(() => { const m = new Map<string, Item[]>(); for (const i of visiveis) for (const d of i.dias) m.set(d, [...(m.get(d) ?? []), i]); return m; }, [visiveis]);

  const camadas: [string, string, string][] = [
    ...TIPOS_DATA.map(([t, nome]) => [t, nome, `t-${t}`] as [string, string, string]),
    ...agendas.map((a, i) => [`ag:${a}`, `Agenda: ${a}`, CLASSES_AGENDA[i % CLASSES_AGENDA.length]] as [string, string, string]),
  ];
  const alternar = (c: string) => setOcultas((o) => { const n = o.includes(c) ? o.filter((x) => x !== c) : [...o, c]; try { localStorage.setItem(CAMADAS_LS, JSON.stringify(n)); } catch { /* sem armazenamento */ } return n; });

  const primeiro = new Date(ref.ano, ref.mes, 1).getDay(), total = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const mover = (d: -1 | 1) => setRef(({ ano, mes }) => { const n = new Date(ano, mes + d, 1); return { ano: n.getFullYear(), mes: n.getMonth() }; });
  const irHoje = () => { setRef({ ano: hoje.getFullYear(), mes: hoje.getMonth() }); setSel(hojeIso); };
  const doDia = porDia.get(sel) ?? [];
  const [sa, sm, sd] = sel.split('-').map(Number);
  const rotuloSel = `${NOME_DIA[new Date(sa, sm - 1, sd).getDay()]}, ${sd} de ${MESES_LONGOS[sm - 1].toLowerCase()} de ${sa}`;
  const proximas = useMemo(() => {
    const vistos = new Set<string>(), lista: { item: Item; dia: string }[] = [];
    for (const dia of [...porDia.keys()].sort()) { if (dia < hojeIso) continue; for (const item of porDia.get(dia)!) if (!vistos.has(item.chave)) { vistos.add(item.chave); lista.push({ item, dia }); } }
    return lista.slice(0, 5);
  }, [porDia, hojeIso]);

  return (
    <>
      <div className="calp-barra">
        <div className="calp-nav">
          <button className="cal-nav" onClick={() => mover(-1)} aria-label="Mês anterior"><Icone nome="esq" tamanho={16} /></button>
          <h2 aria-live="polite">{MESES_LONGOS[ref.mes]} {ref.ano}</h2>
          <button className="cal-nav" onClick={() => mover(1)} aria-label="Próximo mês"><Icone nome="dir" tamanho={16} /></button>
          <button className="btn btn-sec btn-pequeno" onClick={irHoje}>Hoje</button>
        </div>
        <div className="calp-legenda">
          <button type="button" className="btn btn-sec btn-pequeno calp-legenda-botao" aria-expanded={legendaAberta} onClick={alternarLegenda} title={legendaAberta ? 'Minimizar as legendas' : 'Mostrar as legendas e escolher o que ver'}>
            <Icone nome="chev" tamanho={13} classe={legendaAberta ? 'gira' : ''} /> Legendas{!legendaAberta && ocultas.length > 0 ? ` (${camadas.length - ocultas.filter((o) => camadas.some(([id]) => id === o)).length}/${camadas.length})` : ''}
          </button>
          {legendaAberta && (
            <div className="calp-filtros" role="group" aria-label="O que mostrar">
              {camadas.map(([id, nome, classe]) => (
                <button key={id} className={`calp-filtro ${classe}${ocultas.includes(id) ? ' off' : ''}`} aria-pressed={!ocultas.includes(id)} onClick={() => alternar(id)}><i aria-hidden="true" />{nome}</button>
              ))}
            </div>
          )}
        </div>
        <div className="cal-acoes">
          {podeConfigurar && <button className="btn btn-sec btn-pequeno" onClick={irConfig}><Icone nome="editar" tamanho={13} /> Configurar</button>}
          {podeConfigurar && <button className="btn btn-pequeno" onClick={() => setNovo({ titulo: '', data: sel, data_fim: '', tipo: 'evento', anual: false })}><Icone nome="mais" tamanho={13} /> Data importante</button>}
        </div>
      </div>
      <div className="calp">
        <section className="calp-mes" aria-label="Calendário do mês">
          <div className="calp-grade" role="grid" aria-label={`${MESES_LONGOS[ref.mes]} de ${ref.ano}`}>
            {SEMANA.map((s) => <span key={s} className="calp-sem" role="columnheader">{s}</span>)}
            {celulas.map((d, i) => {
              if (!d) return <span key={i} className="calp-vazio" />;
              const dia = isoDe(ref.ano, ref.mes, d), lista = porDia.get(dia) ?? [], fimSemana = [0, 6].includes((primeiro + d - 1) % 7);
              return (
                <button key={i} role="gridcell" className={`calp-dia${dia === hojeIso ? ' hoje' : ''}${dia === sel ? ' sel' : ''}${fimSemana ? ' fds' : ''}`} aria-pressed={dia === sel} onClick={() => setSel(dia)}
                  aria-label={`${d} de ${MESES_LONGOS[ref.mes].toLowerCase()}${lista.length ? `, ${lista.length} ${lista.length > 1 ? 'itens' : 'item'}` : ''}`}>
                  <b>{d}</b>
                  {lista.slice(0, 3).map((it) => <span key={it.chave} className={`calp-chip ${it.classe}`} title={it.titulo}>{it.titulo}</span>)}
                  {lista.length > 3 && <small className="suave">+{lista.length - 3}</small>}
                </button>
              );
            })}
          </div>
          {resp && !resp.conectado && <p className="suave calp-nota">As agendas do Zimbra ainda não estão conectadas; aparecem só feriados e datas da empresa.</p>}
          {resp?.sem_agenda && <p className="suave calp-nota">Nenhuma agenda do Zimbra foi escolhida para exibir. {podeConfigurar ? 'Escolha em Configurar.' : 'Peça ao administrador.'}</p>}
          {resp?.erro && <p className="erro" role="status">{resp.erro}</p>}
          {falhou && <p className="erro" role="alert">Não foi possível carregar o calendário.</p>}
        </section>
        <aside className="calp-lado" aria-label="Detalhes do dia">
          <h3>{rotuloSel}</h3>
          {doDia.length === 0 ? <p className="suave">Nada marcado neste dia.</p> : (
            <ul className="calp-lista">{doDia.map((it) => (
              <li key={it.chave} className={it.classe}><i aria-hidden="true" /><div><b>{it.titulo}</b><small className="suave">{[it.hora, it.detalhe].filter(Boolean).join(' · ')}</small></div></li>
            ))}</ul>
          )}
          <h3 className="calp-h3">Próximas datas</h3>
          {proximas.length === 0 ? <p className="suave">Nada nas próximas datas deste mês.</p> : (
            <ul className="calp-lista">{proximas.map(({ item, dia }) => (
              <li key={item.chave} className={item.classe}><i aria-hidden="true" /><div><button className="calp-link" onClick={() => setSel(dia)}>{item.titulo}</button><small className="suave">{dia.slice(8)}/{dia.slice(5, 7)} · {item.detalhe}</small></div></li>
            ))}</ul>
          )}
        </aside>
      </div>
      {novo && (
        <JanelaForm titulo="Nova data no calendário" rotuloEnviar="Cadastrar" aoFechar={() => setNovo(null)}
          aoEnviar={async () => { await api('/api/gestao/calendario/datas', { ...novo, data_fim: novo.data_fim || null }); setNovo(null); setVersao((v) => v + 1); }}>
          <label>Título *<input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={100} minLength={2} required autoFocus /></label>
          <label>Tipo<select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoData })}>{TIPOS_DATA.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <div className="grade2">
            <label>Data *<input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} required /></label>
            <label>Até (se durar vários dias)<input type="date" value={novo.data_fim} min={novo.data} onChange={(e) => setNovo({ ...novo, data_fim: e.target.value })} /></label>
          </div>
          <label className="linha"><input type="checkbox" checked={novo.anual} onChange={(e) => setNovo({ ...novo, anual: e.target.checked })} />Repete todo ano nesta data</label>
        </JanelaForm>
      )}
    </>
  );
}
