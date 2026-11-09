import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { Icone } from '../icones';

interface Estado { aberto: boolean; id?: number; pergunta?: string; respondeu?: boolean }
const NOTAS: [number, string, string][] = [[1, '😞', 'Muito ruim'], [2, '🙁', 'Ruim'], [3, '😐', 'Normal'], [4, '🙂', 'Bom'], [5, '😄', 'Muito bom']];
const chaveDispensa = (id: number) => `pulso-dispensado-${id}`;
const lerDispensa = (id: number) => { try { return sessionStorage.getItem(chaveDispensa(id)) === '1'; } catch { return false; } };
const gravarDispensa = (id: number) => { try { sessionStorage.setItem(chaveDispensa(id), '1'); } catch { /* sem armazenamento: só não lembra */ } };

/** Pesquisa de pulso (anônima) como pop-up sobre o app quando há uma aberta e a pessoa ainda não respondeu.
 *  "Responder depois" fecha só nesta sessão (volta a aparecer no próximo acesso); depois de respondida não aparece mais. */
export function PulsoCard() {
  const [e, setE] = useState<Estado | null>(null);
  const [nota, setNota] = useState(0);
  const [coment, setComent] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);
  const [fechado, setFechado] = useState(false);
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
  useEffect(() => { if (!feito) return; const t = setTimeout(() => setFechado(true), 3500); return () => clearTimeout(t); }, [feito]);

  if (!e || !visivel) return null;
  const enviar = async () => {
    setErro(''); setOcupado(true);
    try { await api(`/api/pulso/${e.id}/responder`, { nota, comentario: coment.trim() }); setFeito(true); }
    catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };

  return createPortal(
    <div className="pulso-overlay" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) dispensar(); }}>
      <div className="pulso-modal" role="dialog" aria-modal="true" aria-labelledby="pulso-q" tabIndex={-1} ref={caixa}>
        <button type="button" className="pulso-fechar" aria-label="Fechar (responder depois)" onClick={dispensar}>×</button>
        {feito ? (
          <p className="pulso-obrigado" role="status"><Icone nome="info" tamanho={20} /> <b>Obrigado!</b> Sua resposta foi enviada de forma anônima.</p>
        ) : (
          <>
            <div className="sec-topo"><h2 id="pulso-q"><Icone nome="info" tamanho={22} /> Pulso da semana</h2><small className="suave">Resposta anônima</small></div>
            <p className="pulso-pergunta">{e.pergunta}</p>
            <div className="pulso-notas" role="radiogroup" aria-label="Sua nota">
              {NOTAS.map(([n, c, t]) => <button key={n} type="button" role="radio" aria-checked={nota === n} className={nota === n ? 'on' : ''} onClick={() => setNota(n)} title={t}><span aria-hidden="true">{c}</span><small>{t}</small></button>)}
            </div>
            {nota > 0 && (
              <label className="pulso-coment-campo">Quer comentar? (opcional)
                <textarea rows={2} maxLength={500} value={coment} onChange={(ev) => setComent(ev.target.value)} placeholder="Não escreva nada que o identifique se quiser manter o anonimato." />
              </label>
            )}
            {erro && <p className="erro" role="alert">{erro}</p>}
            <div className="pulso-acoes">
              <button type="button" className="btn btn-sec" onClick={dispensar}>Responder depois</button>
              <button type="button" className="btn" disabled={ocupado || nota === 0} onClick={() => void enviar()}>{ocupado ? 'Enviando…' : 'Enviar resposta'}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
