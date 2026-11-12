import { useEffect, useState } from 'react';
import { api } from '../api';
import { avisar, confirmar } from '../Confirmar';
import { JanelaForm, Selo, usePermissoes } from './Crud';
import { dataCurta } from '../dados';
import { ListaAnexos, type Anexo } from './Anexos';
import { DetalhePedido } from './DetalhePedido';

type TipoPedido = 'comunicado' | 'rede_social' | 'banner' | 'documento';
const NOME_TIPO: Record<TipoPedido, string> = { comunicado: 'Comunicado', rede_social: 'Rede social', banner: 'Banner', documento: 'Documento' };
interface Previa { [campo: string]: unknown; anexos?: Anexo[]; tipo: TipoPedido; subtitulo?: string | null; botao_texto?: string | null; posicao?: string; formato?: string; versao?: string | null; classificacao?: string; link_oficial?: string | null; resumo?: string; corpo?: string | null; categoria?: string; prioridade?: string; imagem?: string | null; plataforma_nome?: string; legenda?: string | null; link?: string | null; data_prevista?: string | null }
interface Pedido { id: number; tipo: TipoPedido; titulo: string; detalhe: string | null; solicitante: string; status: string; motivo: string | null; decisor: string | null; decidido_em: string | null; criado_em: string; previa: Previa | null }
const SIT: Record<string, ['ok' | 'aviso' | 'neutro' | 'erro', string]> = { pendente: ['aviso', 'Aguardando decisão'], aprovado: ['ok', 'Aprovado'], rejeitado: ['erro', 'Rejeitado'] };

function Rejeitar({ p, aoFechar, aoConcluir }: { p: Pedido; aoFechar: () => void; aoConcluir: () => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <JanelaForm titulo="Rejeitar publicação" rotuloEnviar="Rejeitar e avisar" aoFechar={aoFechar}
      aoEnviar={async () => { await api(`/api/aprovacoes/${p.id}/decidir`, { aprovar: false, motivo }); aoConcluir(); }}>
      <p style={{ marginTop: 0 }}>«<b>{p.titulo}</b>», enviado por {p.solicitante}.</p>
      <label>Motivo da rejeição *<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} minLength={3} maxLength={500} required placeholder="Explique o que precisa mudar. A pessoa recebe esta mensagem." /></label>
    </JanelaForm>
  );
}

