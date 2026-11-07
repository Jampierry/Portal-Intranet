import { useState } from 'react';
import { Icone, temIcone } from '../icones';
import { iconePorTexto } from '../iconesAuto';
import type { Aplicacao } from '../dados';

/** Ícone do aplicativo: a imagem própria (quando há), o ícone escolhido no cadastro ou, em "automático", o que combina com a categoria e o nome. */
export function IconeApp({ app, tamanho = 20 }: { app: Pick<Aplicacao, 'icone' | 'logo' | 'nome' | 'categoria'>; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  if (app.logo && !falhou) return <img className="icone-app-img" src={app.logo} alt="" onError={() => setFalhou(true)} />;
  const escolhido = app.icone === 'users' ? 'pessoas' : app.icone;
  const nome = escolhido && escolhido !== 'apps' && escolhido !== 'auto' && temIcone(escolhido) ? escolhido : iconePorTexto(`${app.nome} ${app.categoria}`, 'aplicacoes');
  return <Icone nome={nome} tamanho={tamanho} />;
}
