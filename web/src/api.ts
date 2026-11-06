export async function api<T>(url: string, corpo?: unknown, metodo?: 'POST' | 'PUT' | 'DELETE'): Promise<T> {
  const r = await fetch(url, {
    method: metodo ?? (corpo === undefined ? 'GET' : 'POST'),
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { erro?: string }).erro ?? `Erro ${r.status}`);
  return json as T;
}
