import { confirmar } from '../Confirmar.tsx';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';
import { useLista } from '../dados';
import { JanelaForm, Selo } from './Crud';
import { NOME_TIPO, TIPOS_DATA, type DataLocal, type TipoData } from '../calendarioTipos';
import { DicaAba } from '../Dica';
import { useOrdenacao } from './Ordenar';

interface Agendas { conectado: boolean; exibir: string[]; disponiveis: string[]; erro?: string }
const br = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
type Form = { id?: number; titulo: string; data: string; data_fim: string; tipo: TipoData; anual: boolean };

/** Configurações › Calendário: datas e feriados da empresa e quais agendas do Zimbra aparecem no calendário. */
export function CalendarioConfig({ permissoes }: { permissoes: string[] }) {
  const edita = permissoes.includes('calendario.criar'), exclui = permissoes.includes('calendario.excluir'), escolheAgendas = permissoes.includes('calendario.agendas');
  const { dados, erro, recarregar } = useLista<DataLocal>('/api/gestao/calendario/datas');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [ag, setAg] = useState<Agendas | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [falhaAg, setFalhaAg] = useState('');

  const carregarAgendas = useCallback(() => {
    api<Agendas>('/api/gestao/calendario/agendas').then((r) => { setAg(r); setMarcadas(r.exibir); setFalhaAg(r.erro ?? ''); }).catch((e: Error) => setFalhaAg(e.message));
  }, []);
  useEffect(() => { carregarAgendas(); }, [carregarAgendas]);

  const daqui = (dados ?? []).filter((d) => (d.anual ? true : d.data.slice(0, 4) === String(ano) || (d.data_fim ?? '').slice(0, 4) === String(ano)))
    .map((d) => ({ ...d, mostrada: d.anual ? `${ano}${d.data.slice(4)}` : d.data }))
    .sort((a, b) => a.mostrada.localeCompare(b.mostrada));
  const ord = useOrdenacao(daqui, { data: (d) => d.mostrada, titulo: (d) => d.titulo, tipo: (d) => NOME_TIPO[d.tipo], repete: (d) => (d.anual ? 'Todo ano' : `Só em ${d.data.slice(0, 4)}`) });

  const gerar = async () => {
    setAviso('');
    try { const r = await api<{ novos: number }>('/api/gestao/calendario/feriados', { ano }); setAviso(r.novos ? `${r.novos} data(s) de ${ano} adicionada(s). Edite ou exclua o que a empresa não observa.` : `Os feriados de ${ano} já estão cadastrados.`); recarregar(); }
    catch (e) { setAviso((e as Error).message); }
  };
  const excluir = async (d: DataLocal) => {
    if (!(await confirmar({ titulo: 'Excluir data', mensagem: `Excluir "${d.titulo}"?`, confirmar: 'Excluir', perigo: true }))) return;
    try { await api(`/api/gestao/calendario/datas/${d.id}`, undefined, 'DELETE'); recarregar(); } catch (e) { setAviso((e as Error).message); }
  };
  const salvarAgendas = async () => {
    setAviso('');
    try { await api('/api/gestao/calendario/agendas', { exibir: marcadas }, 'PUT'); setAviso('Agendas exibidas atualizadas.'); carregarAgendas(); } catch (e) { setAviso((e as Error).message); }
  };
  const mudou = ag ? JSON.stringify([...marcadas].sort()) !== JSON.stringify([...ag.exibir].sort()) : false;

  return (
    <section className="calcfg">
      <DicaAba>Tudo o que for cadastrado aqui aparece no <b>Calendário</b> de quem tem acesso à tela. Feriados fixos repetem todo ano; Carnaval, Sexta-feira Santa e Corpus Christi mudam de data, por isso o botão gera ano a ano.</DicaAba>
      {aviso && <p className="ok" role="status" style={{ margin: 0 }}>{aviso}</p>}

      <div className="calcfg-card">
        <div className="calcfg-cab">
          <div><h3>Agendas do Zimbra exibidas</h3><small className="suave">Escolha de quais agendas os compromissos aparecem no calendário (até 12).</small></div>
          {escolheAgendas && ag?.conectado && <button className="btn" disabled={!mudou} onClick={() => void salvarAgendas()}>Salvar agendas</button>}
        </div>
        {ag && !ag.conectado && <p className="suave" style={{ margin: 0 }}>O Zimbra ainda não está conectado (Configurações › Integrações). Depois de conectar, as agendas aparecem aqui.</p>}
        {falhaAg && <p className="erro" role="status" style={{ margin: 0 }}>{falhaAg}</p>}
        {ag?.conectado && (
          ag.disponiveis.length === 0 ? <p className="vazio">Nenhuma agenda encontrada na conta.</p> : (
            <div className="calcfg-agendas" role="group" aria-label="Agendas do Zimbra">
              {ag.disponiveis.map((a) => (
                <label key={a} className="calcfg-op"><input type="checkbox" disabled={!escolheAgendas} checked={marcadas.includes(a)} onChange={() => setMarcadas((m) => (m.includes(a) ? m.filter((x) => x !== a) : [...m, a]))} /><span>{a}</span></label>
              ))}
            </div>
          )
        )}
        {ag?.conectado && <small className="suave">{marcadas.length} de {ag.disponiveis.length} marcada(s). Agendas pessoais e de salas costumam ficar de fora.</small>}
      </div>

      <div className="calcfg-card">
        <div className="calcfg-cab">
          <div><h3>Datas e feriados da empresa</h3><small className="suave">Feriados, pontos facultativos e eventos que aparecem marcados para todos.</small></div>
          <div className="calcfg-ferram">
            <span className="calcfg-ano" role="group" aria-label="Ano">
              <button type="button" className="cal-nav" aria-label="Ano anterior" onClick={() => setAno((a) => Math.max(2000, a - 1))}><Icone nome="esq" tamanho={14} /></button>
              <b>{ano}</b>
              <button type="button" className="cal-nav" aria-label="Próximo ano" onClick={() => setAno((a) => Math.min(2100, a + 1))}><Icone nome="dir" tamanho={14} /></button>
            </span>
            {edita && <button className="btn btn-sec" onClick={() => void gerar()}>Gerar feriados de {ano}</button>}
            {edita && <button className="btn" onClick={() => setForm({ titulo: '', data: `${ano}-01-01`, data_fim: '', tipo: 'evento', anual: false })}><Icone nome="mais" tamanho={15} /> Nova data</button>}
          </div>
        </div>
        {erro && <p className="erro" role="alert" style={{ margin: 0 }}>{erro}</p>}
        {dados && (
          <div className="rolagem">
            <table className="dados">
              <thead><tr>{ord.cab('data', 'Data')}{ord.cab('titulo', 'Título')}{ord.cab('tipo', 'Tipo')}{ord.cab('repete', 'Repete')}{(edita || exclui) && <th className="col-acoes">Ações</th>}</tr></thead>
              <tbody>
                {daqui.length === 0 && <tr><td colSpan={5} className="vazio">Nada cadastrado em {ano}. {edita ? 'Use “Gerar feriados”.' : ''}</td></tr>}
                {(ord.linhas ?? []).map((d) => (
                  <tr key={d.id}>
                    <td data-rotulo="Data" className="nowrap">{br(d.mostrada)}{d.data_fim && !d.anual ? ` a ${br(d.data_fim)}` : ''}</td>
                    <td data-rotulo="Título">{d.titulo}</td>
                    <td data-rotulo="Tipo"><Selo texto={NOME_TIPO[d.tipo]} tom={d.tipo === 'evento' ? 'ok' : d.tipo === 'facultativo' ? 'aviso' : 'neutro'} /></td>
                    <td data-rotulo="Repete">{d.anual ? 'Todo ano' : 'Só em ' + d.data.slice(0, 4)}</td>
                    {(edita || exclui) && <td className="col-acoes">
                      {edita && <button className="btn btn-sec btn-pequeno" onClick={() => setForm({ id: d.id, titulo: d.titulo, data: d.data, data_fim: d.data_fim ?? '', tipo: d.tipo, anual: !!d.anual })}><Icone nome="editar" tamanho={13} /> Editar</button>}
                      {exclui && <button className="btn btn-sec btn-pequeno" onClick={() => void excluir(d)}>Excluir</button>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <JanelaForm titulo={form.id ? 'Editar data' : 'Nova data'} aoFechar={() => setForm(null)}
          aoEnviar={async () => {
            const corpo = { titulo: form.titulo, data: form.data, data_fim: form.data_fim || null, tipo: form.tipo, anual: form.anual };
            if (form.id) await api(`/api/gestao/calendario/datas/${form.id}`, corpo, 'PUT'); else await api('/api/gestao/calendario/datas', corpo);
            setForm(null); recarregar();
          }}>
          <label>Título *<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={100} minLength={2} required autoFocus /></label>
          <label>Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoData })}>{TIPOS_DATA.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <div className="grade2">
            <label>Data *<input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></label>
            <label>Até (se durar vários dias)<input type="date" value={form.data_fim} min={form.data} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></label>
          </div>
          <label className="linha"><input type="checkbox" checked={form.anual} onChange={(e) => setForm({ ...form, anual: e.target.checked })} />Repete todo ano nesta data (feriados fixos, aniversário da empresa)</label>
        </JanelaForm>
      )}
    </section>
  );
}
