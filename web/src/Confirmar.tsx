import { useEffect, useRef, useState } from 'react';

/** Aviso próprio do portal (pop-up em tela) no lugar do confirm/alert do navegador. */
export type OpcoesConfirmar = { titulo?: string; mensagem: string; confirmar?: string; cancelar?: string; perigo?: boolean };
type Pedido = OpcoesConfirmar & { info?: boolean; resolver: (ok: boolean) => void };

let abrir: ((p: Pedido) => void) | null = null;

/** Pergunta Sim/Não. Devolve true se a pessoa confirmou. Ex.: `if (!(await confirmar('Apagar?'))) return;` */
export function confirmar(o: string | OpcoesConfirmar): Promise<boolean> {
  const op = typeof o === 'string' ? { mensagem: o } : o;
  // Sem o componente montado (testes), recusa por segurança em vez de apagar sem perguntar.
  if (!abrir) return Promise.resolve(false);
  return new Promise((resolver) => abrir!({ ...op, resolver }));
}

/** Aviso com um só botão "Entendi". */
export function avisar(o: string | Omit<OpcoesConfirmar, 'cancelar'>): Promise<void> {
  const op = typeof o === 'string' ? { mensagem: o } : o;
  if (!abrir) return Promise.resolve();
  return new Promise((resolver) => abrir!({ ...op, info: true, resolver: () => resolver() }));
}

export function ConfirmarHost() {
  const [fila, setFila] = useState<Pedido[]>([]);
  const ref = useRef<HTMLDialogElement>(null);
  const atual = fila[0];
  useEffect(() => { abrir = (p) => setFila((f) => [...f, p]); return () => { abrir = null; }; }, []);
  useEffect(() => { if (atual && ref.current && !ref.current.open) ref.current.showModal(); }, [atual]);
  if (!atual) return null;
  const fechar = (ok: boolean) => { ref.current?.close(); atual.resolver(ok); setFila((f) => f.slice(1)); };
  return (
    <dialog key={fila.length + atual.mensagem} className="janela janela-aviso" ref={ref} aria-label={atual.titulo ?? (atual.info ? 'Aviso' : 'Confirmação')}
      onCancel={(e) => { e.preventDefault(); fechar(false); }}>
      <div className="janela-form">
        <header><h2>{atual.titulo ?? (atual.info ? 'Aviso' : atual.perigo === false ? 'Confirmar' : 'Confirmar ação')}</h2></header>
        <div className="janela-corpo"><p className="aviso-texto">{atual.mensagem}</p></div>
        <footer>
          {!atual.info && <button type="button" className="btn btn-sec" onClick={() => fechar(false)}>{atual.cancelar ?? 'Cancelar'}</button>}
          <button type="button" className={`btn${atual.perigo ? ' btn-perigo' : ''}`} autoFocus={!atual.perigo} onClick={() => fechar(true)}>{atual.confirmar ?? (atual.info ? 'Entendi' : 'Confirmar')}</button>
        </footer>
      </div>
    </dialog>
  );
}
