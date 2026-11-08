import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icone } from '../icones';

interface Estado { aberto: boolean; id?: number; pergunta?: string; respondeu?: boolean }
const NOTAS: [number, string, string][] = [[1, '😞', 'Muito ruim'], [2, '🙁', 'Ruim'], [3, '😐', 'Normal'], [4, '🙂', 'Bom'], [5, '😄', 'Muito bom']];

/** Início: a pergunta da pesquisa de pulso aberta (anônima). Some depois de respondida. */
export function PulsoCard() {
  const [e, setE] = useState<Estado | null>(null);
  const [nota, setNota] = useState(0);
  const [coment, setComent] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);
  useEffect(() => { api<Estado>('/api/pulso').then(setE).catch(() => setE(null)); }, []);
  if (!e?.aberto || (e.respondeu && !feito)) return null;
  const enviar = async () => {
    setErro(''); setOcupado(true);
    try { await api(`/api/pulso/${e.id}/responder`, { nota, comentario: coment.trim() }); setFeito(true); }
    catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };
  if (feito) return <section className="cartao-sec pulso-card" role="status"><p style={{ margin: 0 }}><Icone nome="info" tamanho={18} /> <b>Obrigado!</b> Sua resposta foi enviada de forma anônima.</p></section>;
  return (
    <section className="cartao-sec pulso-card" aria-labelledby="pulso-q">
      <div className="sec-topo"><h2 id="pulso-q"><Icone nome="info" tamanho={22} /> Pulso da semana</h2><small className="suave">Resposta anônima</small></div>
      <p className="pulso-pergunta">{e.pergunta}</p>
      <div className="pulso-notas" role="radiogroup" aria-label="Sua nota">
        {NOTAS.map(([n, c, t]) => <button key={n} type="button" role="radio" aria-checked={nota === n} className={nota === n ? 'on' : ''} onClick={() => setNota(n)} title={t}><span aria-hidden="true">{c}</span><small>{t}</small></button>)}
      </div>
      {nota > 0 && (
        <>
          <label className="pulso-coment-campo">Quer comentar? (opcional)
            <textarea rows={2} maxLength={500} value={coment} onChange={(ev) => setComent(ev.target.value)} placeholder="Não escreva nada que o identifique se quiser manter o anonimato." />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button className="btn" disabled={ocupado} onClick={() => void enviar()}>{ocupado ? 'Enviando…' : 'Enviar resposta'}</button>
        </>
      )}
    </section>
  );
}
