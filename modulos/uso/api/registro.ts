import type { Banco } from '../../../servidor/src/db.ts';

export const RETENCAO_DIAS = 365;

const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Celular ou computador, pelo navegador (suficiente para medir adoção; nada de impressão digital do aparelho). */
export const aparelhoDe = (userAgent: string | undefined): 'celular' | 'computador' => (/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent ?? '') ? 'celular' : 'computador');

/** Anota um evento de uso. Nunca lança: medir o uso não pode derrubar o portal. */
export function registrarUso(db: Banco, usuarioId: number, tipo: 'login' | 'tela', userAgent: string | undefined, tela?: string): void {
  try {
    const agora = new Date();
    // mesma tela da mesma pessoa em menos de 1 minuto conta uma vez só (recarregar a página não infla o número)
    if (tipo === 'tela') {
      const antes = db.prepare("SELECT tela, quando FROM uso_eventos WHERE usuario_id = ? AND tipo = 'tela' ORDER BY id DESC LIMIT 1").get(usuarioId) as { tela: string; quando: string } | undefined;
      if (antes && antes.tela === tela && agora.getTime() - new Date(antes.quando).getTime() < 60_000) return;
    }
    db.prepare('INSERT INTO uso_eventos (usuario_id, quando, dia, hora, tipo, tela, aparelho) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(usuarioId, agora.toISOString(), dataLocal(agora), agora.getHours(), tipo, tela ?? null, aparelhoDe(userAgent));
  } catch { /* ignora */ }
}

/** Apaga o que passou do prazo de guarda. */
export function limparUsoAntigo(db: Banco): number {
  const corte = new Date(Date.now() - RETENCAO_DIAS * 86_400_000);
  return Number(db.prepare('DELETE FROM uso_eventos WHERE dia < ?').run(dataLocal(corte)).changes);
}
