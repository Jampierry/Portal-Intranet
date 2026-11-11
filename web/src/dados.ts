import { useEffect, useState } from 'react';
import { api } from './api';

export interface Aplicacao { slug: string; nome: string; descricao: string; categoria: string; url: string; acesso: string; icone: string; logo?: string | null }
export interface Comunicado { slug: string; titulo: string; resumo: string; categoria: string; prioridade: string; imagem?: string | null; publicado_em: string | null; exige_leitura?: number; lido?: number }
export interface Documento { slug: string; titulo: string; categoria: string; resumo: string; formato: string; versao: string | null; responsavel: string | null; classificacao: string; origem: string; link_oficial: string | null; revisado_em: string | null }
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** "Novembro/2026" (ou só "2026" quando o destaque antigo não tem mês). */
export const periodoDe = (d: { mes: number | null; ano: number }) => (d.mes ? `${MESES_LONGOS[d.mes - 1]}/${d.ano}` : String(d.ano));
export interface Destaque { mes: number | null; ano: number; nome: string; area: string; iniciais: string; apresentacao: string; foto?: string | null }

/** Busca uma lista na API; `dados` é null enquanto carrega e `erro` traz a mensagem se falhar. */
export function useLista<T>(url: string | null) {
  const [dados, setDados] = useState<T[] | null>(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (!url) { setDados([]); return; } // sem permissão para esta lista: nem chama o servidor
    api<T[]>(url).then((d) => { setDados(d); setErro(''); }).catch((e: Error) => setErro(e.message));
  }, [url, versao]);
  return { dados, erro, recarregar: () => setVersao((v) => v + 1) };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function dataCurta(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d} ${MESES[Number(m) - 1] ?? ''} ${a}`;
}

export interface Banner { id: number; titulo: string; subtitulo: string | null; imagem: string | null; botao_texto: string | null; link: string | null; posicao: 'principal' | 'lateral1' | 'lateral2' }