/** Publicar › Aprovações (RH): fila de comunicados do portal e publicações para redes sociais que esperam decisão, com histórico. */
export function Aprovacoes() {
  const perms = usePermissoes();
  const decide = perms === null || perms.includes('pub.aprovacoes.decidir');
  const [ver, setVer] = useState<'pendentes' | 'historico'>('pendentes');
  const [lista, setLista] = useState<Pedido[] | null>(null);
  const [erro, setErro] = useState('');
  const [rejeitando, setRejeitando] = useState<Pedido | null>(null);
  const [lendo, setLendo] = useState<Pedido | null>(null);
  const carregar = () => api<Pedido[]>(`/api/aprovacoes?situacao=${ver}`).then((r) => { setLista(r); setErro(''); }).catch((e: Error) => setErro(e.message));
  useEffect(() => { setLista(null); void carregar(); }, [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const aviso = () => window.dispatchEvent(new Event('aprovacoes')); // atualiza o sino
  const aprovar = async (p: Pedido) => {
    const onde = p.tipo === 'comunicado' ? 'O comunicado sobe no portal agora e todos são avisados.' : p.tipo === 'banner' ? 'O banner passa a aparecer no Início.' : p.tipo === 'documento' ? 'O documento fica visível para os colaboradores.' : 'A pessoa é avisada para publicar na plataforma.';
    if (!(await confirmar({ titulo: 'Aprovar publicação?', mensagem: `«${p.titulo}». ${onde}`, confirmar: 'Aprovar' }))) return;
    try { await api(`/api/aprovacoes/${p.id}/decidir`, { aprovar: true }); await carregar(); aviso(); } catch (e) { await avisar({ titulo: 'Não deu certo', mensagem: (e as Error).message }); }
  };
  return (
    <section className="crud aprov-secao">
      <div className="barra">
        <div className="abas abas-gestao" role="tablist" aria-label="Fila">
          <button role="tab" aria-selected={ver === 'pendentes'} onClick={() => setVer('pendentes')}>Aguardando decisão</button>
          <button role="tab" aria-selected={ver === 'historico'} onClick={() => setVer('historico')}>Histórico</button>
        </div>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="vazio">Carregando…</p>}
      {lista && lista.length === 0 && <p className="vazio">{ver === 'pendentes' ? 'Nada aguardando aprovação.' : 'Nenhuma decisão registrada ainda.'}</p>}
      <div className="aprov-lista">
        {(lista ?? []).map((p) => {
          const [t, x] = SIT[p.status] ?? ['neutro', p.status];
          const v = p.previa;
          return (
            <article key={p.id} className="aprov-cartao">
              <header>
                <span className="aprov-tipo">{p.tipo === 'rede_social' ? v?.plataforma_nome ?? 'Rede social' : NOME_TIPO[p.tipo]}</span>
                <Selo texto={x} tom={t} />
              </header>
              <h3>{p.titulo}</h3>
              <small className="suave">Enviado por {p.solicitante} · {dataCurta(p.criado_em)}{p.decisor ? ` · decidido por ${p.decisor}${p.decidido_em ? ` em ${dataCurta(p.decidido_em)}` : ''}` : ''}</small>
              {v && (
                <div className="aprov-previa">
                  {v.imagem && <img src={v.imagem} alt="" />}
                  <div>
                    {v.tipo === 'comunicado' ? (<>
                      <p><b>{v.categoria}</b>{v.prioridade === 'urgente' ? ' · urgente' : ''}</p>
                      <p>{v.resumo}</p>
                      {v.corpo && <p className="aprov-texto">{v.corpo}</p>}
                    </>) : v.tipo === 'banner' ? (<>
                      {v.subtitulo && <p>{v.subtitulo}</p>}
                      {v.link && <p><small>Botão «{v.botao_texto}» → {v.link}</small></p>}
                    </>) : v.tipo === 'documento' ? (<>
                      <p><b>{v.categoria}</b> · {v.formato}{v.versao ? ` · versão ${v.versao}` : ''}{v.classificacao === 'restrito' ? ' · restrito' : ''}</p>
                      <p>{v.resumo}</p>
                    </>) : (<>
                      {v.legenda && <p className="aprov-texto">{v.legenda}</p>}
                      {v.link && <p><small>Link: {v.link}</small></p>}
                      {v.data_prevista && <p><small>Data prevista: {dataCurta(v.data_prevista)}</small></p>}
                    </>)}
                  </div>
                </div>
              )}
              {!!v?.anexos?.length && <ListaAnexos anexos={v.anexos} compacta />}
              {p.status === 'rejeitado' && p.motivo && <p className="motivo-rej">Motivo: {p.motivo}</p>}
              <footer>
                {v && <button className="btn btn-sec btn-pequeno" onClick={() => setLendo(p)}>Abrir</button>}
                {p.status === 'pendente' && decide && (<>
                  <button className="btn btn-verde btn-pequeno" onClick={() => void aprovar(p)}>Aprovar</button>
                  <button className="btn btn-vermelho btn-pequeno" onClick={() => setRejeitando(p)}>Rejeitar</button>
                </>)}
              </footer>
            </article>
          );
        })}
      </div>
      {lendo?.previa && (
        <DetalhePedido titulo={lendo.titulo} tipo={lendo.tipo} dados={lendo.previa} remetente={lendo.solicitante} aoFechar={() => setLendo(null)}
          acoes={lendo.status === 'pendente' && decide ? (<>
            <button type="button" className="btn btn-vermelho" onClick={() => { const p = lendo; setLendo(null); setRejeitando(p); }}>Rejeitar</button>
            <button type="button" className="btn btn-verde" onClick={() => { const p = lendo; setLendo(null); void aprovar(p); }}>Aprovar</button>
          </>) : undefined} />
      )}
      {rejeitando && <Rejeitar p={rejeitando} aoFechar={() => setRejeitando(null)} aoConcluir={() => { setRejeitando(null); void carregar(); aviso(); }} />}
    </section>
  );
}
