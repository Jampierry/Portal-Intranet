import { useState } from 'react';
import { Icone } from '../icones';
import type { Aplicacao } from '../dados';

/** Ícone do aplicativo: a imagem própria dele (quando cadastrada) ou o ícone padrão; se a imagem falhar, cai no padrão. */
export function IconeApp({ app, tamanho = 20 }: { app: Pick<Aplicacao, 'icone' | 'logo'>; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  if (app.logo && !falhou) return <img className="icone-app-img" src={app.logo} alt="" onError={() => setFalhou(true)} />;
  return <Icone nome={app.icone === 'users' ? 'pessoas' : 'aplicacoes'} tamanho={tamanho} />;
}
