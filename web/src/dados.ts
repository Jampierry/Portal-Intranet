import { useEffect, useState } from 'react';
import { api } from './api';

export interface Aplicacao { slug: string; nome: string; descricao: string; categoria: string; url: string; acesso: string; icone: string }
export interface Comunicado { slug: string; titulo: string; resumo: string; categoria: string; prioridade: string; publicado_em: string | null }
export interface Documento { slug: string; titulo: string; categoria: string; resumo: string; formato: string; versao: string | null; responsavel: string | null; revisado_em: string | null }
export interface Destaque { tipo: 'mes' | 'ano'; rotulo: string; nome: string; area: string; iniciais: string; apresentacao: string }

/** Busca uma lista na API; `dados` é null enquanto carrega e `erro` traz a mensagem se falhar. */
export function useLista<T>(url: string) {
  const [dados, setDados] = useState<T[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api<T[]>(url).then(setDados).catch((e: Error) => setErro(e.message));
  }, [url]);
  return { dados, erro };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function dataCurta(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d} ${MESES[Number(m) - 1] ?? ''} ${a}`;
}
