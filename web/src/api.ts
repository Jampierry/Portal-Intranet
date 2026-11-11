import { confirmar } from './Confirmar.tsx';
/** Erro da API com o status HTTP e o código opcional (ex.: "trocar_senha"). */
export class ErroApi extends Error {
  status: number;
  codigo?: string;
  constructor(mensagem: string, status: number, codigo?: string) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

export async function api<T>(url: string, corpo?: unknown, metodo?: 'POST' | 'PUT' | 'DELETE'): Promise<T> {
  const r = await fetch(url, {
    method: metodo ?? (corpo === undefined ? 'GET' : 'POST'),
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    credentials: 'same-origin',
  });
  const json = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login' && url !== '/api/eu') window.dispatchEvent(new Event('sessao-expirada'));
  if (!r.ok) {
    const j = json as { erro?: string; codigo?: string; recurso?: string; registro?: string };
    // Editar o que outra pessoa criou: oferece pedir autorização ao dono (o administrador também recebe o pedido).
    if (r.status === 403 && j.codigo === 'precisa_autorizacao' && j.recurso && j.registro) {
      if (await confirmar({ titulo: 'Pedir autorização', mensagem: `${j.erro}\n\nEnviar o pedido ao autor e ao administrador agora?`, confirmar: 'Enviar pedido' })) {
        await api('/api/pedidos-edicao', { recurso: j.recurso, registro: j.registro });
        window.dispatchEvent(new Event('pedidos-edicao'));
        throw new ErroApi('Pedido enviado ao autor e ao administrador. Quando liberarem, você recebe um aviso no sino e pode editar.', 403, 'pedido_enviado');
      }
    }
    throw new ErroApi(j.erro ?? `Erro ${r.status}`, r.status, j.codigo);
  }
  return json as T;
}
