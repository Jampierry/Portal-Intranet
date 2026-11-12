import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from './api';

/** Código do perfil: 'admin', 'editor', 'consulta' ou o de um perfil personalizado (ex.: 'p-recursos-humanos'). */
export type PerfilAcesso = string;
export interface Usuario { id: number; login: string; nome: string; perfil: PerfilAcesso; perfil_nome: string; trocar_senha: number; exige_aprovacao?: number; permissoes: string[] }

/** Permissão efetiva do usuário (perfil + ajustes feitos pelo administrador). O servidor confere de novo em cada chamada. */
export const pode = (u: Usuario | null | undefined, chave: string) => !!u && (u.perfil === 'admin' || (u.permissoes ?? []).includes(chave));
/** Vê a área Publicar se pode publicar alguma coisa. */
export const podeGerir = (u: Usuario | null) => !!u && (u.permissoes ?? []).some((p) => p.startsWith('pub.') && p.endsWith('.ver'));

/** Sessão do usuário (cookie httpOnly no servidor). `usuario` é undefined enquanto carrega e null sem login. */
export function useSessao() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  const recarregar = useCallback(async () => {
    try { setUsuario(await api<Usuario | null>('/api/eu')); setOffline(false); }
    catch (e) {
      if (e instanceof ErroApi && e.status === 401) setUsuario(null);
      else if (e instanceof ErroApi && e.codigo === 'trocar_senha') setOffline(false);
      else setOffline(true);
    }
  }, []);
  useEffect(() => { void recarregar(); }, [recarregar]);
  useEffect(() => { const f = () => setUsuario(null); addEventListener('sessao-expirada', f); return () => removeEventListener('sessao-expirada', f); }, []);

  const entrar = async (login: string, senha: string) => { setUsuario(await api<Usuario>('/api/login', { login, senha })); };
  const sair = async () => { try { await api('/api/sair', {}); } finally { setUsuario(null); } };
  return { usuario, offline, entrar, sair, recarregar };
}
