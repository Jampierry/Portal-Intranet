import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { Icone } from '../icones';

interface Opcao { texto: string; imagem: string | null }
interface Pergunta { id: number; texto: string; tipo: 'nota' | 'unica' | 'multipla' | 'texto'; obrigatoria: boolean; imagem: string | null; opcoes: Opcao[]; comentario?: boolean }
interface Estado { aberto: boolean; id?: number; titulo?: string; descricao?: string | null; anonima?: boolean; respondeu?: boolean; perguntas?: Pergunta[] }
interface Resp { valor?: string; valores?: string[]; comentario?: string }
const NOTAS: [number, string, string][] = [[1, '😞', 'Muito ruim'], [2, '🙁', 'Ruim'], [3, '😐', 'Normal'], [4, '🙂', 'Bom'], [5, '😄', 'Muito bom']];
const CORES = ['--vinho', '--ok', '--coral', '--laranja', '--azul', '--roxo'];
const EXPLOSOES = [[22, 30, 0], [76, 24, 0.35], [50, 46, 0.7], [14, 62, 1.0], [86, 58, 1.25], [50, 22, 1.5]];
/** Fogos de comemoração atrás da mensagem de agradecimento (só CSS, cores do tema). */
function Fogos() {
  return (
    <div className="pq-fogos" aria-hidden="true">
      {EXPLOSOES.map(([x, y, atraso], b) => (
        <span key={b} className="pq-fogo" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${atraso}s` }}>
          {Array.from({ length: 16 }, (_, k) => (
            <i key={k} style={{ '--a': `${k * 22.5}deg`, '--d': `${46 + (k % 2) * 22}px`, '--c': `var(${CORES[(b + k) % CORES.length]})`, animationDelay: `${atraso}s` } as React.CSSProperties} />
          ))}
        </span>
      ))}
    </div>
  );
}
const chaveDispensa = (id: number) => `pulso-dispensado-${id}`;
const lerDispensa = (id: number) => { try { return sessionStorage.getItem(chaveDispensa(id)) === '1'; } catch { return false; } };
const gravarDispensa = (id: number) => { try { sessionStorage.setItem(chaveDispensa(id), '1'); } catch { /* sem armazenamento: só não lembra */ } };

/** Pesquisa (anônima) como pop-up sobre o app quando há uma aberta que a pessoa ainda não respondeu.
 *  "Responder depois" fecha só nesta sessão (volta a aparecer no próximo acesso); depois de respondida não aparece mais. */
export function PulsoCard() {
  const [e, setE] = useState<Estado | null>(null);
  const [resp, setResp] = useState<Record<number, Resp>>({});
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [passo, setPasso] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => { api<Estado>('/api/pulso').then(setE).catch(() => setE(null)); }, []);

  const visivel = !!e?.aberto && !fechado && (feito || (!e.respondeu && !(e.id !== undefined && lerDispensa(e.id))));
  const dispensar = () => { if (e?.id !== undefined && !feito) gravarDispensa(e.id); setFechado(true); };

  useEffect(() => {
    if (!visivel) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') dispensar(); };
    window.addEventListener('keydown', tecla);
    caixa.current?.focus();
    return () => window.removeEventListener('keydown', tecla);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, feito]);
  useEffect(() => { if (!feito) return; const t = setTimeout(() => setFechado(true), 4500); return () => clearTimeout(t); }, [feito]);

  if (!e || !visivel) return null;
  const perguntas = e.perguntas ?? [];
  const muda = (id: number, p: Partial<Resp>) => setResp((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  const respondida = (q: Pergunta) => {
    if (!q.obrigatoria) return true;
    const r = resp[q.id];
    return q.tipo === 'multipla' ? (r?.valores?.length ?? 0) > 0 : q.tipo === 'texto' ? !!r?.valor?.trim() : !!r?.valor;
  };
  const atual = Math.min(passo, Math.max(perguntas.length - 1, 0));
  const ultima = atual >= perguntas.length - 1;
  const podeIr = perguntas[atual] ? respondida(perguntas[atual]) : true;
  const enviar = async () => {
    setErro(''); setOcupado(true);
    try {
      const respostas = perguntas.map((q) => ({ pergunta_id: q.id, ...resp[q.id], comentario: resp[q.id]?.comentario?.trim() || undefined }));
      await api(`/api/pulso/${e.id}/responder`, { respostas });
      setFeito(true);
    } catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };

  return createPortal(
    <div className="pulso-overlay" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) dispensar(); }}>
      <div className="pulso-modal" role="dialog" aria-modal="true" aria-labelledby="pulso-q" tabIndex={-1} ref={caixa}>
        <button type="button" className="pulso-fechar" aria-label="Fechar (responder depois)" onClick={dispensar}>×</button>
        {feito ? (<>
          <Fogos />
          <p className="pulso-obrigado" role="status"><Icone nome="info" tamanho={20} /> <b>Obrigado!</b> Sua resposta foi enviada{e.anonima === false ? '.' : ' de forma anônima.'}</p>
        </>) : (
          <>
            <div className="sec-topo"><h2 id="pulso-q"><Icone nome="info" tamanho={22} /> {e.titulo}</h2><small className="suave">{e.anonima === false ? 'Resposta identificada: o RH verá seu nome' : 'Resposta anônima'}</small></div>
            {e.descricao && <p className="suave" style={{ margin: 0 }}>{e.descricao}</p>}
            {perguntas.length > 1 && (
              <ol className="pq-passos" aria-label="Perguntas da pesquisa">
                {perguntas.map((q, n) => (
                  <li key={q.id}>
                    <button type="button" className={`pq-passo${n === atual ? ' atual' : n < atual ? ' feito' : ''}`} disabled={n > atual && !perguntas.slice(0, n).every(respondida)}
                      aria-current={n === atual ? 'step' : undefined} aria-label={`Pergunta ${n + 1}${n < atual ? ' (respondida)' : ''}`} onClick={() => setPasso(n)}>{n < atual ? '✓' : n + 1}</button>
                  </li>
                ))}
              </ol>
            )}
            {perguntas.filter((_, n) => n === atual).map((q) => {
              const n = atual;
              const r = resp[q.id] ?? {};
              const rotulo = `pq-${q.id}`;
              return (
                <fieldset key={q.id} className="pq-resp">
                  <legend className="pulso-pergunta" id={rotulo}>{perguntas.length > 1 ? `${n + 1}. ` : ''}{q.texto}{q.obrigatoria ? '' : ' (opcional)'}</legend>
                  {q.imagem && <img src={q.imagem} alt="" className="pq-resp-img" />}
                  {q.tipo === 'nota' && (<>
                    <div className="pulso-notas" role="radiogroup" aria-labelledby={rotulo}>
                      {NOTAS.map(([v, c, t]) => <button key={v} type="button" role="radio" aria-checked={r.valor === String(v)} className={r.valor === String(v) ? 'on' : ''} onClick={() => muda(q.id, { valor: String(v) })} title={t}><span aria-hidden="true">{c}</span><small>{t}</small></button>)}
                    </div>
                    {r.valor && q.comentario && (
                      <label className="pulso-coment-campo">Quer comentar? (opcional)
                        <textarea rows={2} maxLength={500} value={r.comentario ?? ''} onChange={(ev) => muda(q.id, { comentario: ev.target.value })} placeholder="Não escreva nada que o identifique se quiser manter o anonimato." />
                      </label>
                    )}
                  </>)}
                  {(q.tipo === 'unica' || q.tipo === 'multipla') && (
                    <div className="pq-opcoes-resp">
                      {q.opcoes.map((o) => {
                        const marcado = q.tipo === 'unica' ? r.valor === o.texto : (r.valores ?? []).includes(o.texto);
                        const alternar = () => q.tipo === 'unica' ? muda(q.id, { valor: o.texto })
                          : muda(q.id, { valores: marcado ? (r.valores ?? []).filter((x) => x !== o.texto) : [...(r.valores ?? []), o.texto] });
                        return (
                          <label key={o.texto} className={`pq-opcao-resp${marcado ? ' on' : ''}`}>
                            <input type={q.tipo === 'unica' ? 'radio' : 'checkbox'} name={rotulo} checked={marcado} onChange={alternar} />
                            {o.imagem && <img src={o.imagem} alt="" />}
                            <span>{o.texto}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.tipo === 'texto' && (
                    <textarea rows={3} maxLength={1000} aria-labelledby={rotulo} value={r.valor ?? ''} onChange={(ev) => muda(q.id, { valor: ev.target.value })} placeholder="Escreva sua resposta" style={{ width: '100%' }} />
                  )}
                </fieldset>
              );
            })}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="pulso-acoes">
              <button type="button" className="btn btn-sec" onClick={dispensar}>Responder depois</button>
              {atual > 0 && <button type="button" className="btn btn-sec" onClick={() => setPasso(atual - 1)}>Voltar</button>}
              {ultima
                ? <button type="button" className="btn" disabled={ocupado || !perguntas.every(respondida)} onClick={() => void enviar()}>{ocupado ? 'Enviando…' : 'Enviar resposta'}</button>
                : <button type="button" className="btn" disabled={!podeIr} onClick={() => setPasso(atual + 1)}>Próxima</button>}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
