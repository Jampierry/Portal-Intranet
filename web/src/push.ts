// Avisos push neste aparelho (computador ou celular): pede permissão, inscreve o navegador e avisa o servidor.
// Exige HTTPS (ou localhost) e, no iPhone, o portal instalado na tela inicial. O service worker (public/sw.js) mostra a notificação.
import { api } from './api';

export const pushSuportado = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const paraBytes = (b64: string) => {
  const preenchido = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
};

async function registro(): Promise<ServiceWorkerRegistration> {
  // em desenvolvimento o service worker não é registrado sozinho; aqui garantimos que existe
  await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  return navigator.serviceWorker.ready;
}

/** Este aparelho já recebe avisos? */
export async function pushAtivo(): Promise<boolean> {
  if (!pushSuportado() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return !!(await reg?.pushManager.getSubscription());
}

/** Liga os avisos neste aparelho. Lança Error com mensagem em português se não der. */
export async function ativarPush(): Promise<void> {
  if (!pushSuportado()) throw new Error('Este navegador não permite avisos (precisa de HTTPS; no iPhone, instale o portal na tela inicial).');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('A permissão de notificações foi negada. Libere nas configurações do navegador para este endereço.');
  const reg = await registro();
  const { chave } = await api<{ chave: string }>('/api/push/chave');
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) }));
  await api('/api/push/inscrever', sub.toJSON());
}

/** Desliga os avisos neste aparelho. */
export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/push/cancelar', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}
