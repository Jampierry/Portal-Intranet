import { useEffect, useSyncExternalStore } from 'react';
import { IconeSistema } from './icones';

/** Identidade do portal, definida pelo administrador em Configurações › Empresa (nada de nome de empresa fixo no código). */
export interface FeriadoMunicipal { titulo: string; dia: number; mes: number }
export interface ConfigEmpresa {
  nome: string;
  nome_portal: string;
  slogan: string;
  frase_rodape: string;
  lema: string[];
  rotulo_destaque: string;
  lema_destaque: string[];
  logo: string | null;
  logo_nome: string | null;
  logo_nome_escuro: string | null;
  feriados_municipais: FeriadoMunicipal[];
  fundacao: string | null;
}
export const PADRAO_EMPRESA: ConfigEmpresa = {
  nome: 'Sua Empresa', nome_portal: 'Portal Intranet', slogan: '', frase_rodape: 'Conectando pessoas, ideias e grandes movimentos.',
  lema: ['SONHAR', 'FAZ PARTE', 'DO NOSSO', 'MOVIMENTO'], rotulo_destaque: 'DESTAQUE', lema_destaque: ['PESSOAS', 'MOVIMENTO', 'RESULTADOS', 'SEMPRE'],
  logo: null, logo_nome: null, logo_nome_escuro: null, feriados_municipais: [], fundacao: null,
};

let atual: ConfigEmpresa = { ...PADRAO_EMPRESA, lema: [...PADRAO_EMPRESA.lema] };
let carregou = false;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const ver = () => atual;

/** Troca a identidade em uso (depois de carregar ou de o administrador salvar) e avisa as telas abertas. */
export function definirEmpresa(c: Partial<ConfigEmpresa>) { atual = { ...PADRAO_EMPRESA, ...c }; carregou = true; ouvintes.forEach((f) => f()); }
export function carregarEmpresa() {
  return fetch('/api/empresa', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (c) definirEmpresa(c as ConfigEmpresa); }).catch(() => { /* fica no padrão */ });
}

/** Nome, textos e ícone da empresa. Busca uma vez (é público: serve também para a tela de login). */
export function useEmpresa(): ConfigEmpresa {
  const c = useSyncExternalStore(assinar, ver);
  useEffect(() => { if (!carregou) void carregarEmpresa(); }, []);
  return c;
}

/** Ícone da empresa: a imagem enviada, ou o ícone padrão do portal. */
export function LogoEmpresa({ tamanho = 32, classe }: { tamanho?: number; classe?: string }) {
  const { logo } = useEmpresa();
  return logo ? <img className={classe} src={logo} alt="" width={tamanho} height={tamanho} style={{ objectFit: 'contain', borderRadius: 8 }} /> : <IconeSistema tamanho={tamanho} />;
}

/** Logo da empresa no lugar do nome escrito. A versão "claro" tem letras escuras (para fundo claro); a "escuro", letras claras (para fundo escuro).
 *  sobre="menu": escolhe pela cor do menu/lateral do login (escuro na maioria dos estilos), não pelo tema; sobre="tema" (padrão): pelo tema em uso.
 *  Com só uma versão, ela vale para os dois casos. Sem logo, devolve nada. */
export function LogoNome({ cfg, classe, sobre = 'tema' }: { cfg?: Pick<ConfigEmpresa, 'nome' | 'logo_nome' | 'logo_nome_escuro'>; classe: string; sobre?: 'tema' | 'menu' }) {
  const emp = useEmpresa();
  const c = cfg ?? emp;
  const { logo_nome: claro, logo_nome_escuro: escuro } = c;
  if (!claro && !escuro) return null;
  if (!claro || !escuro) return <img className={classe} src={(claro || escuro)!} alt={c.nome} />;
  return <><img className={`${classe} logo-${sobre}-claro`} src={claro} alt={c.nome} /><img className={`${classe} logo-${sobre}-escuro`} src={escuro} alt="" aria-hidden="true" /></>;
}
