import { useEffect, useState } from 'react';
import { api } from '../api';
import { JanelaResultado, marcarVisto, type ItemResultado } from './JanelaResultado';

/** Pop-up de novidade: quando o RH divulga um resultado, ele aparece para todos ao entrar no portal. Depois de visto e fechado, só pela tela Pesquisas do menu.
 *  Se há uma pesquisa para responder (outro pop-up), este espera para o próximo acesso. */
export function ResultadoPopup() {
  const [fila, setFila] = useState<ItemResultado[]>([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const pendente = await api<{ aberto: boolean }>('/api/pulso');
        if (pendente.aberto) return;
        const lista = await api<ItemResultado[]>('/api/pulso/resultados');
        if (vivo) setFila(lista.filter((p) => !p.visto));
      } catch { /* sem pop-up */ }
    })();
    return () => { vivo = false; };
  }, []);
  const atual = fila[0];
  if (!atual) return null;
  const fechar = () => { void marcarVisto(atual.id); setFila((f) => f.slice(1)); };
  return <JanelaResultado item={atual} aoFechar={fechar} titulo="Resultado divulgado" />;
}
